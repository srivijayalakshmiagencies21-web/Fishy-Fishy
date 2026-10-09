"use client";

import { useRouter } from "next/navigation";
import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
  type ReactNode,
  type UIEvent,
} from "react";
import {
  deleteTransferRecording,
  startTransfer,
  recordTransfer,
} from "@/app/(workspace)/transfer/actions";
import { compressOdometerPhotoClient } from "@/lib/odometer-image-compress.client";
import { submitCompressedFormAction } from "@/lib/submit-compressed-form-action";
import { formDataFile } from "@/lib/odometer-image";
import { formatOdometerDisplayLabel } from "@/lib/odometer-display";
import { JourneySummaryCard } from "@/components/journey-summary-card";
import type { DistrictRow, FishRow, VendorRow } from "@/lib/masters";
import type { JourneySummary } from "@/lib/journey-cards";
import { journeyPointBadgeLabel, splitJourneysByPointLane } from "@/lib/journey-point-lanes";
import { JourneyPhase, normalizeJourneyPhase } from "@/lib/journey-phase";
import { hasPersistedTransferRecording, isTransferPointOdometerPath } from "@/lib/journey-transfer-recording";
import { buildTransferSummaryRows } from "@/lib/journey-transfer-summary";
import {
  isSecondaryTruck,
  primaryTruckNumber,
  secondaryTruckCode,
  secondaryTrucksForPrimary,
  sortJourneyTrucks,
  startPrimaryEntries,
  startPrimaryTrucks,
} from "@/lib/journey-truck-labels";
import {
  JourneyPointLaneSection,
  JourneyPointLaneSwitcher,
  laneViewShowsClosed,
  laneViewShowsInProgress,
  type JourneyPointLaneView,
} from "@/components/journey-point-lane-toggle";
import { FishQuantityRow } from "@/components/fish-quantity-row";
import { NumericFieldInput, QuantityInput } from "@/components/quantity-input";
import { SelectField } from "@/components/select-field";
import { isValidMobile, mobileDigits, MOBILE_DIGITS } from "@/lib/phone";
import { scrollCanvasToTop } from "@/lib/scroll-canvas";
import { FloatingAddButton } from "@/components/floating-add-button";
import {
  truckEndTypeBadgeClass,
  truckEndTypeLabel,
} from "@/lib/journey-end-type-styles";

const generateId = () => Math.random().toString(36).substring(2, 9);

const TRUCK_FIELD_GRID = "grid grid-cols-1 gap-4 sm:grid-cols-2";
const FIELD_CELL = "flex flex-col gap-1 sm:gap-1.5";
const FIELD_LABEL = "label text-xs sm:text-[0.8125rem] transition-colors group-focus-within:text-blue-600";
const FIELD_INPUT =
  "input-field shadow-sm transition-all duration-300 focus:shadow-[0_0_0_3px_rgba(15,76,129,0.1)]";

type Journey = JourneySummary;

type PrimaryLine = {
  key: string;
  truck_id: string;
  end_type: string;
  supplier_id: number;
  fish_id: number;
  fish_type: string;
  seed_size: string | null;
  available: number;
};

type SecondaryTruck = {
  id: string;
  primary_truck_id: string;
  transporter_id: number | null;
  vehicle_number: string;
  driver_name: string;
  driver_phone: string;
  odometer_reading: number | "";
  photoName: string | null;
  existingOdometerImagePath?: string | null;
  allocations: Record<string, number | "">;
};

type TransferDraft = {
  transfer_location_name: string;
  transfer_district_id: number | null;
  arrivals: Record<
    string,
    { odometer_reading: number | ""; photoName: string | null; existingOdometerImagePath?: string | null }
  >;
  remainders: Record<string, number | "">;
  secondariesByPrimary: Record<string, SecondaryTruck[]>;
  /** User opened Start transfer / Continue transfer for this journey */
  markArrivalStarted?: boolean;
  /** Snapshot of fish lines (starting inventory) so edit still works after transfer save */
  inventoryLines?: PrimaryLine[];
};

function photoLabelFromStoragePath(path: string | null | undefined) {
  if (!path) return null;
  const name = path.split("/").pop();
  return name ?? "Saved photo";
}

function resolvePrimaryLineInventory(fresh: PrimaryLine[], cached?: PrimaryLine[]): PrimaryLine[] {
  if (!cached?.length) return fresh;
  const map = new Map<string, PrimaryLine>();
  for (const line of cached) map.set(line.key, line);
  for (const line of fresh) {
    const previous = map.get(line.key);
    map.set(line.key, {
      ...line,
      available: Math.max(line.available, previous?.available ?? 0),
      fish_type: line.fish_type || previous?.fish_type || "Fish",
      seed_size: line.seed_size ?? previous?.seed_size ?? null,
    });
  }
  return Array.from(map.values());
}

/** Per start-primary fish lines. `available` = starting-point total (for secondaries / remainders). */
function buildPrimaryLines(journey: Journey): PrimaryLine[] {
  const lines: PrimaryLine[] = [];
  const recorded = hasPersistedTransferRecording(journey);

  for (const truck of startPrimaryTrucks(journey)) {
    if (!truck.id) continue;

    type Row = {
      supplier_id: number;
      fish_id: number;
      fish_type: string;
      seed_size: string | null;
      total: number;
    };
    const byFish = new Map<string, Row>();

    const addItem = (item: any, qty: number) => {
      if (!item?.supplier_id || !item?.fish_id) return;
      const fk = `${item.supplier_id}-${item.fish_id}`;
      const row = byFish.get(fk) ?? {
        supplier_id: item.supplier_id,
        fish_id: item.fish_id,
        fish_type: item.fish?.fish_type ?? "Fish",
        seed_size: item.fish?.seed_size ?? null,
        total: 0,
      };
      row.total += qty;
      byFish.set(fk, row);
    };

    for (const item of truck.items ?? []) addItem(item, Number(item.quantity) || 0);
    if (recorded) {
      for (const secondary of secondaryTrucksForPrimary(journey, truck.id)) {
        for (const item of secondary.items ?? []) addItem(item, Number(item.quantity) || 0);
      }
    }

    for (const row of byFish.values()) {
      lines.push({
        key: `${truck.id}-${row.supplier_id}-${row.fish_id}`,
        truck_id: truck.id,
        end_type: truck.end_type,
        supplier_id: row.supplier_id,
        fish_id: row.fish_id,
        fish_type: row.fish_type,
        seed_size: row.seed_size,
        available: row.total,
      });
    }
  }

  return lines;
}

