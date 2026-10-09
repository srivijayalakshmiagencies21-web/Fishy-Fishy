"use client";

import type { ReactNode } from "react";
import type { JourneySummary } from "@/lib/journey-cards";
import { truckSummaryQuantity } from "@/lib/journey-final-unload-summary";
import type { JourneySummaryTruckRow } from "@/lib/journey-transfer-summary";
import { MobileSummaryTabs, type MobileSummaryTab } from "@/components/mobile-summary-tabs";
import { OdometerSummaryDetail } from "@/components/odometer-summary-detail";
import { buildDefaultSummaryRows } from "@/lib/journey-transfer-summary";
import { resolveStageOdometer, legsFromTruckRow, totalDistanceKmFromLegs } from "@/lib/journey-odometer-legs";
import { truckDisplayName, finalUnloadTruckLabel } from "@/lib/journey-truck-labels";
import { startSummaryItemsForTruck } from "@/lib/journey-start-summary";
import { formatOdometerDisplayLabel } from "@/lib/odometer-display";


export type JourneySummaryDetailMode = "items" | "unload_drops";

/** Which journey leg’s odometer reading + capture appear on this page’s summary card. */
export type JourneyOdometerScope = "start" | "transfer" | "final";

type StageOdometer = ReturnType<typeof resolveStageOdometer>;

