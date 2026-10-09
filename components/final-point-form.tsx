"use client";

import { useRouter } from "next/navigation";
import {
  useActionState,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  startTransition,
  type ReactNode,
  type UIEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  deleteFinalUnloadRecording,
  recordUnload,
  startFinalUnload,
} from "@/app/(workspace)/final/actions";
import { scrollCanvasToTop } from "@/lib/scroll-canvas";
import { FloatingAddButton } from "@/components/floating-add-button";
import { compressOdometerPhotoClient } from "@/lib/odometer-image-compress.client";
import { submitCompressedFormAction } from "@/lib/submit-compressed-form-action";
import { formDataFile } from "@/lib/odometer-image";
import { formatOdometerDisplayLabel } from "@/lib/odometer-display";
import { FishQuantityRow } from "@/components/fish-quantity-row";
import { NumericFieldInput } from "@/components/quantity-input";
import { JourneySummaryCard } from "@/components/journey-summary-card";
import { SelectField } from "@/components/select-field";
import { trucksForFinalUnload, type JourneySummary } from "@/lib/journey-cards";
import {
  emptyFinalOdometerFields,
  finalOdometerFieldsFromDraft,
  finalOdometerFieldsFromTruck,
} from "@/lib/journey-final-unload-recording";
import {
  buildFinalUnloadSummaryRows,
  journeyUnloadSubmitted,
} from "@/lib/journey-final-unload-summary";
import { finalUnloadTruckLabel, sortJourneyTrucks } from "@/lib/journey-truck-labels";
import { JourneyPhase, normalizeJourneyPhase } from "@/lib/journey-phase";
import { journeyPointBadgeLabel, splitJourneysByPointLane } from "@/lib/journey-point-lanes";
import {
  JourneyPointLaneSection,
  JourneyPointLaneSwitcher,
  laneViewShowsClosed,
  laneViewShowsInProgress,
  type JourneyPointLaneView,
} from "@/components/journey-point-lane-toggle";
import type { DistrictRow } from "@/lib/masters";
import {
  clampUnloadLineQty,
  maxQtyForUnloadLine,
  parseTruckItemKey,
  transferQtyForItemKey,
  truckItemKey,
  validateTruckUnloadQuantities,
} from "@/lib/journey-final-unload-quantity";

const generateId = () => Math.random().toString(36).substring(2, 9);

const TRUCK_FIELD_GRID = "grid grid-cols-1 gap-4 sm:grid-cols-2";
const FIELD_CELL = "flex flex-col gap-1 sm:gap-1.5";
const FIELD_LABEL = "label text-xs sm:text-[0.8125rem] transition-colors group-focus-within:text-blue-600";
const FIELD_INPUT =
  "input-field shadow-sm transition-all duration-300 focus:shadow-[0_0_0_3px_rgba(15,76,129,0.1)]";

type UnloadDropLine = {
  itemKey: string;
  quantity: number | "";
};

type UnloadDrop = {
  id: string;
  society_id: number | null;
  /** Typed society name when not chosen from masters (saved to district on submit). */
  society_name?: string;
  lines: UnloadDropLine[];
  submitted?: boolean;
};

type TruckUnload = {
  drops: UnloadDrop[];
  odometer_reading: number | "";
  photoName: string | null;
  existingOdometerImagePath?: string | null;
};

function photoLabelFromStoragePath(path: string | null | undefined) {
  if (!path) return null;
  const name = path.split("/").pop();
  return name ?? "Saved photo";
}

type UnloadDraft = {
  markUnloadStarted?: boolean;
  trucks: Record<string, TruckUnload>;
};

const UNLOAD_DRAFTS_STORAGE_KEY = "final_unload_drafts";

const itemKey = truckItemKey;
const parseItemKey = parseTruckItemKey;

function truckItems(truck: any) {
  return (truck.items ?? []).filter((item: any) => item.supplier_id && item.fish_id);
}

function truckTotalQty(truck: any) {
  return truckItems(truck).reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0);
}

function truckDroppedQty(drops: UnloadDrop[]) {
  return drops.reduce(
    (sum, drop) =>
      sum + drop.lines.reduce((lineSum, line) => lineSum + (line.quantity === "" ? 0 : Number(line.quantity) || 0), 0),
    0,
  );
}

function normalizeUnloadDrop(raw: unknown): UnloadDrop {
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id : generateId();
  const society_id = typeof row.society_id === "number" ? row.society_id : null;
  const society_name = typeof row.society_name === "string" ? row.society_name.trim() || undefined : undefined;
  const submitted = Boolean(row.submitted);
  if (Array.isArray(row.lines)) {
    const lines = row.lines
      .map((line) => {
        const entry = line as Record<string, unknown>;
        if (typeof entry.itemKey !== "string") return null;
        const quantity = entry.quantity;
        return {
          itemKey: entry.itemKey,
          quantity: quantity === "" || typeof quantity === "number" ? quantity : "",
        } satisfies UnloadDropLine;
      })
      .filter(Boolean) as UnloadDropLine[];
    return { id, society_id, society_name, lines, submitted };
  }
  if (typeof row.itemKey === "string") {
    const quantity = row.quantity;
    return {
      id,
      society_id,
      society_name,
      lines: [{ itemKey: row.itemKey, quantity: quantity === "" || typeof quantity === "number" ? quantity : "" }],
      submitted,
    };
  }
  return { id, society_id, society_name, lines: [], submitted };
}

function truckProgressPercent(truck: any, drops: UnloadDrop[]) {
  const total = truckTotalQty(truck);
  if (total <= 0) return 0;
  return Math.min(100, (truckDroppedQty(drops) / total) * 100);
}

function createUnloadDraft(_journey: JourneySummary): UnloadDraft {
  const trucks: UnloadDraft["trucks"] = {};
  for (const truck of trucksForFinalUnload(_journey.trucks)) {
    if (!truck.id) continue;
    trucks[truck.id] = {
      drops: [],
      ...emptyFinalOdometerFields(),
    };
  }
  return { trucks };
}