function draftFromRecordedTransfer(journey: Journey, primaryLines: PrimaryLine[]): TransferDraft {
  const base = createDraft(journey, primaryLines);
  const transferTrucks = sortJourneyTrucks(journey).filter((truck) => isSecondaryTruck(journey, truck));
  const anchor = transferTrucks[0];

  const arrivals = { ...base.arrivals };
  for (const truck of startPrimaryTrucks(journey)) {
    if (!truck.id) continue;
    const imagePath = (truck.transfer_odometer_image_path ?? (isTransferPointOdometerPath(truck.odometer_image_path as string | undefined) ? truck.odometer_image_path : null)) as string | null | undefined;
    const reading = truck.transfer_odometer_reading ?? (isTransferPointOdometerPath(truck.odometer_image_path as string | undefined) ? truck.odometer_reading : null);
    if (!imagePath && (reading === null || reading === undefined || reading === "")) {
      arrivals[truck.id] = { odometer_reading: "", photoName: null };
      continue;
    }
    arrivals[truck.id] = {
      odometer_reading: reading === null || reading === undefined || reading === "" ? "" : Number(reading),
      photoName: photoLabelFromStoragePath(imagePath),
      existingOdometerImagePath: imagePath ?? null,
    };
  }

  const remainders = { ...base.remainders };
  for (const line of primaryLines) {
    if (line.end_type !== "FINAL_POINT") continue;
    const primary = startPrimaryTrucks(journey).find((truck) => truck.id === line.truck_id);
    const item = primary?.items?.find(
      (row: any) => row.supplier_id === line.supplier_id && row.fish_id === line.fish_id,
    );
    // After transfer save, primary truck_items hold remainder qty only — not start totals.
    remainders[line.key] = item ? Number(item.quantity) || "" : "";
  }

  const secondariesByPrimary = { ...base.secondariesByPrimary };
  for (const { truck: primary } of startPrimaryEntries(journey)) {
    const lines = linesForPrimary(primaryLines, primary.id);
    secondariesByPrimary[primary.id] = secondaryTrucksForPrimary(journey, primary.id).map((secondary) => {
      const allocations = emptyAllocations(lines);
      for (const item of secondary.items ?? []) {
        const key = `${primary.id}-${item.supplier_id}-${item.fish_id}`;
        if (key in allocations) allocations[key] = Number(item.quantity) || 0;
      }
      const secOdoPath = secondary.transfer_odometer_image_path ?? secondary.odometer_image_path;
      const secOdoReading = secondary.transfer_odometer_reading ?? secondary.odometer_reading;
      return {
        id: secondary.id,
        primary_truck_id: primary.id,
        transporter_id: secondary.transporter_id ?? null,
        vehicle_number: secondary.vehicle_number ?? "",
        driver_name: secondary.driver_name ?? "",
        driver_phone: secondary.driver_phone ?? "",
        odometer_reading:
          secOdoReading === null || secOdoReading === undefined || secOdoReading === ""
            ? ""
            : Number(secOdoReading),
        photoName: photoLabelFromStoragePath(secOdoPath),
        existingOdometerImagePath: secOdoPath ?? null,
        allocations,
      };
    });
  }

  return {
    ...base,
    transfer_location_name: anchor?.location_name ?? "",
    transfer_district_id: anchor?.district_id ?? base.transfer_district_id,
    arrivals,
    remainders,
    secondariesByPrimary,
    markArrivalStarted: true,
  };
}

function emptyAllocations(lines: PrimaryLine[]): Record<string, number | ""> {
  return Object.fromEntries(lines.map((line) => [line.key, ""]));
}

function startTruckAt(journey: Journey, truckId: string) {
  return (journey.trucks ?? []).find((truck) => truck.id === truckId);
}

function linesForPrimary(primaryLines: PrimaryLine[], primaryTruckId: string) {
  return primaryLines.filter((line) => line.truck_id === primaryTruckId);
}

function FormSectionHeader({ title, icon }: { title: string; icon: ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-600">{icon}</div>
      <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">{title}</h3>
    </div>
  );
}

function FormErrorModal({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onDismiss();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onDismiss]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="transfer-form-error-title"
      onClick={onDismiss}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-red-100 bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="transfer-form-error-title" className="mb-2 text-lg font-bold text-gray-900">
          Could not save transfer
        </h3>
        <p className="mb-6 text-sm leading-relaxed text-red-700">{message}</p>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-xl bg-red-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

function defaultSecondary(primaryTruckId: string, lines: PrimaryLine[]): SecondaryTruck {
  return {
    id: generateId(),
    primary_truck_id: primaryTruckId,
    transporter_id: null,
    vehicle_number: "",
    driver_name: "",
    driver_phone: "",
    odometer_reading: "",
    photoName: null,
    allocations: emptyAllocations(lines),
  };
}

function hasTransferOdometerCapture(
  arrival: { photoName: string | null; existingOdometerImagePath?: string | null },
) {
  return Boolean(arrival.photoName?.trim() || arrival.existingOdometerImagePath);
}

function isPrimaryTransferSlideComplete(
  arrival: { odometer_reading: number | ""; photoName: string | null; existingOdometerImagePath?: string | null },
  isTransfer: boolean,
  lines: PrimaryLine[],
  remainders: Record<string, number | "">,
) {
  if (arrival.odometer_reading === "") return false;
  if (!hasTransferOdometerCapture(arrival)) return false;
  if (isTransfer) return true;
  for (const line of lines) {
    const qty = remainders[line.key];
    if (qty === "" || Number(qty) < 0) return false;
  }
  return true;
}

function isSecondaryTransferSlideComplete(secondary: SecondaryTruck, lines: PrimaryLine[]) {
  const loaded = lines.some((line) => {
    const qty = secondary.allocations[line.key];
    return qty !== "" && Number(qty) > 0;
  });
  if (!loaded) return false;
  if (!secondary.transporter_id) return false;
  if (!secondary.vehicle_number.trim()) return false;
  if (!secondary.driver_name.trim()) return false;
  if (!isValidMobile(secondary.driver_phone)) return false;
  if (secondary.odometer_reading === "") return false;
  if (!secondary.photoName && !secondary.existingOdometerImagePath) return false;
  return true;
}

function createDraft(journey: Journey, primaryLines: PrimaryLine[]): TransferDraft {
  const transferPrimary = (journey.trucks ?? []).find((truck) => truck.end_type === "TRANSFER_POINT");
  const anchor = transferPrimary ?? journey.trucks?.[0];
  const arrivals: TransferDraft["arrivals"] = {};
  const remainders: TransferDraft["remainders"] = {};

  for (const truck of startPrimaryTrucks(journey)) {
    if (!truck.id) continue;
    arrivals[truck.id] = { odometer_reading: "", photoName: null };
  }

  for (const line of primaryLines) {
    remainders[line.key] = "";
  }

  const secondariesByPrimary: TransferDraft["secondariesByPrimary"] = {};
  for (const truck of startPrimaryTrucks(journey)) {
    if (truck.id) secondariesByPrimary[truck.id] = [];
  }

  return {
    transfer_location_name: "",
    transfer_district_id: anchor?.district_id ?? null,
    arrivals,
    remainders,
    secondariesByPrimary,
  };
}

const TRANSFER_DRAFTS_STORAGE_KEY = "transfer_drafts";

function readStoredTransferDrafts(): Record<string, TransferDraft> {
  try {
    const raw = localStorage.getItem(TRANSFER_DRAFTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, TransferDraft>;
    }
  } catch {
    /* ignore corrupt storage */
  }
  return {};
}

function transferSubmitted(journey: Journey): boolean {
  return hasPersistedTransferRecording(journey);
}

function transferInProgress(journey: Journey, draft?: TransferDraft): boolean {
  if (transferSubmitted(journey)) return false;
  if (!draft) return false;
  if (draft.markArrivalStarted) return true;

  if (Object.values(draft.secondariesByPrimary).some((secondaries) => secondaries.length > 0)) return true;

  for (const truck of journey.trucks ?? []) {
    if (!truck.id) continue;
    const arrival = draft.arrivals[truck.id];
    if (!arrival) continue;
    if (arrival.photoName) return true;
    if (arrival.odometer_reading !== "" && arrival.odometer_reading != null) return true;
  }

  return Object.values(draft.remainders).some((value) => value !== "" && value !== 0);
}

function mergeTransferDraft(journey: Journey, primaryLines: PrimaryLine[], saved?: TransferDraft | null): TransferDraft {
  const base = createDraft(journey, primaryLines);
  if (!saved) return base;

  const truckIds = new Set((journey.trucks ?? []).map((truck) => truck.id).filter(Boolean));

  const arrivals = { ...base.arrivals };
  for (const [truckId, arrival] of Object.entries(saved.arrivals ?? {})) {
    if (!truckIds.has(truckId)) continue;
    const path = arrival.existingOdometerImagePath;
    if (path && !isTransferPointOdometerPath(path)) {
      arrivals[truckId] = { odometer_reading: "", photoName: null };
      continue;
    }
    arrivals[truckId] = arrival;
  }

  const remainders = { ...base.remainders };
  for (const [key, value] of Object.entries(saved.remainders ?? {})) {
    if (key in base.remainders) remainders[key] = value;
  }

  const secondariesByPrimary = { ...base.secondariesByPrimary };
  for (const [primaryId, secondaries] of Object.entries(saved.secondariesByPrimary ?? {})) {
    if (!truckIds.has(primaryId)) continue;
    const lines = linesForPrimary(primaryLines, primaryId);
    secondariesByPrimary[primaryId] = (secondaries ?? []).map((truck) => ({
      ...truck,
      primary_truck_id: primaryId,
      allocations: { ...emptyAllocations(lines), ...(truck.allocations ?? {}) },
    }));
  }

  return {
    ...base,
    transfer_location_name: saved.transfer_location_name ?? "",
    transfer_district_id: saved.transfer_district_id ?? base.transfer_district_id,
    arrivals,
    remainders,
    secondariesByPrimary,
    markArrivalStarted: saved.markArrivalStarted === true,
  };
}

function GovernmentDetailsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M2 16s9-15 20-4C11 23 2 8 2 8" />
    </svg>
  );
}