function formatStampTime(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function scopedOdometerDisplay(args: {
  scope: JourneyOdometerScope;
  odometerLabel: string;
  startOdo: StageOdometer;
  transferOdo: StageOdometer;
  finalOdo: StageOdometer;
  defaultOdo: StageOdometer;
}): { label: string; reading: StageOdometer["reading"]; imagePath: StageOdometer["imagePath"]; pointCode: "SP" | "TP" | "FP" } | null {
  const byScope = {
    start: { label: "Start Odometer", odo: args.startOdo, pointCode: "SP" as const },
    transfer: { label: "Transfer Odometer", odo: args.transferOdo, pointCode: "TP" as const },
    final: { label: "Final Odometer", odo: args.finalOdo, pointCode: "FP" as const },
  };
  const row = byScope[args.scope];
  if (row.odo.reading || row.odo.imagePath) {
    return { label: row.label, reading: row.odo.reading, imagePath: row.odo.imagePath, pointCode: row.pointCode };
  }
  if (args.scope === "start" && (args.defaultOdo.reading || args.defaultOdo.imagePath)) {
    return {
      label: args.odometerLabel,
      reading: args.defaultOdo.reading,
      imagePath: args.defaultOdo.imagePath,
      pointCode: "SP",
    };
  }
  return null;
}

export function JourneySummaryCard({
  journey,
  expanded,
  onToggleExpanded,
  statusBadge,
  optionsMenu,
  footer,
  notice,
  truckRows,
  detailMode = "items",
  odometerScope,
  odometerLabel = "Odometer",
  expandedSectionTitle = "Full Journey Details",
}: {
  journey: JourneySummary | any;
  expanded: boolean;
  onToggleExpanded: () => void;
  statusBadge: ReactNode;
  optionsMenu?: ReactNode;
  footer?: ReactNode;
  notice?: ReactNode;
  truckRows?: JourneySummaryTruckRow[];
  detailMode?: JourneySummaryDetailMode;
  odometerScope: JourneyOdometerScope;
  odometerLabel?: string;
  expandedSectionTitle?: string;
}) {
  const rows = truckRows ?? buildDefaultSummaryRows(journey);

  const startLoc = journey.startLocation ?? journey.start_location_name ?? journey.trucks?.[0]?.location_name ?? "Start";
  const districtLoc = journey.district ?? journey.district_name ?? journey.trucks?.[0]?.district?.name ?? "District";

  const stageQty =
    detailMode === "unload_drops"
      ? {
          label: "Unloaded",
          className: "bg-emerald-600",
          value: rows.reduce((sum, r) => {
            const drops = (r.truck as any).unload_drops ?? [];
            return sum + drops.reduce((s: number, d: any) => s + (Number(d.quantity) || 0), 0);
          }, 0),
        }
      : {
          label: odometerScope === "transfer" && journey.transferTime ? "Transferred" : "Loaded",
          className: odometerScope === "transfer" && journey.transferTime ? "bg-amber-600" : "bg-blue-600",
          value: rows.reduce((sum, r) => {
            const items = (r.truck as any).items ?? [];
            return sum + items.reduce((s: number, i: any) => s + (Number(i.quantity) || 0), 0);
          }, 0),
        };

  const submittedStamp = journey.startTime
    ? { label: "Submitted", value: journey.startTime as string, className: "border-slate-200/80 bg-white text-slate-700" }
    : null;
  const transferredStamp = journey.transferTime
    ? { label: "Transferred", value: journey.transferTime as string, className: "border-amber-200/80 bg-amber-50 text-amber-800" }
    : null;
  const finalizedStamp = journey.finalTime
    ? { label: "Finalized", value: journey.finalTime as string, className: "border-emerald-200/80 bg-emerald-50 text-emerald-800" }
    : null;
  const stageStamp =
    odometerScope === "start"
      ? submittedStamp
      : odometerScope === "transfer"
        ? (transferredStamp ?? submittedStamp)
        : (finalizedStamp ?? transferredStamp ?? submittedStamp);

  return (
    <section className="group rounded-2xl border border-slate-200/80 bg-white shadow-xs transition-all duration-200 hover:border-slate-300 hover:shadow-md overflow-hidden mb-4">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1 text-xs font-extrabold tracking-wider text-white uppercase shadow-2xs">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
            >
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            Journey #{journey.db_id ?? journey.id}
          </span>

          <div className="flex flex-wrap items-center gap-2">
            {stageStamp ? (
              <span
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[0.7rem] font-semibold ${stageStamp.className}`}
              >
                {stageStamp.label}: {formatStampTime(stageStamp.value)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {statusBadge}
          <button
            type="button"
            onClick={onToggleExpanded}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:border-slate-300 hover:bg-slate-50"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`h-3.5 w-3.5 text-slate-500 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
            {expanded ? "Hide Details" : "View Details"}
          </button>
          {optionsMenu}
        </div>
      </div>

      {/* Card Content - At a glance overview */}
      <div className="p-5">
        {/* Route & Key Metrics Banner */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-gradient-to-r from-slate-50 via-slate-50/80 to-indigo-50/40 p-3.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-100/70 text-indigo-700">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <circle cx="12" cy="12" r="10"></circle>
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
              </svg>
            </span>
            <span className="font-extrabold text-slate-900">{startLoc}</span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mx-1 h-4 w-4 shrink-0 text-slate-400"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
            <span className="font-extrabold text-indigo-700">{districtLoc}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white px-3 py-1 font-bold text-slate-700 shadow-2xs">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3.5 w-3.5 text-blue-500"
              >
                <rect x="1" y="3" width="15" height="13" />
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                <circle cx="5.5" cy="18.5" r="2.5" />
                <circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
              {rows.length} {rows.length === 1 ? "Truck" : "Trucks"}
            </span>

            {stageQty.value > 0 ? (
              <span className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 font-mono font-bold text-white shadow-2xs ${stageQty.className}`}>
                {stageQty.value.toLocaleString()} {stageQty.label}
              </span>
            ) : null}
          </div>
        </div>

        {notice}


      </div>

      {/* Expanded Full Details Section */}
      {expanded ? (
        <div className="space-y-6 border-t border-slate-100 bg-slate-50/70 p-5">
          <div className="flex items-center justify-between">
            <p className="text-[0.7rem] font-extrabold uppercase tracking-widest text-slate-500">{expandedSectionTitle}</p>
          </div>

          {rows.map(({ truck, badge, badgeClass }, tIdx) => {
            const truckObj = truck as Record<string, any>;
            const truckId = String(truckObj.id ?? "");
            const labelInfo = journey ? finalUnloadTruckLabel(journey, truckId) : null;
            const truckName = truckDisplayName(journey, truckObj, tIdx);
            const subtitle = labelInfo?.subtitle && !labelInfo.subtitle.includes("Ends at") ? labelInfo.subtitle : null;

            const transporterName = truckObj.transporter?.name ?? truckObj.transporter_name ?? null;
            const vehicleNum = truckObj.vehicle_number ?? null;
            const driverName = truckObj.driver_name ?? null;
            const driverPhone = truckObj.driver_phone ?? null;

            const startOdo = resolveStageOdometer(truckObj, "start");
            const transferOdo = resolveStageOdometer(truckObj, "transfer");
            const finalOdo = resolveStageOdometer(truckObj, "final");
            const defaultOdo = resolveStageOdometer(truckObj, "default");

            const legs = legsFromTruckRow(truckObj);
            const totalKm = totalDistanceKmFromLegs(legs);

            const rawItems = (truckObj.items as any[]) ?? [];
            const items = rawItems.length > 0 ? rawItems : startSummaryItemsForTruck(journey, truckObj);
            const drops = (truckObj.unload_drops as any[]) ?? [];

            type FishEntry = {
              groupName: string;
              fish_type: string;
              seed_size: string | null;
              quantity: number;
            };

            const allEntries: FishEntry[] =
              detailMode === "unload_drops"
                ? drops.map((d: any) => ({
                    groupName:
                      (typeof d.society?.name === "string" && d.society.name.trim()) ||
                      (typeof d.society_name === "string" && d.society_name.trim()) ||
                      "Unknown society",
                    fish_type: d.fish_type ?? d.fish?.fish_type ?? "—",
                    seed_size: d.seed_size ?? d.fish?.seed_size ?? null,
                    quantity: Number(d.quantity) || 0,
                  }))
                : items.map((i: any) => ({
                    groupName: i.supplier_name ?? i.supplier?.name ?? "Unknown supplier",
                    fish_type: i.fish_type ?? i.fish?.fish_type ?? "—",
                    seed_size: i.seed_size ?? i.fish?.seed_size ?? null,
                    quantity: Number(i.quantity) || 0,
                  }));

            const groupMap = new Map<string, { groupName: string; totalQty: number; fishItems: FishEntry[] }>();
            for (const entry of allEntries) {
              const existing = groupMap.get(entry.groupName) ?? {
                groupName: entry.groupName,
                totalQty: 0,
                fishItems: [],
              };
              existing.totalQty += entry.quantity;
              existing.fishItems.push(entry);
              groupMap.set(entry.groupName, existing);
            }
            const quantityGroups = Array.from(groupMap.values());

            return (
              <div key={truckObj.id ?? tIdx} className="space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-3.5 w-3.5"
                    >
                      <rect x="1" y="3" width="15" height="13" />
                      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                      <circle cx="5.5" cy="18.5" r="2.5" />
                      <circle cx="18.5" cy="18.5" r="2.5" />
                    </svg>
                  </span>
                  <span className="text-sm font-extrabold text-slate-900">{truckName}</span>
                </div>

                <StackedTruckCards
                  truckName={truckName}
                  vehicleNum={vehicleNum}
                  transporterName={transporterName}
                  badge={badge}
                  badgeClass={badgeClass}
                  driverName={driverName}
                  driverPhone={driverPhone}
                  startOdo={startOdo}
                  transferOdo={transferOdo}
                  finalOdo={finalOdo}
                  defaultOdo={defaultOdo}
                  odometerScope={odometerScope}
                  odometerLabel={odometerLabel}
                  detailMode={detailMode}
                  quantityGroups={quantityGroups}
                  labelInfo={labelInfo}
                  tIdx={tIdx}
                  journey={journey}
                />
              </div>
            );
          })}
        </div>
      ) : null}

      {footer}
    </section>
  );
}

function StackedTruckCards({
  truckName,
  vehicleNum,
  transporterName,
  badge,
  badgeClass,
  driverName,
  driverPhone,
  startOdo,
  transferOdo,
  finalOdo,
  defaultOdo,
  odometerScope,
  odometerLabel,
  detailMode,
  quantityGroups,
  labelInfo,
  tIdx,
  journey,
}: {
  truckName: string;
  vehicleNum: string | null;
  transporterName: string | null;
  badge: string;
  badgeClass: string;
  driverName: string | null;
  driverPhone: string | null;
  startOdo: StageOdometer;
  transferOdo: StageOdometer;
  finalOdo: StageOdometer;
  defaultOdo: StageOdometer;
  odometerScope: JourneyOdometerScope;
  odometerLabel: string;
  detailMode: JourneySummaryDetailMode;
  quantityGroups: {
    groupName: string;
    totalQty: number;
    fishItems: { fish_type: string; seed_size: string | null; quantity: number }[];
  }[];
  labelInfo: ReturnType<typeof finalUnloadTruckLabel> | null;
  tIdx: number;
  journey: JourneySummary | any;
}) {
  const quantitySectionTitle =
    detailMode === "unload_drops" ? "2. Societies & Quantities" : "2. Items & Quantities";
  const quantityGroupLabel = detailMode === "unload_drops" ? "Society" : "Supplier";
  const totalQty = quantityGroups.reduce((sum, g) => sum + g.totalQty, 0);

  const segment = labelInfo?.kind === "secondary" ? null : `PT${labelInfo?.primaryNumber ?? (tIdx + 1)}`;
  const scoped = scopedOdometerDisplay({
    scope: odometerScope,
    odometerLabel,
    startOdo,
    transferOdo,
    finalOdo,
    defaultOdo,
  });
  const scopedCaptureLabel = scoped?.imagePath
    ? formatOdometerDisplayLabel({
        existingPath: scoped.imagePath,
        journeyNumber: journey?.db_id ?? journey?.id,
        truckSegment: segment,
        pointCode: scoped.pointCode,
      }) || scoped.imagePath
    : scoped?.imagePath ?? null;

  const vehicleCard = (hideHeader: boolean) => (
    <div className="w-full rounded-2xl border border-amber-200/80 bg-amber-50 p-3 shadow-2xs lg:bg-amber-50/40 lg:p-4 flex flex-col space-y-3">
      {hideHeader ? null : (
        <div className="flex items-center gap-2 border-b border-amber-100 pb-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-600">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <span className="text-xs font-extrabold uppercase tracking-wider text-amber-950">
            1. Vehicle, Transporter & Odometer
          </span>
        </div>
      )}

      <div className="rounded-xl border border-amber-200/70 bg-white p-3 shadow-2xs space-y-2.5 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <span className="text-amber-700/80 font-semibold block uppercase text-[0.65rem]">Vehicle Number</span>
            <span className="font-mono font-extrabold text-amber-950 text-sm block mt-0.5 truncate">{vehicleNum || "—"}</span>
          </div>
          <div className="min-w-0">
            <span className="text-amber-700/80 font-semibold block uppercase text-[0.65rem]">Transporter</span>
            <span className="font-bold text-amber-950 text-sm block mt-0.5 break-words">{transporterName || "—"}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <span className="text-amber-700/80 font-semibold block uppercase text-[0.65rem]">Destination Ends At</span>
            <span className={`inline-block mt-1 rounded-md px-2 py-0.5 text-[0.65rem] font-extrabold uppercase tracking-wider ${badgeClass}`}>
              {badge}
            </span>
          </div>
          <div className="min-w-0">
            <span className="text-amber-700/80 font-semibold block uppercase text-[0.65rem]">Driver</span>
            <span className="font-bold text-amber-900 block mt-0.5 break-words">
              {driverName || "—"}
              {driverPhone ? <span className="block font-mono text-amber-700 font-semibold">{driverPhone}</span> : null}
            </span>
          </div>
        </div>

        {scoped ? (
          <>
            <div className="border-t border-amber-100" />
            <OdometerSummaryDetail
              label={scoped.label}
              reading={scoped.reading}
              imagePath={scoped.imagePath}
              captureLabel={scopedCaptureLabel}
            />
          </>
        ) : null}
      </div>
    </div>
  );

  const quantityCard = (hideHeader: boolean) => (
    <div className="w-full rounded-2xl border border-rose-200/80 bg-rose-50 p-3 shadow-2xs lg:bg-rose-50/40 lg:p-4 flex flex-col space-y-3">
      {hideHeader ? null : (
        <div className="flex items-center gap-2 border-b border-rose-100 pb-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-rose-100 text-rose-600">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
              <path d="M2 16s9-15 20-4C11 23 2 8 2 8" />
            </svg>
          </div>
          <span className="text-xs font-extrabold uppercase tracking-wider text-rose-950">
            {quantitySectionTitle}
          </span>
        </div>
      )}

      <div className="space-y-3">
        {quantityGroups.map((group, gIdx) => (
          <div key={gIdx} className="space-y-2 rounded-xl border border-rose-200/70 bg-white p-3 shadow-2xs">
            <div className="flex items-start justify-between gap-2 text-xs pb-1.5 border-b border-rose-100">
              <div className="min-w-0">
                <span className="text-rose-700/80 font-semibold block uppercase text-[0.65rem]">
                  {quantityGroupLabel}
                </span>
                <span className="font-extrabold text-rose-950 text-sm block mt-0.5 break-words">{group.groupName}</span>
              </div>
              <span className="font-mono font-extrabold text-white whitespace-nowrap bg-rose-500 px-2.5 py-0.5 rounded-md text-xs shadow-2xs mt-1">
                {group.totalQty.toLocaleString()} Qty
              </span>
            </div>
            <div className="space-y-1 pt-0.5">
              {group.fishItems.map((item, fIdx) => (
                <div
                  key={fIdx}
                  className="flex items-center justify-between gap-3 rounded-lg bg-rose-50/50 border border-rose-100/90 px-3 py-1.5 text-xs text-slate-800"
                >
                  <span className="min-w-0 font-bold text-slate-900">
                    {item.fish_type} {item.seed_size ? `(${item.seed_size})` : ""}
                  </span>
                  <span className="font-mono font-extrabold text-rose-700 whitespace-nowrap tabular-nums text-right">
                    {Number(item.quantity).toLocaleString()}{" "}
                    <span className="text-[0.65rem] font-semibold text-rose-500 uppercase">Qty</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {quantityGroups.length === 0 ? (
          <p className="text-xs text-slate-400 italic">
            {detailMode === "unload_drops" ? "No society drops recorded" : "No item entries recorded"}
          </p>
        ) : null}
      </div>
    </div>
  );

  const mobileTabs: MobileSummaryTab[] = [
    {
      key: "vehicle",
      label: "Vehicle",
      meta: scoped?.reading ? `${Number(scoped.reading).toLocaleString()} km` : vehicleNum ?? undefined,
      content: vehicleCard(true),
    },
    {
      key: "quantity",
      label: detailMode === "unload_drops" ? "Societies" : "Items",
      meta: `${totalQty.toLocaleString()} Qty`,
      content: quantityCard(true),
    },
  ];

  return (
    <div className="mt-2 w-full lg:mt-0">
      <MobileSummaryTabs tabs={mobileTabs} />
      <div className="hidden lg:grid lg:grid-cols-2 lg:gap-4">
        {vehicleCard(false)}
        {quantityCard(false)}
      </div>
    </div>
  );
}