function draftFromRecordedUnload(journey: JourneySummary, saved?: UnloadDraft | null): UnloadDraft {
  const trucks: UnloadDraft["trucks"] = {};
  for (const truck of trucksForFinalUnload(journey.trucks)) {
    if (!truck.id) continue;
    const savedTruck = saved?.trucks[truck.id];
    trucks[truck.id] = {
      drops: (savedTruck?.drops ?? []).map((d) => ({
        ...normalizeUnloadDrop(d),
        submitted: true,
      })),
      ...finalOdometerFieldsFromTruck(truck),
    };
  }
  return { trucks, markUnloadStarted: true };
}

function readStoredUnloadDrafts(): Record<string, UnloadDraft> {
  try {
    const raw = localStorage.getItem(UNLOAD_DRAFTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, UnloadDraft>;
    }
  } catch {
    /* ignore */
  }
  return {};
}

function mergeUnloadDraft(journey: JourneySummary, saved?: UnloadDraft | null): UnloadDraft {
  const base = createUnloadDraft(journey);
  if (!saved) return base;
  const trucks = { ...base.trucks };
  for (const truck of trucksForFinalUnload(journey.trucks)) {
    if (!truck.id) continue;
    const savedTruck = saved.trucks[truck.id];
    if (!savedTruck) continue;
    trucks[truck.id] = {
      drops: (savedTruck.drops ?? []).map(normalizeUnloadDrop),
      ...finalOdometerFieldsFromDraft(savedTruck),
    };
  }
  return { trucks, markUnloadStarted: saved.markUnloadStarted === true };
}

function unloadInProgress(journey: JourneySummary, draft?: UnloadDraft): boolean {
  if (normalizeJourneyPhase(journey.phase) === JourneyPhase.Final) return true;
  return draft?.markUnloadStarted === true;
}

function societiesForJourney(districts: DistrictRow[], journey: JourneySummary) {
  const district =
    districts.find((row) => row.id === journey.districtId) ?? districts.find((row) => row.name === journey.district);
  return district?.societies ?? [];
}

function itemLabel(item: any) {
  const fish = item.fish?.fish_type ?? "Fish";
  const size = item.fish?.seed_size ? ` (${item.fish.seed_size})` : "";
  return `${fish}${size}`;
}

function lineDisplay(truck: any, itemKey: string) {
  const { supplier_id, fish_id } = parseItemKey(itemKey);
  const item = truckItems(truck).find((row: any) => row.supplier_id === supplier_id && row.fish_id === fish_id);
  return {
    fishType: item?.fish?.fish_type ?? "Fish",
    seedSize: item?.fish?.seed_size ?? "",
  };
}

function dropHasSociety(drop: UnloadDrop) {
  return Boolean(drop.society_id || drop.society_name?.trim());
}

function dropIsComplete(drop: UnloadDrop) {
  if (!dropHasSociety(drop) || drop.lines.length === 0) return false;
  return drop.lines.every((line) => line.quantity !== "" && Number(line.quantity) > 0);
}

function societyDropAddMeta(truck: any, truckUnload: TruckUnload) {
  const items = truckItems(truck);
  const lastDrop = truckUnload.drops[truckUnload.drops.length - 1];
  const canAddDrop =
    items.length > 0 &&
    (truckUnload.drops.length === 0 || (lastDrop && dropIsComplete(lastDrop) && Boolean(lastDrop.submitted)));
  let title = "Add another society drop";
  if (!canAddDrop) {
    if (lastDrop && !lastDrop.submitted) {
      title = `Submit Society #${truckUnload.drops.length} before adding another`;
    } else {
      title = "Complete current drop (society, fish lines, quantities) to add another";
    }
  }
  return { canAddDrop, title };
}

function societyDisplayText(
  drop: UnloadDrop,
  societies: { id: number; label: string }[],
) {
  if (drop.society_id) {
    return societies.find((row) => row.id === drop.society_id)?.label ?? "";
  }
  return drop.society_name ?? "";
}

function SocietyField({
  societies,
  drop,
  disabled = false,
  onChange,
}: {
  societies: { id: number; label: string }[];
  drop: UnloadDrop;
  disabled?: boolean;
  onChange: (patch: Pick<UnloadDrop, "society_id" | "society_name">) => void;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const [text, setText] = useState(() => societyDisplayText(drop, societies));

  useEffect(() => {
    setText(societyDisplayText(drop, societies));
  }, [drop.id, drop.society_id, drop.society_name, societies]);

  const query = text.trim().toLowerCase();
  const matches =
    query.length === 0
      ? []
      : societies.filter((row) => row.label.toLowerCase().includes(query)).slice(0, 12);

  function placeMenu() {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    setBox({ top: rect.bottom + 6, left: rect.left, width: rect.width });
  }

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }

    placeMenu();
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("resize", placeMenu);
    window.addEventListener("scroll", placeMenu, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("resize", placeMenu);
      window.removeEventListener("scroll", placeMenu, true);
    };
  }, [open, text]);

  function commitValue(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      onChange({ society_id: null, society_name: undefined });
      return;
    }
    const match = societies.find((row) => row.label.toLowerCase() === trimmed.toLowerCase());
    if (match) {
      onChange({ society_id: match.id, society_name: undefined });
      setText(match.label);
      return;
    }
    onChange({ society_id: null, society_name: trimmed });
  }

  function pickSociety(row: { id: number; label: string }) {
    setText(row.label);
    onChange({ society_id: row.id, society_name: undefined });
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        type="text"
        autoComplete="off"
        name={`society_${drop.id}`}
        required
        disabled={disabled}
        className={`${FIELD_INPUT} h-[38px] min-h-[38px] py-0 disabled:bg-gray-100 disabled:text-gray-700 disabled:cursor-not-allowed disabled:border-gray-200`}
        value={text}
        placeholder="Type society name…"
        aria-autocomplete="list"
        aria-controls={matches.length > 0 ? listId : undefined}
        aria-expanded={open && matches.length > 0}
        onChange={(e) => {
          if (disabled) return;
          const next = e.target.value;
          setText(next);
          setOpen(true);
          placeMenu();
          const trimmed = next.trim();
          if (!trimmed) {
            onChange({ society_id: null, society_name: undefined });
            return;
          }
          const exact = societies.find((row) => row.label.toLowerCase() === trimmed.toLowerCase());
          if (exact) {
            onChange({ society_id: exact.id, society_name: undefined });
            return;
          }
          onChange({ society_id: null, society_name: trimmed });
        }}
        onFocus={() => {
          if (disabled) return;
          setOpen(true);
          placeMenu();
        }}
        onBlur={(e) => {
          if (disabled) return;
          window.setTimeout(() => setOpen(false), 120);
          commitValue(e.target.value);
        }}
      />
      {!disabled && open && box && matches.length > 0
        ? createPortal(
            <ul
              ref={menuRef}
              id={listId}
              role="listbox"
              className="select-field-menu is-fixed max-h-60 overflow-auto"
              style={{ top: box.top, left: box.left, width: box.width }}
            >
              {matches.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    role="option"
                    className={drop.society_id === row.id ? "is-selected" : undefined}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickSociety(row)}
                  >
                    {row.label}
                  </button>
                </li>
              ))}
            </ul>,
            document.body,
          )
        : null}
    </div>
  );
}