function groupLinesBySupplier(lines: PrimaryLine[]) {
  const order: number[] = [];
  const map = new Map<number, PrimaryLine[]>();
  for (const line of lines) {
    if (!map.has(line.supplier_id)) order.push(line.supplier_id);
    const list = map.get(line.supplier_id) ?? [];
    list.push(line);
    map.set(line.supplier_id, list);
  }
  return order.map((supplier_id) => ({
    supplier_id,
    lines: map.get(supplier_id) ?? [],
  }));
}

function GovernmentDetailsSection({
  lines,
  children,
}: {
  lines: PrimaryLine[];
  children: (group: { supplier_id: number; lines: PrimaryLine[] }) => ReactNode;
}) {
  if (lines.length === 0) return null;
  const groups = groupLinesBySupplier(lines);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex items-center border-b border-gray-100 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-rose-50 text-rose-600">
            <GovernmentDetailsIcon />
          </div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">Government quantity details</h3>
        </div>
      </div>
      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.supplier_id}>{children(group)}</div>
        ))}
      </div>
    </div>
  );
}

function FishQuantitiesIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5"
    >
      <line x1="4" x2="20" y1="9" y2="9" />
      <line x1="4" x2="20" y1="15" y2="15" />
      <line x1="10" x2="8" y1="3" y2="21" />
      <line x1="16" x2="14" y1="3" y2="21" />
    </svg>
  );
}

function FishQuantitiesPanel({
  title,
  totalQuantity,
  children,
}: {
  title: string;
  totalQuantity: number;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-rose-100/50 bg-rose-50/30 p-3 sm:space-y-4 sm:p-4">
      <h4 className="flex items-center justify-between gap-3 text-[0.7rem] font-bold uppercase tracking-widest text-rose-700 sm:text-xs">
        <span className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <FishQuantitiesIcon />
          {title}
        </span>
        <span className="shrink-0 normal-case tracking-normal text-rose-800/90">
          Total quantity <span className="tabular-nums font-extrabold">{totalQuantity.toLocaleString()}</span>
        </span>
      </h4>
      <div className="grid gap-2.5 sm:gap-3">{children}</div>
    </div>
  );
}

function SecondaryTruckPanel({
  journeyNumber,
  primaryNumber,
  secondary,
  secondaryIndex,
  lines,
  transporters,
  onRemove,
  onUpdateSecondary,
  onUpdateAllocation,
  registerOdometerFile,
}: {
  journeyNumber: number;
  primaryNumber: number;
  secondary: SecondaryTruck;
  secondaryIndex: number;
  lines: PrimaryLine[];
  transporters: VendorRow[];
  onRemove: () => void;
  onUpdateSecondary: (patch: Partial<SecondaryTruck>) => void;
  onUpdateAllocation: (lineKey: string, value: number | "") => void;
  registerOdometerFile: (fieldName: string, file: File | null) => void;
}) {
  const code = secondaryTruckCode(primaryNumber, secondaryIndex);
  const secondaryLoaded = lines.some((line) => {
    const qty = secondary.allocations[line.key];
    return qty !== "" && Number(qty) > 0;
  });

  return (
    <section className="relative overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm sm:rounded-2xl">
      <div className="relative flex items-center justify-between border-b border-gray-100 bg-gradient-to-r from-gray-50/80 to-white px-4 py-3 sm:px-5">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-blue-300" />
        <div className="flex min-w-0 items-center gap-2 pl-2 sm:gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 sm:h-8 sm:w-8">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <rect x="1" y="3" width="15" height="13" />
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          </span>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold bg-gradient-to-r from-blue-900 to-blue-600 bg-clip-text text-transparent sm:text-xl">
              Secondary Truck {code}
            </h2>
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-widest ${truckEndTypeBadgeClass("FINAL_POINT")}`}
            >
              {truckEndTypeLabel("FINAL_POINT")}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="flex shrink-0 items-center gap-1 rounded-full bg-red-50 px-2 py-1.5 text-xs font-semibold text-red-500 transition-colors hover:bg-red-100 hover:text-red-700 sm:px-3"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          <span className="hidden sm:inline">Remove</span>
        </button>
      </div>

      <div className="space-y-6 p-4 sm:space-y-8 sm:p-5">
                    <div className="space-y-4">
                      <FormSectionHeader
                        title="Transporter details"
                        icon={
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
                            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                        }
                      />
                      <div className={TRUCK_FIELD_GRID}>
                        <div className={`${FIELD_CELL} group`}>
                          <span className={FIELD_LABEL}>Transporter</span>
                          <div className="rounded-xl transition-all duration-300 group-focus-within:shadow-[0_0_0_3px_rgba(15,76,129,0.1)]">
                            <SelectField
                              key={`transporter_${secondary.id}`}
                              name={`transporter_${secondary.id}`}
                              required={secondaryLoaded}
                              defaultValue={secondary.transporter_id?.toString() ?? ""}
                              onChange={(value) => onUpdateSecondary({ transporter_id: Number(value) })}
                              placeholder="Select transporter…"
                              options={transporters.map((row) => ({ value: row.id.toString(), label: row.name }))}
                            />
                          </div>
                        </div>
                        <div className={FIELD_CELL}>
                          <span className={FIELD_LABEL}>Vehicle number</span>
                          <input
                            className={`${FIELD_INPUT} h-[38px] min-h-[38px] py-0 uppercase`}
                            required={secondaryLoaded}
                            value={secondary.vehicle_number}
                            onChange={(e) => onUpdateSecondary({ vehicle_number: e.target.value })}
                            placeholder="TS 00 AB 1234"
                          />
                        </div>
                        <div className={FIELD_CELL}>
                          <span className={FIELD_LABEL}>Driver name</span>
                          <input
                            className={`${FIELD_INPUT} h-[38px] min-h-[38px] py-0`}
                            required={secondaryLoaded}
                            value={secondary.driver_name}
                            onChange={(e) => onUpdateSecondary({ driver_name: e.target.value })}
                            placeholder="Enter name"
                          />
                        </div>
                        <div className={FIELD_CELL}>
                          <span className={FIELD_LABEL}>Driver mobile</span>
                          <input
                            className={`${FIELD_INPUT} h-[38px] min-h-[38px] py-0`}
                            type="tel"
                            inputMode="numeric"
                            maxLength={MOBILE_DIGITS}
                            pattern="\d{10}"
                            title="Enter a 10-digit mobile number"
                            required={secondaryLoaded}
                            value={secondary.driver_phone}
                            onChange={(e) => onUpdateSecondary({ driver_phone: mobileDigits(e.target.value) })}
                            placeholder="10-digit number"
                          />
                        </div>
                        <div className={FIELD_CELL}>
                          <span className={FIELD_LABEL}>Odometer reading</span>
                          <NumericFieldInput
                            className={`${FIELD_INPUT} h-[38px] min-h-[38px] py-0`}
                            required={secondaryLoaded}
                            value={secondary.odometer_reading}
                            onChange={(next) => onUpdateSecondary({ odometer_reading: next })}
                            placeholder="Total KM"
                          />
                        </div>
                        <CameraCapture
                          name={`odometer_image_${secondary.id}`}
                          label="Odometer capture"
                          photoName={secondary.photoName}
                          odometerReading={secondary.odometer_reading}
                          existingOdometerImagePath={secondary.existingOdometerImagePath}
                          required={!secondary.photoName && !secondary.existingOdometerImagePath}
                          journeyNumber={journeyNumber}
                          truckSegment={`ST${code}`}
                          pointCode="TP"
                          onName={(name) => onUpdateSecondary({ photoName: name })}
                          onFile={(file) => registerOdometerFile(`odometer_image_${secondary.id}`, file)}
                        />
                      </div>
                    </div>

                    {lines.length > 0 ? (
                      <GovernmentDetailsSection lines={lines}>
                        {(group) => (
                          <FishQuantitiesPanel
                            title="Enter quantities"
                            totalQuantity={group.lines.reduce((sum, line) => {
                              const qty = secondary.allocations[line.key];
                              return sum + (qty === "" ? 0 : Number(qty) || 0);
                            }, 0)}
                          >
                            {group.lines.map((line) => (
                              <FishQuantityRow
                                key={line.key}
                                fishType={line.fish_type}
                                seedSize={line.seed_size}
                                placeholder="Qty"
                                value={secondary.allocations[line.key]}
                                onChange={(value) => onUpdateAllocation(line.key, value)}
                              />
                            ))}
                          </FishQuantitiesPanel>
                        )}
                      </GovernmentDetailsSection>
                    ) : null}
      </div>
    </section>
  );
}

function TransferPrimaryStack({
  journeyNumber,
  primaryNumber,
  truck,
  startTruck,
  primarySelect,
  lines,
  arrival,
  remainders,
  secondaries,
  transporters,
  onArrivalChange,
  onRemainderChange,
  onAddSecondary,
  onRemoveSecondary,
  onUpdateSecondary,
  onUpdateAllocation,
  registerOdometerFile,
}: {
  journeyNumber: number;
  primaryNumber: number;
  truck: { id: string; end_type?: string };
  startTruck: { vehicle_number?: string; transporter?: { name?: string }; driver_name?: string; driver_phone?: string };
  primarySelect?: {
    options: { value: string; label: string }[];
    onChange: (truckId: string) => void;
  };
  lines: PrimaryLine[];
  arrival: { odometer_reading: number | ""; photoName: string | null; existingOdometerImagePath?: string | null };
  remainders: Record<string, number | "">;
  secondaries: SecondaryTruck[];
  transporters: VendorRow[];
  onArrivalChange: (field: "odometer_reading" | "photoName", value: unknown) => void;
  onRemainderChange: (lineKey: string, value: number | "") => void;
  onAddSecondary: () => void;
  onRemoveSecondary: (secondaryId: string) => void;
  onUpdateSecondary: (secondaryId: string, patch: Partial<SecondaryTruck>) => void;
  onUpdateAllocation: (secondaryId: string, lineKey: string, value: number | "") => void;
  registerOdometerFile: (fieldName: string, file: File | null) => void;
}) {
  const endType = truck.end_type ?? "TRANSFER_POINT";
  const isTransfer = endType === "TRANSFER_POINT";
  const primarySlideComplete = isPrimaryTransferSlideComplete(arrival, isTransfer, lines, remainders);
  const allSecondariesComplete = secondaries.every((secondary) =>
    isSecondaryTransferSlideComplete(secondary, lines),
  );
  const canAddSecondary =
    lines.length > 0 && secondaries.length < 6 && primarySlideComplete && allSecondariesComplete;
  const addBlockedReason =
    lines.length === 0
      ? "No fish on this primary — add quantities at starting point first"
      : secondaries.length >= 6
        ? "Maximum loaded trucks reached"
        : !primarySlideComplete || !allSecondariesComplete
          ? "Fill current truck details completely to add another"
          : null;

  const slideCount = 1 + secondaries.length;
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollToIndexRef = useRef<number | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const prevSecondaryCountRef = useRef(secondaries.length);

  const scrollToSlide = (index: number, behavior: ScrollBehavior = "smooth") => {
    const container = containerRef.current;
    if (!container) return;
    const card = container.children[index] as HTMLElement | undefined;
    if (!card) return;
    container.scrollTo({ left: card.offsetLeft, behavior });
    setActiveSlide(index);
  };

  const scrollSlide = (dir: "left" | "right") => {
    const nextIndex = dir === "left" ? activeSlide - 1 : activeSlide + 1;
    if (nextIndex < 0 || nextIndex >= slideCount) return;
    scrollToSlide(nextIndex);
  };

  const handleCarouselScroll = (event: UIEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    const cards = Array.from(container.children) as HTMLElement[];
    if (cards.length === 0) return;
    const scrollLeft = container.scrollLeft;
    let index = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < cards.length; i++) {
      const distance = Math.abs(cards[i]!.offsetLeft - scrollLeft);
      if (distance < bestDistance) {
        bestDistance = distance;
        index = i;
      }
    }
    if (index !== activeSlide) setActiveSlide(index);
  };

  useEffect(() => {
    setActiveSlide((index) => Math.min(index, Math.max(0, slideCount - 1)));
  }, [slideCount, truck.id]);

  useEffect(() => {
    if (secondaries.length > prevSecondaryCountRef.current) {
      scrollToIndexRef.current = secondaries.length;
    } else if (secondaries.length < prevSecondaryCountRef.current) {
      setActiveSlide((index) => {
        const next = Math.min(index, slideCount - 1);
        scrollToIndexRef.current = next;
        return next;
      });
    }
    prevSecondaryCountRef.current = secondaries.length;
  }, [secondaries.length, slideCount]);

  useEffect(() => {
    const index = scrollToIndexRef.current;
    if (index === null) return;
    scrollToIndexRef.current = null;
    requestAnimationFrame(() => scrollToSlide(index));
  }, [secondaries.length]);

  return (
    <div className="relative group/carousel space-y-4">
      {primarySelect && primarySelect.options.length > 1 ? (
        <label className="flex w-full min-h-[2.375rem] items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-4 py-1 shadow-sm transition-[border-color,box-shadow] focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-500/15 max-md:sticky max-md:top-0 max-md:z-20">
          <span className="shrink-0 text-sm font-medium text-purple-800">Select division</span>
          <span className="mx-1 h-3.5 w-px shrink-0 bg-purple-200/80" aria-hidden />
          <SelectField
            key={`${truck.id}:primary-select`}
            compact
            integrated
            placeholder="Division"
            defaultValue={truck.id}
            options={primarySelect.options}
            onChange={primarySelect.onChange}
          />
        </label>
      ) : null}

      <div className="flex items-center justify-center px-2 sm:px-4 md:justify-between">
        <div className="hidden w-8 md:block" aria-hidden />
        
        <div className="flex items-center justify-center">
          {slideCount > 1 && (
            <button
              type="button"
              onClick={() => scrollSlide("left")}
              disabled={activeSlide === 0}
              className="p-1.5 rounded-full bg-white border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-200 shadow-sm transition-all disabled:opacity-30 disabled:hover:border-gray-200 disabled:hover:text-gray-500"
              aria-label="Previous truck"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 sm:h-4.5 sm:w-4.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
          )}
          
          <h3 className="mx-2 shrink-0 whitespace-nowrap text-xs font-bold uppercase tracking-wide text-gray-500 sm:mx-4 sm:text-sm sm:tracking-widest">
            Transfer Point Trucks
            {slideCount > 1 ? (
              <span className="font-medium text-gray-400"> ({activeSlide + 1}/{slideCount})</span>
            ) : null}
          </h3>

          {slideCount > 1 && (
            <button
              type="button"
              onClick={() => scrollSlide("right")}
              disabled={activeSlide === slideCount - 1}
              className="p-1.5 rounded-full bg-white border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-200 shadow-sm transition-all disabled:opacity-30 disabled:hover:border-gray-200 disabled:hover:text-gray-500"
              aria-label="Next truck"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 sm:h-4.5 sm:w-4.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
          )}
        </div>

        <div className="hidden w-8 justify-end md:flex">
          <button
            type="button"
            onClick={onAddSecondary}
            disabled={!canAddSecondary}
            title={canAddSecondary ? "Add secondary truck" : addBlockedReason ?? "Cannot add secondary truck"}
            className="rounded-full border border-blue-100 bg-blue-50 p-1.5 text-blue-600 shadow-sm transition-all hover:bg-blue-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-blue-50 disabled:hover:text-blue-600"
            aria-label="Add secondary truck"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        onScroll={handleCarouselScroll}
        className="flex w-full gap-4 overflow-x-auto snap-x snap-mandatory hide-scrollbar pb-4"
      >
        <div key={`primary-${truck.id}`} className="w-full min-w-full flex-[0_0_100%] snap-center">
          <section className="relative overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm sm:rounded-2xl">
            <div className="relative flex items-center gap-2 border-b border-gray-100 bg-gradient-to-r from-gray-50/80 to-white px-4 py-3 sm:gap-3 sm:px-5">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-blue-300" />
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 sm:ml-2 sm:h-8 sm:w-8">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <rect x="1" y="3" width="15" height="13" />
                  <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                  <circle cx="5.5" cy="18.5" r="2.5" />
                  <circle cx="18.5" cy="18.5" r="2.5" />
                </svg>
              </span>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold bg-gradient-to-r from-blue-900 to-blue-600 bg-clip-text text-transparent sm:text-xl">
                  Primary Truck {primaryNumber}
                </h2>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-widest ${truckEndTypeBadgeClass(endType)}`}
                >
                  {truckEndTypeLabel(endType)}
                </span>
              </div>
            </div>

            <div className="space-y-6 p-4 sm:space-y-8 sm:p-5">
              <PrimaryTruckDetails
                journeyNumber={journeyNumber}
                primaryNumber={primaryNumber}
                truck={startTruck}
                truckId={truck.id}
                arrival={arrival}
                onArrivalChange={onArrivalChange}
                registerOdometerFile={registerOdometerFile}
              />

              {lines.length > 0 ? (
                <GovernmentDetailsSection lines={lines}>
                  {(group) => (
                    <FishQuantitiesPanel
                      title="Enter quantities"
                      totalQuantity={
                        isTransfer
                          ? 0
                          : group.lines.reduce((sum, line) => {
                              const qty = remainders[line.key];
                              return sum + (qty === "" ? 0 : Number(qty) || 0);
                            }, 0)
                      }
                    >
                      {group.lines.map((line) => (
                        <FishQuantityRow
                          key={line.key}
                          fishType={line.fish_type}
                          seedSize={line.seed_size}
                          value={isTransfer ? 0 : remainders[line.key]}
                          readOnly={isTransfer}
                          onChange={
                            isTransfer ? undefined : (value) => onRemainderChange(line.key, value)
                          }
                        />
                      ))}
                    </FishQuantitiesPanel>
                  )}
                </GovernmentDetailsSection>
              ) : null}

              {lines.length === 0 ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
                  No fish on this primary at starting point. Add quantities on{" "}
                  <span className="font-semibold">Starting Point</span> first.
                </p>
              ) : null}
            </div>
          </section>
        </div>

        {secondaries.map((secondary, secIndex) => (
          <div key={secondary.id} className="w-full min-w-full flex-[0_0_100%] snap-center">
            <SecondaryTruckPanel
              journeyNumber={journeyNumber}
              primaryNumber={primaryNumber}
              secondary={secondary}
              secondaryIndex={secIndex}
              lines={lines}
              transporters={transporters}
              onRemove={() => onRemoveSecondary(secondary.id)}
              onUpdateSecondary={(patch) => onUpdateSecondary(secondary.id, patch)}
              onUpdateAllocation={(lineKey, value) => onUpdateAllocation(secondary.id, lineKey, value)}
              registerOdometerFile={registerOdometerFile}
            />
          </div>
        ))}
      </div>
      <FloatingAddButton
        onClick={onAddSecondary}
        disabled={!canAddSecondary}
        title={canAddSecondary ? "Add secondary truck" : addBlockedReason ?? "Cannot add secondary truck"}
        ariaLabel="Add secondary truck"
      />
    </div>
  );
}