function FormSectionHeader({ title, icon }: { title: string; icon: ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-600">{icon}</div>
      <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">{title}</h3>
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

function CameraCapture({
  name,
  label,
  required = true,
  photoName = null,
  existingOdometerImagePath,
  journeyNumber,
  truckSegment,
  pointCode,
  onName,
  onFile,
}: {
  name: string;
  label: string;
  required?: boolean;
  photoName?: string | null;
  existingOdometerImagePath?: string | null;
  journeyNumber?: number | string | null;
  truckSegment?: string | null;
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
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0 text-amber-600">
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

function UnloadTruckCard({
  journey,
  truck,
  truckUnload,
  societies,
  onChange,
  registerOdometerFile,
}: {
  journey: JourneySummary;
  truck: any;
  truckUnload: TruckUnload;
  societies: { id: number; label: string }[];
  onChange: (next: TruckUnload) => void;
  registerOdometerFile: (fieldName: string, file: File | null) => void;
}) {
  const truckLabel = finalUnloadTruckLabel(journey, truck.id);
  const transporterName = truck.transporter?.name?.trim() || "—";
  const accentBar = truckLabel.kind === "primary" ? "from-amber-500 to-amber-300" : "from-blue-500 to-blue-300";
  const subtitleClass = truckLabel.kind === "primary" ? "text-amber-700" : "text-gray-500";
  const items = truckItems(truck);
  const progress = truckProgressPercent(truck, truckUnload.drops);
  const complete = progress >= 100;

  const itemOptions = items.map((item: any) => ({
    value: itemKey(item.supplier_id, item.fish_id),
    label: itemLabel(item),
  }));

  const [openMenuDropId, setOpenMenuDropId] = useState<string | null>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenuDropId) return;
    function handlePointerDown(e: MouseEvent) {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setOpenMenuDropId(null);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [openMenuDropId]);

  const addDrop = () => {
    onChange({
      ...truckUnload,
      drops: [...truckUnload.drops, { id: generateId(), society_id: null, lines: [], submitted: false }],
    });
  };

  const updateDrop = (dropId: string, patch: Partial<UnloadDrop>) => {
    onChange({
      ...truckUnload,
      drops: truckUnload.drops.map((drop) => (drop.id === dropId ? { ...drop, ...patch } : drop)),
    });
  };

  const setDropLines = (dropId: string, itemKeys: string[]) => {
    onChange({
      ...truckUnload,
      drops: truckUnload.drops.map((drop) => {
        if (drop.id !== dropId) return drop;
        const lines = itemKeys.map((itemKey) => {
          const existing = drop.lines.find((line) => line.itemKey === itemKey);
          return existing ?? { itemKey, quantity: "" as const };
        });
        return { ...drop, lines };
      }),
    });
  };

  const updateDropLineQty = (dropId: string, lineItemKey: string, quantity: number | "") => {
    const clamped = clampUnloadLineQty(truck, truckUnload.drops, dropId, lineItemKey, quantity);
    onChange({
      ...truckUnload,
      drops: truckUnload.drops.map((drop) => {
        if (drop.id !== dropId) return drop;
        return {
          ...drop,
          lines: drop.lines.map((line) => (line.itemKey === lineItemKey ? { ...line, quantity: clamped } : line)),
        };
      }),
    });
  };

  const removeDrop = (dropId: string) => {
    if (openMenuDropId === dropId) setOpenMenuDropId(null);
    onChange({ ...truckUnload, drops: truckUnload.drops.filter((drop) => drop.id !== dropId) });
  };

  const { canAddDrop, title: addDropTitle } = societyDropAddMeta(truck, truckUnload);

  return (
    <section className="relative overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm sm:rounded-2xl">
      <div className="relative border-b border-gray-100 bg-gradient-to-r from-gray-50/80 to-white px-4 py-3 sm:px-5">
        <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${accentBar}`} />
        <div className="flex min-w-0 items-center gap-2 pl-2 sm:gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 sm:h-8 sm:w-8">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <rect x="1" y="3" width="15" height="13" />
              <polygon points="16 8 20 8 23 11 23 16 16 16 8" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 sm:gap-x-3">
              <h2 className="shrink-0 text-lg font-bold bg-gradient-to-r from-blue-900 to-blue-600 bg-clip-text text-transparent sm:text-xl">
                {truckLabel.title}
              </h2>
              <div className="flex min-w-[8rem] flex-1 items-center gap-2">
                <div className="h-2 min-w-[3rem] flex-1 overflow-hidden rounded-full bg-gray-200/80">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${complete ? "bg-green-500" : "bg-blue"}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="shrink-0 text-sm font-bold tabular-nums text-blue-600">
                  {Math.round(progress)}%
                </span>
              </div>
              <span className="shrink-0 text-xs font-semibold tabular-nums text-gray-400">
                {truckDroppedQty(truckUnload.drops).toLocaleString()} / {truckTotalQty(truck).toLocaleString()} qty
              </span>
            </div>
            <p className={`mt-0.5 truncate text-xs font-semibold ${subtitleClass}`}>{truckLabel.subtitle}</p>
          </div>
        </div>
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
            <ReadOnlyField label="Transporter" value={transporterName} />
            <ReadOnlyField label="Vehicle number" value={truck.vehicle_number ?? ""} className="uppercase" />
            <ReadOnlyField label="Driver name" value={truck.driver_name ?? ""} />
            <ReadOnlyField label="Driver mobile" value={truck.driver_phone ?? ""} />
          </div>
        </div>

        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-rose-50 text-rose-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M2 16s9-15 20-4C11 23 2 8 2 8" />
                </svg>
              </div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">Society quantity details</h3>
            </div>
            <button
              type="button"
              onClick={addDrop}
              disabled={!canAddDrop}
              title={addDropTitle}
              className="rounded-full bg-rose-50 p-1 text-rose-500 transition-colors hover:bg-rose-100 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-rose-50 disabled:hover:text-rose-500"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>

          {truckUnload.drops.length > 0 && (
            <div className="space-y-4">
              {truckUnload.drops.map((drop, dropIndex) => {
                const isSubmitted = Boolean(drop.submitted);
                const isComplete = dropIsComplete(drop);
                const sDisplayText = societyDisplayText(drop, societies);
                const isMenuOpen = openMenuDropId === drop.id;
                const dropQtyTotal = drop.lines.reduce(
                  (sum, line) => sum + (line.quantity === "" ? 0 : Number(line.quantity) || 0),
                  0,
                );
                return (
                  <div
                    key={drop.id}
                    className={`group relative space-y-4 rounded-xl border p-3 shadow-sm transition-all duration-300 sm:p-4 ${
                      isSubmitted
                        ? "border-emerald-200/80 bg-emerald-50/10 shadow-emerald-500/5"
                        : "border-gray-100 bg-white hover:shadow-md"
                    }`}
                  >
                    {/* Society Card Header: Title + Status + 3-dots Menu */}
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                            isSubmitted
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {dropIndex + 1}
                        </span>
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
                          <span className="truncate text-sm font-bold text-gray-800">
                            {sDisplayText || `Society #${dropIndex + 1}`}
                          </span>
                          {isSubmitted ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-emerald-700">
                              <svg
                                className="h-3 w-3 text-emerald-600"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                              >
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                              </svg>
                              Locked
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-amber-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                              Editing
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 3-dots menu to edit or remove */}
                      <div className="relative" ref={isMenuOpen ? menuContainerRef : undefined}>
                        <button
                          type="button"
                          onClick={() => setOpenMenuDropId(isMenuOpen ? null : drop.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 focus:outline-none sm:h-8 sm:w-8"
                          aria-label="Society options"
                          title="Society options"
                        >
                          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                            <circle cx="12" cy="5" r="1.75" />
                            <circle cx="12" cy="12" r="1.75" />
                            <circle cx="12" cy="19" r="1.75" />
                          </svg>
                        </button>

                        {isMenuOpen && (
                          <div className="absolute right-0 top-9 z-30 min-w-[160px] rounded-xl border border-gray-100 bg-white p-1.5 shadow-lg shadow-black/10 animate-in fade-in zoom-in-95">
                            {isSubmitted ? (
                              <button
                                type="button"
                                onClick={() => {
                                  updateDrop(drop.id, { submitted: false });
                                  setOpenMenuDropId(null);
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-rose-50 hover:text-rose-600 text-left"
                              >
                                <svg
                                  className="h-3.5 w-3.5 text-gray-400 group-hover:text-rose-500"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                                Edit Society
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={!isComplete}
                                onClick={() => {
                                  if (isComplete) {
                                    updateDrop(drop.id, { submitted: true });
                                    setOpenMenuDropId(null);
                                  }
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent text-left"
                              >
                                <svg
                                  className="h-3.5 w-3.5 text-emerald-600"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                >
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                                Submit Society
                              </button>
                            )}

                            {truckUnload.drops.length > 1 && (
                              <>
                                <div className="my-1 border-t border-gray-100" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    removeDrop(drop.id);
                                    setOpenMenuDropId(null);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 text-left"
                                >
                                  <svg
                                    className="h-3.5 w-3.5 text-red-500"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                  >
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                  </svg>
                                  Remove Drop
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
                      <label className="group/select block space-y-1 sm:space-y-1.5">
                        <span className="label text-xs transition-colors group-focus-within/select:text-rose-600 sm:text-[0.8125rem]">
                          Society
                        </span>
                        <div className="rounded-xl transition-all duration-300 group-focus-within/select:shadow-[0_0_0_3px_rgba(225,29,72,0.1)]">
                          <SocietyField
                            key={`society-${drop.id}`}
                            societies={societies}
                            drop={drop}
                            disabled={isSubmitted}
                            onChange={(patch) => updateDrop(drop.id, patch)}
                          />
                        </div>
                      </label>

                      <label className="group/select block space-y-1 sm:space-y-1.5">
                        <span className="label text-xs transition-colors group-focus-within/select:text-rose-600 sm:text-[0.8125rem]">
                          Fish type &amp; size
                        </span>
                        <div className="rounded-xl transition-all duration-300 group-focus-within/select:shadow-[0_0_0_3px_rgba(225,29,72,0.1)]">
                          <SelectField
                            key={`lines-${drop.id}`}
                            multiple
                            showCountOnly
                            disabled={isSubmitted}
                            valueMultiple={drop.lines.map((line) => line.itemKey)}
                            onChangeMultiple={(values) => setDropLines(drop.id, values)}
                            placeholder="Select fish lines…"
                            options={itemOptions}
                          />
                        </div>
                      </label>
                    </div>

                    {drop.lines.length > 0 ? (
                      <div className="mt-2 space-y-3 rounded-xl border border-rose-100/50 bg-rose-50/30 p-3 sm:space-y-4 sm:p-4">
                        <h4 className="flex items-center justify-between gap-3 text-[0.7rem] font-bold uppercase tracking-widest text-rose-700 sm:text-xs">
                          <span className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5">
                              <line x1="4" x2="20" y1="9" y2="9" />
                              <line x1="4" x2="20" y1="15" y2="15" />
                              <line x1="10" x2="8" y1="3" y2="21" />
                              <line x1="16" x2="14" y1="3" y2="21" />
                            </svg>
                            Enter quantities
                          </span>
                          <span className="shrink-0 normal-case tracking-normal text-rose-800/90">
                            Total quantity{" "}
                            <span className="tabular-nums font-extrabold">{dropQtyTotal.toLocaleString()}</span>
                          </span>
                        </h4>
                        <div className="grid gap-2.5 sm:gap-3">
                          {drop.lines.map((line) => {
                            const display = lineDisplay(truck, line.itemKey);
                            const transferQty = transferQtyForItemKey(truck, line.itemKey);
                            const maxLineQty = maxQtyForUnloadLine(truck, truckUnload.drops, drop.id, line.itemKey);
                            const allocatedOnOtherDrops = transferQty - maxLineQty;
                            const atCap =
                              line.quantity !== "" &&
                              Number(line.quantity) > 0 &&
                              Number(line.quantity) >= maxLineQty &&
                              maxLineQty < transferQty;
                            return (
                              <FishQuantityRow
                                key={line.itemKey}
                                fishType={display.fishType}
                                seedSize={display.seedSize}
                                meta={
                                  allocatedOnOtherDrops > 0 ? (
                                    <>
                                      <span className="block">{maxLineQty.toLocaleString()} left</span>
                                      <span className="block font-normal text-gray-400/80">
                                        of {transferQty.toLocaleString()}
                                      </span>
                                    </>
                                  ) : (
                                    <>max {maxLineQty.toLocaleString()}</>
                                  )
                                }
                                value={line.quantity}
                                quantityRequired={maxLineQty > 0}
                                quantityDisabled={isSubmitted || maxLineQty === 0}
                                quantityTitle={
                                  atCap
                                    ? `Remaining for this fish line on this truck: ${maxLineQty.toLocaleString()} (transfer qty ${transferQty.toLocaleString()})`
                                    : undefined
                                }
                                quantityClassName={`w-full rounded-md border bg-gray-50 px-3 py-1.5 text-sm text-right tabular-nums font-medium text-gray-900 transition-all focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 ${
                                  atCap
                                    ? "border-amber-300 focus:border-amber-400 focus:ring-amber-500/20"
                                    : "border-gray-200 focus:border-rose-400 focus:ring-rose-500/20"
                                }`}
                                onChange={(raw) => {
                                  let next = raw;
                                  if (next !== "" && maxLineQty > 0 && next > maxLineQty) {
                                    next = maxLineQty;
                                  }
                                  updateDropLineQty(drop.id, line.itemKey, next);
                                }}
                                placeholder="Qty"
                              />
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    {/* Bottom Status & Action: Submit Society or Locked Notice */}
                    {isSubmitted ? (
                      <div className="flex items-center justify-between rounded-xl border border-emerald-200/80 bg-emerald-50/50 px-3.5 py-2.5 text-xs text-emerald-800">
                        <div className="flex items-center gap-2">
                          <svg
                            className="h-4 w-4 shrink-0 text-emerald-600"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                          >
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                          <span className="font-semibold">Society details submitted &amp; locked to prevent mistypes.</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => updateDrop(drop.id, { submitted: false })}
                          className="ml-2 inline-flex shrink-0 items-center gap-1 font-bold text-emerald-700 underline underline-offset-2 transition-colors hover:text-emerald-900"
                        >
                          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                          Edit
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 border-t border-gray-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-gray-500">
                          {!dropHasSociety(drop)
                            ? "Select a society to begin."
                            : drop.lines.length === 0
                            ? "Select fish lines for this society."
                            : !isComplete
                            ? "Enter quantities (> 0) to submit."
                            : "Submit to lock society details and prevent mistypes."}
                        </p>
                        <button
                          type="button"
                          onClick={() => updateDrop(drop.id, { submitted: true })}
                          disabled={!isComplete}
                          title={isComplete ? "Lock society details" : "Select society and enter fish quantities first"}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-emerald-600 sm:w-auto"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Submit Society
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {complete ? (
          <div className="space-y-4 border-t border-gray-100 pt-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">Final odometer (100% unloaded)</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className={FIELD_CELL}>
                <span className={FIELD_LABEL}>Odometer reading</span>
                <NumericFieldInput
                  className={`${FIELD_INPUT} h-[38px] min-h-[38px] py-0`}
                  required
                  placeholder="Total KM"
                  value={truckUnload.odometer_reading}
                  onChange={(next) =>
                    onChange({
                      ...truckUnload,
                      odometer_reading: next,
                    })
                  }
                />
              </div>
              <CameraCapture
                name={`unload_image_${truck.id}`}
                label="Odometer capture"
                photoName={truckUnload.photoName}
                existingOdometerImagePath={truckUnload.existingOdometerImagePath}
                journeyNumber={journey.db_id ?? 1}
                truckSegment={truckLabel.odometerTruckSegment}
                pointCode="FP"
                onName={(name) => onChange({ ...truckUnload, photoName: name })}
                onFile={(file) => {
                  registerOdometerFile(`unload_image_${truck.id}`, file);
                  if (file) {
                    onChange({
                      ...truckUnload,
                      photoName: file.name,
                      existingOdometerImagePath: null,
                    });
                  }
                }}
              />
            </div>
          </div>
        ) : (
          <p className="text-xs font-medium text-amber-700">
            Record drops until progress reaches 100% to enter final odometer reading and capture.
          </p>
        )}
      </div>
    </section>
  );
}

function UnloadTrucksCarousel({
  trucks,
  journey,
  draft,
  societies,
  onDraftChange,
  registerOdometerFile,
}: {
  trucks: any[];
  journey: JourneySummary;
  draft: UnloadDraft;
  societies: { id: number; label: string }[];
  onDraftChange: (next: UnloadDraft) => void;
  registerOdometerFile: (fieldName: string, file: File | null) => void;
}) {
  const [active, setActive] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActive((index) => Math.min(index, Math.max(0, trucks.length - 1)));
  }, [trucks.length]);

  const scrollToSlide = (index: number, behavior: ScrollBehavior = "smooth") => {
    const container = containerRef.current;
    if (!container) return;
    const card = container.children[index] as HTMLElement | undefined;
    if (!card) return;
    container.scrollTo({ left: card.offsetLeft, behavior });
    setActive(index);
  };

  const scrollSlide = (dir: "left" | "right") => {
    const nextIndex = dir === "left" ? active - 1 : active + 1;
    if (nextIndex < 0 || nextIndex >= trucks.length) return;
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
    if (index !== active) setActive(index);
  };

  if (trucks.length === 0) return null;

  const activeTruck = trucks[active];
  const activeUnload =
    activeTruck?.id != null
      ? (draft.trucks[activeTruck.id] ?? { drops: [], odometer_reading: "", photoName: null })
      : null;
  const activeDropMeta =
    activeTruck && activeUnload ? societyDropAddMeta(activeTruck, activeUnload) : { canAddDrop: false, title: "" };

  const addDropForActiveTruck = () => {
    if (!activeTruck?.id || !activeUnload) return;
    onDraftChange({
      ...draft,
      trucks: {
        ...draft.trucks,
        [activeTruck.id]: {
          ...activeUnload,
          drops: [...activeUnload.drops, { id: generateId(), society_id: null, lines: [], submitted: false }],
        },
      },
    });
  };

  return (
    <div className="group/carousel relative space-y-4">
      <div className="flex items-center justify-center px-2 sm:px-4 md:justify-between">
        <div className="hidden w-8 md:block" aria-hidden />
        
        <div className="flex items-center justify-center">
          {trucks.length > 1 && (
            <button
              type="button"
              onClick={() => scrollSlide("left")}
              disabled={active === 0}
              className="p-1.5 rounded-full bg-white border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-200 shadow-sm transition-all disabled:opacity-30 disabled:hover:border-gray-200 disabled:hover:text-gray-500"
              aria-label="Previous truck"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 sm:h-4.5 sm:w-4.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
          )}
          
          <h3 className="mx-2 shrink-0 whitespace-nowrap text-xs font-bold uppercase tracking-wide text-gray-500 sm:mx-4 sm:text-sm sm:tracking-widest">
            Final Point Trucks
            {trucks.length > 1 ? (
              <span className="font-medium text-gray-400"> ({active + 1}/{trucks.length})</span>
            ) : null}
          </h3>

          {trucks.length > 1 && (
            <button
              type="button"
              onClick={() => scrollSlide("right")}
              disabled={active === trucks.length - 1}
              className="p-1.5 rounded-full bg-white border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-200 shadow-sm transition-all disabled:opacity-30 disabled:hover:border-gray-200 disabled:hover:text-gray-500"
              aria-label="Next truck"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 sm:h-4.5 sm:w-4.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
          )}
        </div>
        <div className="hidden w-8 md:block" aria-hidden />
      </div>

      <div
        ref={containerRef}
        onScroll={handleCarouselScroll}
        className="flex w-full gap-4 overflow-x-auto snap-x snap-mandatory hide-scrollbar pb-4"
      >
        {trucks.map((truck) => {
          if (!truck.id) return null;
          return (
            <div key={truck.id} className="w-full min-w-full flex-[0_0_100%] snap-center">
              <UnloadTruckCard
                journey={journey}
                truck={truck}
                truckUnload={draft.trucks[truck.id] ?? { drops: [], odometer_reading: "", photoName: null }}
                societies={societies}
                onChange={(next) =>
                  onDraftChange({
                    ...draft,
                    trucks: { ...draft.trucks, [truck.id]: next },
                  })
                }
                registerOdometerFile={registerOdometerFile}
              />
            </div>
          );
        })}
      </div>
      <FloatingAddButton
        variant="rose"
        onClick={addDropForActiveTruck}
        disabled={!activeDropMeta.canAddDrop}
        title={activeDropMeta.title}
        ariaLabel="Add another society drop"
      />
    </div>
  );
}

function UnloadJourneyForm({
  journey,
  draft,
  districts,
  onDraftChange,
  onCancel,
  onSubmitSuccess,
}: {
  journey: JourneySummary;
  draft: UnloadDraft;
  districts: DistrictRow[];
  onDraftChange: (next: UnloadDraft) => void;
  onCancel: () => void;
  onSubmitSuccess: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(recordUnload, null);
  const [clientError, setClientError] = useState<string | null>(null);
  const odometerFilesRef = useRef(new Map<string, File>());
  const societies = societiesForJourney(districts, journey);

  const registerOdometerFile = (fieldName: string, file: File | null) => {
    if (file) odometerFilesRef.current.set(fieldName, file);
    else odometerFilesRef.current.delete(fieldName);
  };

  const hasOdometerCapture = (truckId: string, form: HTMLFormElement, existingPath?: string | null) => {
    const fieldName = `unload_image_${truckId}`;
    if (existingPath) return true;
    if (odometerFilesRef.current.has(fieldName)) return true;
    const input = form.elements.namedItem(fieldName);
    if (input instanceof HTMLInputElement && input.files?.[0] && input.files[0].size > 0) {
      return true;
    }
    return Boolean(draft.trucks[truckId]?.photoName);
  };
  const unloadTrucks = useMemo(() => trucksForFinalUnload(journey.trucks), [journey.trucks]);
  const stackedUnloadTrucks = useMemo(() => {
    const ids = new Set(unloadTrucks.map((truck) => truck.id).filter(Boolean));
    return sortJourneyTrucks(journey).filter((truck) => truck.id && ids.has(truck.id));
  }, [journey, unloadTrucks]);

  const payload = useMemo(
    () => ({
      district_id: journey.districtId,
      trucks: unloadTrucks
        .filter((truck) => truck.id)
        .map((truck) => {
          const unload = draft.trucks[truck.id] ?? { drops: [], odometer_reading: "", photoName: null };
          return {
            truck_id: truck.id,
            odometer_reading: unload.odometer_reading,
            drops: unload.drops.flatMap((drop) =>
              drop.lines
                .filter((line) => dropHasSociety(drop) && line.quantity !== "" && Number(line.quantity) > 0)
                .map((line) => {
                  const { supplier_id, fish_id } = parseItemKey(line.itemKey);
                  return {
                    society_id: drop.society_id,
                    society_name: drop.society_name?.trim() || undefined,
                    supplier_id,
                    fish_id,
                    quantity: Number(line.quantity),
                  };
                }),
            ),
          };
        }),
    }),
    [draft, journey.districtId, unloadTrucks],
  );

  useEffect(() => {
    if (state?.success) {
      onSubmitSuccess();
      router.refresh();
      onCancel();
    }
  }, [state, onCancel, onSubmitSuccess, router]);

  const allTrucksComplete =
    unloadTrucks.length > 0 &&
    unloadTrucks.every((truck) => {
      if (!truck.id) return true;
      const unload = draft.trucks[truck.id];
      if (!unload) return false;
      const progress = truckProgressPercent(truck, unload.drops);
      if (progress < 100) return false;
      const allDropsSubmitted =
        unload.drops.length > 0 && unload.drops.every((drop) => Boolean(drop.submitted));
      if (!allDropsSubmitted) return false;
      return (
        unload.odometer_reading !== "" &&
        Boolean(unload.photoName || unload.existingOdometerImagePath)
      );
    });

  return (
    <form
      encType="multipart/form-data"
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        setClientError(null);
        const form = event.currentTarget;
        if (!form.reportValidity()) return;

        for (const truck of unloadTrucks) {
          if (!truck.id) continue;
          const unload = draft.trucks[truck.id];
          if (!unload) continue;

          for (let i = 0; i < unload.drops.length; i++) {
            const drop = unload.drops[i]!;
            if (!drop.submitted) {
              const name = societyDisplayText(drop, societies) || `Society #${i + 1}`;
              const vehicle = truck.vehicle_number ? ` on truck ${truck.vehicle_number}` : "";
              setClientError(`Please click "Submit Society" for "${name}"${vehicle} to lock it before closing the journey.`);
              return;
            }
          }

          const qtyError = validateTruckUnloadQuantities(truck, unload.drops);
          if (qtyError) {
            setClientError(qtyError);
            return;
          }
        }

        for (const truck of unloadTrucks) {
          if (!truck.id) continue;
          const unload = draft.trucks[truck.id];
          if (!unload) continue;
          const progress = truckProgressPercent(truck, unload.drops);
          if (progress < 100) continue;
          if (!hasOdometerCapture(truck.id, form, unload.existingOdometerImagePath)) {
            return;
          }
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
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />

      {clientError || state?.error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {clientError ?? state?.error}
        </p>
      ) : null}

      <section className="relative overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm sm:rounded-2xl">
        <div className="relative flex items-center border-b border-gray-100 bg-gradient-to-r from-gray-50/80 to-white px-4 py-3 sm:px-5">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-purple-500 to-purple-300" />
          <div className="pl-2">
            <h2 className="text-lg font-bold bg-gradient-to-r from-purple-900 to-purple-600 bg-clip-text text-transparent sm:text-xl">
              Unload — {journey.district}
            </h2>
            <p className="text-xs font-semibold text-gray-500">Societies from masters — or type a new name for this district</p>
          </div>
        </div>
      </section>

      <UnloadTrucksCarousel
        trucks={stackedUnloadTrucks}
        journey={journey}
        draft={draft}
        societies={societies}
        onDraftChange={onDraftChange}
        registerOdometerFile={registerOdometerFile}
      />

      <div className="pt-4 sm:pt-6">
        <button
          type="submit"
          disabled={pending || !allTrucksComplete}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-blue px-6 py-4 text-base font-bold text-white shadow-lg transition-all hover:bg-blue-dark disabled:opacity-50"
        >
          {pending ? "Saving..." : "Close journey"}
        </button>
      </div>
    </form>
  );
}

export function FinalPointForm({
  journeys,
  districts,
}: {
  journeys: JourneySummary[];
  districts: DistrictRow[];
}) {
  const router = useRouter();
  const [viewState, setViewState] = useState<"list" | "record">("list");
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, UnloadDraft>>({});
  const [draftsHydrated, setDraftsHydrated] = useState(false);
  const [laneView, setLaneView] = useState<JourneyPointLaneView>("in_progress");
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [deleteUnloadJourneyId, setDeleteUnloadJourneyId] = useState<string | null>(null);
  const [isDeletingUnload, setIsDeletingUnload] = useState(false);

  const { inProgress: inProgressJourneys, closed: closedJourneys } = splitJourneysByPointLane("final", journeys);

  useEffect(() => {
    const stored = readStoredUnloadDrafts();
    setDrafts((prev) => {
      const next = { ...prev };
      for (const journey of journeys) {
        if (next[journey.id]) continue;
        next[journey.id] = journeyUnloadSubmitted(journey)
          ? draftFromRecordedUnload(journey, stored[journey.id])
          : mergeUnloadDraft(journey, stored[journey.id]);
      }
      return next;
    });
    setDraftsHydrated(true);
  }, [journeys]);

  useEffect(() => {
    if (!draftsHydrated) return;
    const activeIds = new Set(journeys.map((journey) => journey.id));
    const toStore: Record<string, UnloadDraft> = {};
    for (const [journeyId, draft] of Object.entries(drafts)) {
      if (activeIds.has(journeyId)) toStore[journeyId] = draft;
    }
    localStorage.setItem(UNLOAD_DRAFTS_STORAGE_KEY, JSON.stringify(toStore));
  }, [drafts, draftsHydrated, journeys]);

  async function openUnload(journey: JourneySummary) {
    const phase = normalizeJourneyPhase(journey.phase);
    const alreadyOnFinalLeg = phase === JourneyPhase.Final || phase === JourneyPhase.Closed;

    setDrafts((prev) => {
      const stored = readStoredUnloadDrafts()[journey.id];
      const base = journeyUnloadSubmitted(journey)
        ? draftFromRecordedUnload(journey, stored)
        : (prev[journey.id] ?? mergeUnloadDraft(journey, stored));
      return { ...prev, [journey.id]: { ...base, markUnloadStarted: true } };
    });
    setRecordingId(journey.id);
    setViewState("record");
    scrollCanvasToTop();

    if (alreadyOnFinalLeg) return;

    const result = await startFinalUnload(journey.journeyId);
    if (!result.success) {
      window.alert(result.error ?? "Could not start unload.");
      setRecordingId(null);
      setViewState("list");
      return;
    }
    startTransition(() => router.refresh());
  }

  function closeUnload() {
    setRecordingId(null);
    setViewState("list");
  }

  function clearDraft(journeyId: string) {
    setDrafts((prev) => {
      if (!(journeyId in prev)) return prev;
      const next = { ...prev };
      delete next[journeyId];
      return next;
    });
    const stored = readStoredUnloadDrafts();
    if (journeyId in stored) {
      delete stored[journeyId];
      localStorage.setItem(UNLOAD_DRAFTS_STORAGE_KEY, JSON.stringify(stored));
    }
  }

  function handleEditUnload(journey: JourneySummary) {
    void openUnload(journey);
    setOpenDropdownId(null);
  }

  async function confirmDeleteUnload() {
    if (!deleteUnloadJourneyId) return;
    const journey = journeys.find((j) => j.id === deleteUnloadJourneyId);
    if (!journey) return;

    setIsDeletingUnload(true);
    clearDraft(journey.id);
    const result = await deleteFinalUnloadRecording(journey.journeyId);
    setIsDeletingUnload(false);
    setDeleteUnloadJourneyId(null);
    setOpenDropdownId(null);

    if (!result.success) {
      window.alert(result.error ?? "Could not delete final unload.");
      return;
    }

    if (recordingId === journey.id) {
      setRecordingId(null);
      setViewState("list");
    }
    startTransition(() => router.refresh());
  }

  const recordingJourney = viewState === "record" ? journeys.find((j) => j.id === recordingId) : null;

  if (viewState === "record" && recordingJourney) {
    const storedUnload = readStoredUnloadDrafts()[recordingJourney.id];
    const draft =
      drafts[recordingJourney.id] ??
      (journeyUnloadSubmitted(recordingJourney)
        ? draftFromRecordedUnload(recordingJourney, storedUnload)
        : mergeUnloadDraft(recordingJourney, storedUnload));

    return (
      <div className="mx-auto w-full max-w-4xl space-y-6 px-2 pb-20 sm:px-0 sm:pb-12">
        <div className="flex items-center gap-3 px-1 sm:gap-5">
          <button
            type="button"
            onClick={closeUnload}
            className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-blue-dark shadow-sm transition-all hover:border-blue-400 sm:h-12 sm:w-12 sm:rounded-2xl"
            aria-label="Back to final point list"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 sm:h-5 sm:w-5">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-blue-dark sm:text-2xl">
              Final point — Journey #{recordingJourney.db_id}
            </h1>
            <p className="mt-0.5 text-xs font-medium text-muted sm:text-sm">
              {recordingJourney.startLocation} → {recordingJourney.district}
            </p>
          </div>
        </div>
        <UnloadJourneyForm
          journey={recordingJourney}
          draft={draft}
          districts={districts}
          onDraftChange={(next) => setDrafts((prev) => ({ ...prev, [recordingJourney.id]: next }))}
          onCancel={closeUnload}
          onSubmitSuccess={() => clearDraft(recordingJourney.id)}
        />
      </div>
    );
  }

  const renderFinalJourneyCard = (journey: JourneySummary, closed: boolean) => {
    const unloading = unloadInProgress(journey, drafts[journey.id]);
    const unloadSubmitted = journeyUnloadSubmitted(journey);
    const finalTrucks = trucksForFinalUnload(journey.trucks);
    return (
      <JourneySummaryCard
        key={journey.id}
        journey={{ ...journey, trucks: finalTrucks }}
        truckRows={unloadSubmitted ? buildFinalUnloadSummaryRows(journey) : undefined}
        detailMode={unloadSubmitted ? "unload_drops" : "items"}
        odometerScope="final"
        odometerLabel="Final odometer"
        expandedSectionTitle={unloadSubmitted ? "Final unload — Full Details" : "Starting Point — Full Details"}
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
            {journeyPointBadgeLabel("final", journey.phase)}
          </span>
        }
        optionsMenu={
          normalizeJourneyPhase(journey.phase) !== JourneyPhase.Final &&
          normalizeJourneyPhase(journey.phase) !== JourneyPhase.Closed ? undefined : (
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenDropdownId(openDropdownId === journey.id ? null : journey.id)}
                className="rounded-full p-1.5 text-blue-600 transition-colors hover:bg-white/50"
                title="Options"
                aria-label="Journey options"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
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
                      onClick={() => handleEditUnload(journey)}
                      className="w-full px-4 py-2 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-blue-50 hover:text-blue-600"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteUnloadJourneyId(journey.id);
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
          normalizeJourneyPhase(journey.phase) !== JourneyPhase.Transfer &&
          normalizeJourneyPhase(journey.phase) !== JourneyPhase.Final ? undefined : (
            <div className="flex justify-center border-t border-line bg-blue-soft/10 px-5 py-4">
              <button
                type="button"
                onClick={() => openUnload(journey)}
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-blue px-6 py-2.5 text-sm font-semibold text-white shadow-[0_0_40px_-10px_rgba(15,76,129,0.5)] transition-all hover:scale-[1.02]"
              >
                {unloading ? "Continue unload" : "Start unload"}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
          )
        }
      />
    );
  };

  if (journeys.length === 0) {
    return (
      <section className="surface data-card">
        <p className="px-4 py-8 text-sm text-[var(--text-secondary)]">No final points yet.</p>
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
          inProgressJourneys.map((journey) => renderFinalJourneyCard(journey, false))
        )}
      </JourneyPointLaneSection>

      <JourneyPointLaneSection title="Closed" hidden={!laneViewShowsClosed(laneView)}>
        {closedJourneys.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">No closed journeys yet.</p>
        ) : (
          closedJourneys.map((journey) => renderFinalJourneyCard(journey, true))
        )}
      </JourneyPointLaneSection>

      {deleteUnloadJourneyId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-6 shadow-2xl">
            <h3 className="mb-2 text-xl font-bold text-gray-900">Delete final unload?</h3>
            <p className="mb-6 text-sm leading-relaxed text-gray-500">
              This clears saved unload progress, society drops, and final odometer photos for this journey, then moves
              it back to the transfer leg. Transfer data is kept.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteUnloadJourneyId(null)}
                disabled={isDeletingUnload}
                className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteUnload()}
                disabled={isDeletingUnload}
                className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-red-600/20 transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {isDeletingUnload ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