function ReadOnlyField({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={FIELD_CELL}>
      <span className={FIELD_LABEL}>{label}</span>
      <input
        readOnly
        tabIndex={-1}
        value={value || "—"}
        className={`${FIELD_INPUT} h-[38px] min-h-[38px] cursor-default bg-gray-50/90 py-0 focus:shadow-none ${className ?? ""}`}
      />
    </div>
  );
}

function PrimaryTruckDetails({
  journeyNumber,
  primaryNumber,
  truck,
  truckId,
  arrival,
  onArrivalChange,
  registerOdometerFile,
}: {
  journeyNumber: number;
  primaryNumber: number;
  truck: any;
  truckId: string;
  arrival: { odometer_reading: number | ""; photoName: string | null; existingOdometerImagePath?: string | null };
  onArrivalChange: (field: "odometer_reading" | "photoName", value: unknown) => void;
  registerOdometerFile: (fieldName: string, file: File | null) => void;
}) {
  const transporterName = truck.transporter?.name?.trim() || "—";
  return (
    <div className="space-y-4">
      <FormSectionHeader
        title="Transporter details"
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        }
      />
      <div className={TRUCK_FIELD_GRID}>
        <ReadOnlyField label="Transporter" value={transporterName} />
        <ReadOnlyField label="Vehicle number" value={truck.vehicle_number ?? ""} className="uppercase" />
        <ReadOnlyField label="Driver name" value={truck.driver_name ?? ""} />
        <ReadOnlyField label="Driver mobile" value={truck.driver_phone ?? ""} />
        <div className={FIELD_CELL}>
          <span className={FIELD_LABEL}>Odometer reading</span>
          <NumericFieldInput
            className={`${FIELD_INPUT} h-[38px] min-h-[38px] py-0`}
            required
            placeholder="Total KM"
            value={arrival.odometer_reading}
            onChange={(next) => onArrivalChange("odometer_reading", next)}
          />
        </div>
        <CameraCapture
          name={`arrival_image_${truckId}`}
          label="Odometer capture"
          photoName={arrival.photoName}
          odometerReading={arrival.odometer_reading}
          existingOdometerImagePath={arrival.existingOdometerImagePath}
          required={!arrival.photoName && !arrival.existingOdometerImagePath}
          journeyNumber={journeyNumber}
          truckSegment={`PT${primaryNumber}`}
          pointCode="TP"
          onName={(name) => onArrivalChange("photoName", name)}
          onFile={(file) => registerOdometerFile(`arrival_image_${truckId}`, file)}
        />
      </div>
    </div>
  );
}

function CameraCapture({
  name,
  label,
  required = true,
  photoName = null,
  odometerReading,
  existingOdometerImagePath,
  journeyNumber,
  truckSegment,
  vehicleNumber,
  pointCode,
  onName,
  onFile,
}: {
  name: string;
  label: string;
  required?: boolean;
  photoName?: string | null;
  odometerReading?: number | string | "";
  existingOdometerImagePath?: string | null;
  journeyNumber?: number | string | null;
  truckSegment?: string | null;
  vehicleNumber?: string | null;
  pointCode?: "SP" | "TP" | "FP" | null;
  onName?: (name: string | null) => void;
  onFile?: (file: File | null) => void;
}) {
  const [compressing, setCompressing] = useState(false);
  const captured = Boolean(photoName || existingOdometerImagePath);
  const displayLabel = formatOdometerDisplayLabel({
    photoName,
    existingPath: existingOdometerImagePath,
    journeyNumber,
    truckSegment,
    pointCode,
  });

  return (
    <div className={`${FIELD_CELL} group`}>
      <span className={`${FIELD_LABEL} group-focus-within:text-blue-600`}>
        {label} <span className="text-negative">*</span>
      </span>
      <div
        className={`relative flex h-[38px] min-h-[38px] cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed px-3 transition-colors ${
          compressing
            ? "border-blue-400 bg-blue-50/50"
            : captured
              ? "border-green-400 bg-green-50/50 hover:bg-green-50/70"
              : "border-amber-200 bg-amber-50/30 hover:bg-amber-50"
        }`}
      >
        <input
          key={name}
          name={name}
          type="file"
          accept="image/*"
          capture="environment"
          disabled={compressing}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          onChange={(e) => {
            const raw = e.target.files?.[0] ?? null;
            if (!raw) {
              onName?.(null);
              onFile?.(null);
              return;
            }
            setCompressing(true);
            void compressOdometerPhotoClient(raw)
              .then((file) => {
                onName?.(file.name);
                onFile?.(file);
              })
              .finally(() => {
                setCompressing(false);
              });
          }}
        />
        {compressing ? (
          <svg className="h-4 w-4 animate-spin text-blue-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : captured ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4 shrink-0 text-green-600">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-amber-600">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        )}
        <span className={`truncate text-sm font-semibold ${compressing ? "text-blue-600" : captured ? "text-green-700" : "text-amber-600"}`}>
          {compressing ? "Processing photo…" : (displayLabel ?? "Open Camera")}
        </span>
      </div>
    </div>
  );
}

function TransferJourneyForm({
  journey,
  draft,
  primaryLines,
  onDraftChange,
  transporters,
  onCancel,
  onSubmitSuccess,
}: {
  journey: Journey;
  draft: TransferDraft;
  primaryLines: PrimaryLine[];
  onDraftChange: (next: TransferDraft) => void;
  transporters: VendorRow[];
  onCancel: () => void;
  onSubmitSuccess: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(recordTransfer, null);
  const odometerFilesRef = useRef(new Map<string, File>());
  const allPrimaries = startPrimaryEntries(journey);
  const [activePrimary, setActivePrimary] = useState(0);

  useEffect(() => {
    if (activePrimary >= allPrimaries.length && allPrimaries.length > 0) {
      setActivePrimary(allPrimaries.length - 1);
    }
  }, [activePrimary, allPrimaries.length]);

  const registerOdometerFile = (fieldName: string, file: File | null) => {
    if (file) odometerFilesRef.current.set(fieldName, file);
    else odometerFilesRef.current.delete(fieldName);
  };

  const hasOdometerCapture = (
    fieldName: string,
    form: HTMLFormElement,
    existingPath?: string | null,
  ) => {
    if (existingPath) return true;
    if (odometerFilesRef.current.has(fieldName)) return true;
    const input = form.elements.namedItem(fieldName);
    if (input instanceof HTMLInputElement && input.files?.[0] && input.files[0].size > 0) {
      return true;
    }
    return false;
  };

  const payload = useMemo(
    () => ({
      transfer_location_name: draft.transfer_location_name,
      transfer_district_id: draft.transfer_district_id,
      arrivals: Object.fromEntries(
        allPrimaries.map(({ truck }) => {
          const arrival = draft.arrivals[truck.id] ?? { odometer_reading: "", photoName: null };
          return [
            truck.id,
            {
              odometer_reading: arrival.odometer_reading,
              existingOdometerImagePath: arrival.existingOdometerImagePath ?? null,
            },
          ];
        }),
      ),
      primary_items: primaryLines.map((line) => ({
        truck_id: line.truck_id,
        supplier_id: line.supplier_id,
        fish_id: line.fish_id,
        quantity: line.end_type === "FINAL_POINT" ? draft.remainders[line.key] : 0,
      })),
      trucks: Object.entries(draft.secondariesByPrimary).flatMap(([primary_truck_id, secondaries]) =>
        secondaries.map((truck) => ({
          id: truck.id,
          primary_truck_id,
          transporter_id: truck.transporter_id,
          vehicle_number: truck.vehicle_number,
          driver_name: truck.driver_name,
          driver_phone: truck.driver_phone,
          odometer_reading: truck.odometer_reading,
          existingOdometerImagePath: truck.existingOdometerImagePath ?? null,
          items: linesForPrimary(primaryLines, primary_truck_id)
            .map((line) => ({
              supplier_id: line.supplier_id,
              fish_id: line.fish_id,
              quantity: truck.allocations[line.key],
            }))
            .filter((item) => item.quantity !== "" && Number(item.quantity) > 0),
        })),
      ),
    }),
    [allPrimaries, draft, primaryLines],
  );

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (state?.error) setErrorMessage(state.error);
  }, [state?.error]);

  const validateBeforeSubmit = (form: HTMLFormElement): string | null => {
    if (!draft.transfer_location_name.trim()) {
      return "Enter the transfer point location.";
    }

    for (const { truck } of allPrimaries) {
      const label = `Primary Truck ${primaryTruckNumber(journey, truck.id)}`;
      const arrival = draft.arrivals[truck.id];
      if (!arrival || arrival.odometer_reading === "") {
        return `Enter the transfer odometer reading for ${label}.`;
      }
      if (!hasOdometerCapture(`arrival_image_${truck.id}`, form, arrival.existingOdometerImagePath)) {
        return `Odometer capture is required for ${label} at transfer. Re-select the photo if you reloaded the page.`;
      }
    }

    for (const [primaryId, secondaries] of Object.entries(draft.secondariesByPrimary)) {
      const lines = linesForPrimary(primaryLines, primaryId);
      for (const secondary of secondaries) {
        const loaded = lines.some((line) => {
          const qty = secondary.allocations[line.key];
          return qty !== "" && Number(qty) > 0;
        });
        if (!loaded) continue;

        const primaryNum = primaryTruckNumber(journey, primaryId);
        const secondaryLabel = `Secondary truck on Primary Truck ${primaryNum}`;

        if (!secondary.transporter_id) {
          return `Select a transporter for the ${secondaryLabel}.`;
        }
        if (!secondary.vehicle_number.trim()) {
          return `Enter the vehicle number for the ${secondaryLabel}.`;
        }
        if (!secondary.driver_name.trim()) {
          return `Enter the driver name for the ${secondaryLabel}.`;
        }
        if (!isValidMobile(secondary.driver_phone)) {
          return `Enter a 10-digit driver mobile for the ${secondaryLabel}.`;
        }
        if (secondary.odometer_reading === "") {
          return `Enter the odometer reading for the ${secondaryLabel}.`;
        }
        if (!hasOdometerCapture(`odometer_image_${secondary.id}`, form, secondary.existingOdometerImagePath)) {
          return `Odometer capture is required for the ${secondaryLabel}. Re-select the photo if you reloaded the page.`;
        }
      }
    }

    return null;
  };

  useEffect(() => {
    if (state?.success) {
      onSubmitSuccess();
      onCancel();
      startTransition(() => router.refresh());
    }
  }, [state, onCancel, onSubmitSuccess, router]);

  const secondariesFor = (primaryTruckId: string) => draft.secondariesByPrimary[primaryTruckId] ?? [];

  const setSecondariesFor = (primaryTruckId: string, next: SecondaryTruck[]) => {
    onDraftChange({
      ...draft,
      secondariesByPrimary: { ...draft.secondariesByPrimary, [primaryTruckId]: next },
    });
  };

  const updateSecondary = (primaryTruckId: string, truckId: string, patch: Partial<SecondaryTruck>) => {
    setSecondariesFor(
      primaryTruckId,
      secondariesFor(primaryTruckId).map((truck) => (truck.id === truckId ? { ...truck, ...patch } : truck)),
    );
  };

  const updateAllocation = (primaryTruckId: string, truckId: string, lineKey: string, value: number | "") => {
    setSecondariesFor(
      primaryTruckId,
      secondariesFor(primaryTruckId).map((truck) =>
        truck.id === truckId ? { ...truck, allocations: { ...truck.allocations, [lineKey]: value } } : truck,
      ),
    );
  };

  const addSecondary = (primaryTruckId: string) => {
    const lines = linesForPrimary(primaryLines, primaryTruckId);
    if (lines.length === 0) return;
    const list = secondariesFor(primaryTruckId);
    if (list.length >= 6) return;
    const next = defaultSecondary(primaryTruckId, lines);
    setSecondariesFor(primaryTruckId, [...list, next]);
  };

  const removeSecondary = (primaryTruckId: string, truckId: string) => {
    odometerFilesRef.current.delete(`odometer_image_${truckId}`);
    setSecondariesFor(
      primaryTruckId,
      secondariesFor(primaryTruckId).filter((truck) => truck.id !== truckId),
    );
  };

  const updateArrival = (truckId: string, field: "odometer_reading" | "photoName", value: unknown) => {
    onDraftChange({
      ...draft,
      arrivals: {
        ...draft.arrivals,
        [truckId]: { ...draft.arrivals[truckId], [field]: value },
      },
    });
  };

  const updateRemainder = (lineKey: string, value: number | "") => {
    onDraftChange({
      ...draft,
      remainders: { ...draft.remainders, [lineKey]: value },
    });
  };

  const activePrimaryEntry = allPrimaries[activePrimary];

  return (
    <form
      encType="multipart/form-data"
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        setErrorMessage(null);

        const form = event.currentTarget;
        const validationError = validateBeforeSubmit(form);
        if (validationError) {
          setErrorMessage(validationError);
          return;
        }

        if (!form.reportValidity()) {
          setErrorMessage("Fill in all required transporter and truck details before submitting.");
          return;
        }

        const formData = new FormData(form);
        formData.set("payload", JSON.stringify(payload));
        for (const [fieldName, file] of odometerFilesRef.current) {
          formData.set(fieldName, file);
        }
        void submitCompressedFormAction(formData, formAction);
      }}
    >
      <input type="hidden" name="journey_id" value={journey.journeyId} />

      {errorMessage ? <FormErrorModal message={errorMessage} onDismiss={() => setErrorMessage(null)} /> : null}

      <section className="relative overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm sm:rounded-2xl">
        <div className="relative flex items-center border-b border-gray-100 bg-gradient-to-r from-gray-50/80 to-white px-4 py-3 sm:px-5">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-purple-500 to-purple-300" />
          <div className="flex items-center gap-2 pl-2 sm:gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600 sm:h-8 sm:w-8">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <circle cx="12" cy="12" r="10" />
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
              </svg>
            </span>
            <h2 className="text-lg font-bold bg-gradient-to-r from-purple-900 to-purple-600 bg-clip-text text-transparent sm:text-xl">
              Transfer point location
            </h2>
          </div>
        </div>
        <div className="p-4 sm:p-5">
          <label className="block space-y-1 sm:space-y-1.5 group">
            <span className="label text-xs transition-colors group-focus-within:text-purple-600 sm:text-[0.8125rem]">
              Location
            </span>
            <input
              type="text"
              required
              value={draft.transfer_location_name}
              onChange={(e) => onDraftChange({ ...draft, transfer_location_name: e.target.value })}
              placeholder="Enter exact transfer point location"
              className="input-field shadow-sm transition-all duration-300 focus:border-purple-400 focus:shadow-[0_0_0_3px_rgba(168,85,247,0.1)]"
            />
          </label>
        </div>
      </section>

      {allPrimaries.length === 0 ? null : (
        <div className="space-y-4">
          {activePrimaryEntry ? (
            <TransferPrimaryStack
              key={activePrimaryEntry.truck.id}
              journeyNumber={journey.db_id ?? 1}
              primaryNumber={activePrimaryEntry.primaryNumber}
              truck={activePrimaryEntry.truck}
              startTruck={startTruckAt(journey, activePrimaryEntry.truck.id) ?? activePrimaryEntry.truck}
              primarySelect={
                allPrimaries.length > 1
                  ? {
                      options: allPrimaries.map(({ truck, primaryNumber }) => ({
                        value: truck.id,
                        label: `Division ${primaryNumber}`,
                      })),
                      onChange: (truckId) => {
                        const index = allPrimaries.findIndex(({ truck }) => truck.id === truckId);
                        if (index >= 0) setActivePrimary(index);
                      },
                    }
                  : undefined
              }
              lines={linesForPrimary(primaryLines, activePrimaryEntry.truck.id)}
              arrival={
                draft.arrivals[activePrimaryEntry.truck.id] ?? { odometer_reading: "", photoName: null }
              }
              remainders={draft.remainders}
              secondaries={secondariesFor(activePrimaryEntry.truck.id)}
              transporters={transporters}
              onArrivalChange={(field, value) => updateArrival(activePrimaryEntry.truck.id, field, value)}
              onRemainderChange={updateRemainder}
              onAddSecondary={() => addSecondary(activePrimaryEntry.truck.id)}
              onRemoveSecondary={(secondaryId) => removeSecondary(activePrimaryEntry.truck.id, secondaryId)}
              onUpdateSecondary={(secondaryId, patch) =>
                updateSecondary(activePrimaryEntry.truck.id, secondaryId, patch)
              }
              onUpdateAllocation={(secondaryId, lineKey, value) =>
                updateAllocation(activePrimaryEntry.truck.id, secondaryId, lineKey, value)
              }
              registerOdometerFile={registerOdometerFile}
            />
          ) : null}
        </div>
      )}

      <div className="pt-4 sm:pt-6">
        <button
          type="submit"
          disabled={pending}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-blue px-6 py-4 text-base font-bold text-white shadow-lg transition-all hover:bg-blue-dark disabled:opacity-50"
        >
          {pending ? "Saving..." : "Submit Transfer"}
        </button>
      </div>
    </form>
  );
}

export function TransferPointForm({
  activeJourneys,
  transporters,
}: {
  activeJourneys: Journey[];
  transporters: VendorRow[];
  suppliers: VendorRow[];
  fishes: FishRow[];
  districts: DistrictRow[];
}) {
  const [viewState, setViewState] = useState<"list" | "record">("list");
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, TransferDraft>>({});
  const [linesByJourney, setLinesByJourney] = useState<Record<string, PrimaryLine[]>>({});
  const [draftsHydrated, setDraftsHydrated] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [deleteTransferJourneyId, setDeleteTransferJourneyId] = useState<string | null>(null);
  const [isDeletingTransfer, setIsDeletingTransfer] = useState(false);
  const [laneView, setLaneView] = useState<JourneyPointLaneView>("in_progress");
  const router = useRouter();

  const { inProgress: inProgressJourneys, closed: closedJourneys } = splitJourneysByPointLane(
    "transfer",
    activeJourneys,
  );

  useEffect(() => {
    const stored = readStoredTransferDrafts();
    const nextLines: Record<string, PrimaryLine[]> = {};

    setDrafts((prev) => {
      const next = { ...prev };
      for (const journey of activeJourneys) {
        const fresh = buildPrimaryLines(journey);
        const storedDraft = stored[journey.id];
        const primaryLines = resolvePrimaryLineInventory(fresh, storedDraft?.inventoryLines);
        if (primaryLines.length > 0) nextLines[journey.id] = primaryLines;

        if (transferSubmitted(journey)) {
          next[journey.id] = {
            ...draftFromRecordedTransfer(journey, primaryLines),
            inventoryLines: primaryLines,
          };
          continue;
        }
        if (next[journey.id]) {
          next[journey.id] = {
            ...mergeTransferDraft(journey, primaryLines, next[journey.id]),
            inventoryLines: primaryLines.length > 0 ? primaryLines : next[journey.id].inventoryLines,
          };
          continue;
        }
        next[journey.id] = mergeTransferDraft(journey, primaryLines, storedDraft);
        if (primaryLines.length > 0) {
          next[journey.id] = { ...next[journey.id], inventoryLines: primaryLines };
        }
      }
      return next;
    });

    setLinesByJourney((prev) => ({ ...prev, ...nextLines }));
    setDraftsHydrated(true);
  }, [activeJourneys]);

  useEffect(() => {
    if (!draftsHydrated) return;
    const activeIds = new Set(activeJourneys.map((journey) => journey.id));
    const toStore: Record<string, TransferDraft> = {};
    for (const [journeyId, draft] of Object.entries(drafts)) {
      if (activeIds.has(journeyId)) toStore[journeyId] = draft;
    }
    localStorage.setItem(TRANSFER_DRAFTS_STORAGE_KEY, JSON.stringify(toStore));
  }, [drafts, draftsHydrated, activeJourneys]);

  function openRecording(journey: Journey) {
    const stored = readStoredTransferDrafts()[journey.id];
    const fresh = buildPrimaryLines(journey);
    const primaryLines = resolvePrimaryLineInventory(
      fresh,
      stored?.inventoryLines ?? drafts[journey.id]?.inventoryLines,
    );
    setLinesByJourney((prev) => ({ ...prev, [journey.id]: primaryLines }));
    setDrafts((prev) => {
      const base = mergeTransferDraft(journey, primaryLines, prev[journey.id] ?? stored);
      return {
        ...prev,
        [journey.id]: {
          ...base,
          markArrivalStarted: true,
          inventoryLines: primaryLines.length > 0 ? primaryLines : base.inventoryLines,
        },
      };
    });
    setRecordingId(journey.id);
    setViewState("record");
    scrollCanvasToTop();

    if (normalizeJourneyPhase(journey.phase) === JourneyPhase.Start) {
      void startTransfer(journey.journeyId).then((result) => {
        if (!result.success) return;
        startTransition(() => router.refresh());
      });
    }
  }

  function clearDraftForJourney(journeyId: string) {
    setDrafts((prev) => {
      if (!(journeyId in prev)) return prev;
      const next = { ...prev };
      delete next[journeyId];
      return next;
    });
  }

  function closeRecording() {
    setRecordingId(null);
    setViewState("list");
  }

  function handleEditTransfer(journey: Journey) {
    openRecording(journey);
    setOpenDropdownId(null);
  }

  async function confirmDeleteTransfer() {
    if (!deleteTransferJourneyId) return;
    const journey = activeJourneys.find((j) => j.id === deleteTransferJourneyId);
    if (!journey) return;

    setIsDeletingTransfer(true);
    clearDraftForJourney(journey.id);
    const result = await deleteTransferRecording(journey.journeyId);
    setIsDeletingTransfer(false);
    setDeleteTransferJourneyId(null);
    setOpenDropdownId(null);

    if (result?.success) {
      router.refresh();
    }
  }

  const recordingJourney = viewState === "record" ? activeJourneys.find((j) => j.id === recordingId) : null;

  if (viewState === "record" && recordingJourney) {
    const stored = readStoredTransferDrafts()[recordingJourney.id];
    const fresh = buildPrimaryLines(recordingJourney);
    const resolved = resolvePrimaryLineInventory(
      fresh,
      linesByJourney[recordingJourney.id] ??
        drafts[recordingJourney.id]?.inventoryLines ??
        stored?.inventoryLines,
    );
    const primaryLines = resolved;
    const draft =
      drafts[recordingJourney.id] ??
      mergeTransferDraft(recordingJourney, primaryLines, stored);

    return (
      <div className="mx-auto w-full max-w-4xl space-y-6 px-2 pb-20 sm:px-0 sm:pb-12">
        <div className="flex flex-col gap-4 px-1 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3 sm:gap-5">
            <button
              type="button"
              onClick={closeRecording}
              className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-blue-dark shadow-sm transition-all duration-300 hover:border-blue-400 hover:shadow-md sm:h-12 sm:w-12 sm:rounded-2xl"
              aria-label="Back to transfer list"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 transition-transform group-hover:-translate-x-1 sm:h-5 sm:w-5">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-blue-dark sm:text-2xl">Transfer point — Journey #{recordingJourney.db_id}</h1>
              <p className="mt-0.5 text-xs font-medium text-muted sm:text-sm">
                {recordingJourney.startLocation} → {recordingJourney.district}
              </p>
            </div>
          </div>
        </div>

        <TransferJourneyForm
          journey={recordingJourney}
          draft={draft}
          primaryLines={primaryLines}
          onDraftChange={(next) =>
            setDrafts((prev) => ({
              ...prev,
              [recordingJourney.id]: {
                ...next,
                inventoryLines:
                  primaryLines.length > 0 ? primaryLines : next.inventoryLines ?? prev[recordingJourney.id]?.inventoryLines,
              },
            }))
          }
          transporters={transporters}
          onCancel={closeRecording}
          onSubmitSuccess={() => {
            setLinesByJourney((prev) => ({
              ...prev,
              [recordingJourney.id]: primaryLines,
            }));
          }}
        />
      </div>
    );
  }

  const renderTransferJourneyCard = (journey: Journey, closed: boolean) => {
    const needsTransferHub = (journey.trucks ?? []).some(
      (truck) => truck.end_type === "TRANSFER_POINT" || truck.end_type === "FINAL_POINT",
    );
    const hasRecordedTransfer = transferSubmitted(journey);
    const draftStarted = transferInProgress(journey, drafts[journey.id]);

    return (
      <JourneySummaryCard
        key={journey.id}
        journey={journey}
        truckRows={hasRecordedTransfer ? buildTransferSummaryRows(journey) : undefined}
        odometerScope="transfer"
        odometerLabel="Transfer odometer"
        expandedSectionTitle={hasRecordedTransfer ? "Transfer — Full Details" : undefined}
        expanded={expandedIds.has(journey.id)}
        onToggleExpanded={() =>
          setExpandedIds((prev) => {
            const next = new Set(prev);
            next.has(journey.id) ? next.delete(journey.id) : next.add(journey.id);
            return next;
          })
        }
        statusBadge={
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              closed ? "bg-gray-100 text-gray-600" : "bg-green-100 text-green-700"
            }`}
          >
            {journeyPointBadgeLabel("transfer", journey.phase)}
          </span>
        }
        optionsMenu={
          normalizeJourneyPhase(journey.phase) !== JourneyPhase.Transfer ? undefined : (
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenDropdownId(openDropdownId === journey.id ? null : journey.id)}
                className="rounded-full p-1.5 text-blue-600 transition-colors hover:bg-white/50"
                title="Options"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="12" cy="5" r="1" />
                  <circle cx="12" cy="19" r="1" />
                </svg>
              </button>
              {openDropdownId === journey.id ? (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setOpenDropdownId(null)} />
                  <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-lg border border-gray-100 bg-white py-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => handleEditTransfer(journey)}
                      className="w-full px-4 py-2 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-blue-50 hover:text-blue-600"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteTransferJourneyId(journey.id);
                        setOpenDropdownId(null);
                      }}
                      className="w-full px-4 py-2 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          )
        }
        footer={
          needsTransferHub &&
          (normalizeJourneyPhase(journey.phase) === JourneyPhase.Start ||
            normalizeJourneyPhase(journey.phase) === JourneyPhase.Transfer) ? (
            <div className="flex justify-center border-t border-line bg-blue-soft/10 px-5 py-4">
              <button
                type="button"
                onClick={() => openRecording(journey)}
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-blue px-6 py-2.5 text-sm font-semibold text-white shadow-[0_0_40px_-10px_rgba(15,76,129,0.5)] transition-all hover:scale-[1.02] hover:shadow-[0_0_60px_-15px_rgba(15,76,129,0.7)]"
              >
                {hasRecordedTransfer ? "Edit transfer" : draftStarted ? "Continue transfer" : "Start transfer"}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 transition-transform group-hover:translate-x-0.5">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
          ) : undefined
        }
      />
    );
  };

  if (activeJourneys.length === 0) {
    return (
      <section className="surface data-card">
        <p className="px-4 py-8 text-sm text-[var(--text-secondary)]">No journeys on transfer point yet.</p>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      <JourneyPointLaneSwitcher
        value={laneView}
        onChange={setLaneView}
        inProgressCount={inProgressJourneys.length}
        closedCount={closedJourneys.length}
      />

      <JourneyPointLaneSection title="In progress" hidden={!laneViewShowsInProgress(laneView)}>
        {inProgressJourneys.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">No journeys in progress.</p>
        ) : (
          inProgressJourneys.map((journey) => renderTransferJourneyCard(journey, false))
        )}
      </JourneyPointLaneSection>

      <JourneyPointLaneSection title="Closed" hidden={!laneViewShowsClosed(laneView)}>
        {closedJourneys.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">No closed journeys yet.</p>
        ) : (
          closedJourneys.map((journey) => renderTransferJourneyCard(journey, true))
        )}
      </JourneyPointLaneSection>

      {deleteTransferJourneyId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-6 shadow-2xl">
            <h3 className="mb-2 text-xl font-bold text-gray-900">Delete transfer information?</h3>
            <p className="mb-6 text-sm leading-relaxed text-gray-500">
              This clears saved transfer progress for this journey, removes transfer secondary trucks, and resets the
              transfer progress and move the journey back to the starting page. Starting point data is kept.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTransferJourneyId(null)}
                disabled={isDeletingTransfer}
                className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteTransfer}
                disabled={isDeletingTransfer}
                className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-red-600/20 transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {isDeletingTransfer ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
