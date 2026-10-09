"use client";

import { MobileSummaryTabs, type MobileSummaryTab } from "@/components/mobile-summary-tabs";
import { OdometerSummaryDetail } from "@/components/odometer-summary-detail";
import {
  buildJourneyLedgerSummary,
  type JourneyLedgerTruckRow,
  type LedgerQtyLine,
} from "@/lib/journey-ledger-summary";
import { resolveStageOdometer } from "@/lib/journey-odometer-legs";
import { truckEndTypeBadgeClass, truckEndTypeLabel } from "@/lib/journey-end-type-styles";
import { formatOdometerDisplayLabel } from "@/lib/odometer-display";
import { finalUnloadTruckLabel } from "@/lib/journey-truck-labels";
import type { OverviewJourneyRow } from "@/lib/overview-types";

type QtyStage = "purchased" | "transferred" | "dropped";

function formatKm(value: number | null) {
  if (value == null) return "—";
  return `${value.toLocaleString()} km`;
}

function formatStampTime(value: string) {
  const date = new Date(value);
  const day = date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const time = date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${day} ${time}`;
}

function supplierGroupsForStage(
  qtyLines: LedgerQtyLine[],
  stage: QtyStage,
): Array<{
  supplier: string;
  lines: Array<{
    key: string;
    fish: string;
    seedSize: string;
    quantity: number;
  }>;
}> {
  const map = new Map<string, Array<{ key: string; fish: string; seedSize: string; quantity: number }>>();
  for (const line of qtyLines) {
    const qty = line[stage];
    if (qty == null || qty <= 0) continue;
    const rows = map.get(line.supplier) ?? [];
    rows.push({
      key: line.key,
      fish: line.fish,
      seedSize: line.seedSize,
      quantity: qty,
    });
    map.set(line.supplier, rows);
  }
  return [...map.entries()].map(([supplier, lines]) => ({ supplier, lines }));
}

function societyDropGroups(truck: JourneyLedgerTruckRow) {
  return truck.societyDrops.map((society) => {
    const fishMap = new Map<string, { fish: string; seedSize: string; quantity: number }>();
    for (const line of society.lines) {
      const key = `${line.fish}|${line.seedSize}`;
      const existing = fishMap.get(key);
      if (existing) existing.quantity += line.quantity;
      else
        fishMap.set(key, {
          fish: line.fish,
          seedSize: line.seedSize,
          quantity: line.quantity,
        });
    }
    const lines = [...fishMap.values()];
    return {
      society: society.society,
      totalQty: lines.reduce((sum, row) => sum + row.quantity, 0),
      lines,
    };
  });
}

const ROSE_STAGE_THEME = {
  border: "border-rose-200",
  bg: "bg-rose-50",
  headerBg: "bg-rose-100",
  headerText: "text-rose-600",
  titleText: "text-rose-950",
  innerBorder: "border-rose-200",
  labelText: "text-rose-700/80",
  rowBorder: "border-rose-100",
  rowBg: "bg-white",
  qtyText: "text-rose-700",
  pillBg: "bg-rose-500",
} as const;

const STAGE_CARD_META: Record<QtyStage, { title: string; subtitle: string; groupLabel: string }> = {
  purchased: {
    title: "2. Purchased",
    subtitle: "Starting point quantities",
    groupLabel: "Supplier",
  },
  transferred: {
    title: "3. Transferred",
    subtitle: "Transfer point quantities",
    groupLabel: "Supplier",
  },
  dropped: {
    title: "4. Dropped",
    subtitle: "Final point unload",
    groupLabel: "Society",
  },
};

function sumStage(qtyLines: LedgerQtyLine[], stage: QtyStage) {
  return qtyLines.reduce((sum, line) => sum + (line[stage] ?? 0), 0);
}

function VehicleLedgerCard({
  truckRow,
  badge,
  badgeClass,
  driverName,
  driverPhone,
  odometerRows,
  getDisplayPath,
  hideHeader = false,
}: {
  hideHeader?: boolean;
  truckRow: JourneyLedgerTruckRow;
  badge: string;
  badgeClass: string;
  driverName: string | null;
  driverPhone: string | null;
  odometerRows: Array<{
    label: string;
    reading: number | string | null | undefined;
    imagePath: string | null | undefined;
    pointCode: "SP" | "TP" | "FP";
  }>;
  getDisplayPath: (path: string | null, pointCode: "SP" | "TP" | "FP") => string | null;
}) {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-3 sm:p-4">
      {hideHeader ? null : (
        <div className="mb-3 flex shrink-0 items-center border-b border-amber-100 pb-2">
          <div className="flex items-center gap-2">
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
        </div>
      )}

      <div className="space-y-2.5 rounded-xl border border-amber-200/70 bg-white p-3 text-xs shadow-2xs">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="block text-[0.65rem] font-semibold uppercase text-amber-700/80">Vehicle Number</span>
            <span className="mt-0.5 block font-mono text-sm font-extrabold text-amber-950">
              {truckRow.vehicleNumber}
            </span>
          </div>
          <div>
            <span className="block text-[0.65rem] font-semibold uppercase text-amber-700/80">Transporter</span>
            <span className="mt-0.5 block text-sm font-bold text-amber-950">{truckRow.transporter}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="block text-[0.65rem] font-semibold uppercase text-amber-700/80">Destination Ends At</span>
            <span
              className={`mt-1 inline-block rounded-md px-2 py-0.5 text-[0.65rem] font-extrabold uppercase tracking-wider ${badgeClass}`}
            >
              {badge}
            </span>
          </div>
          <div>
            <span className="block text-[0.65rem] font-semibold uppercase text-amber-700/80">Driver</span>
            <span className="mt-0.5 block font-bold text-amber-900">
              {driverName || "—"}
              {driverPhone ? <span className="font-mono font-semibold text-amber-700"> ({driverPhone})</span> : null}
            </span>
          </div>
        </div>

        <div>
          <span className="block text-[0.65rem] font-semibold uppercase text-amber-700/80">Route</span>
          <span className="mt-0.5 block text-sm font-semibold text-amber-950">{truckRow.routeLabel}</span>
          {truckRow.distanceLegsLabel ? (
            <span className="mt-0.5 block text-[11px] text-amber-800/80">{truckRow.distanceLegsLabel}</span>
          ) : null}
        </div>

        <div className="border-t border-amber-100" />

        <div className="flex flex-col gap-1.5">
          {odometerRows.map((row) => (
            <OdometerSummaryDetail
              key={row.pointCode}
              label={row.label}
              reading={row.reading}
              imagePath={row.imagePath}
              captureLabel={getDisplayPath(row.imagePath ?? null, row.pointCode)}
            />
          ))}
          {odometerRows.length === 0 ? (
            <p className="text-[11px] italic text-amber-800/70">No odometer captures recorded</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function LedgerStageQuantityCard({
  stage,
  supplierGroups,
  societyGroups,
  hideHeader = false,
}: {
  hideHeader?: boolean;
  stage: QtyStage;
  supplierGroups: ReturnType<typeof supplierGroupsForStage>;
  societyGroups: ReturnType<typeof societyDropGroups>;
}) {
  const meta = STAGE_CARD_META[stage];
  const theme = { ...ROSE_STAGE_THEME, ...meta };
  const useSocieties = stage === "dropped" && societyGroups.length > 0;
  const hasSupplier = supplierGroups.some((g) => g.lines.length > 0) && !useSocieties;
  const hasSociety = useSocieties && societyGroups.length > 0;
  const empty = !hasSupplier && !hasSociety;

  return (
    <section className={`rounded-2xl border ${theme.border} ${theme.bg} p-3 sm:p-4 lg:shadow-2xs`}>
      {hideHeader ? null : (
        <div className="mb-3 flex shrink-0 items-start gap-2 border-b border-white/60 pb-2">
          <div
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${theme.headerBg} ${theme.headerText}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
              <path d="M2 16s9-15 20-4C11 23 2 8 2 8" />
            </svg>
          </div>
          <div className="min-w-0">
            <h4 className={`text-xs font-extrabold uppercase tracking-wider ${theme.titleText}`}>{theme.title}</h4>
            <p className="text-[10px] font-medium text-slate-500">{theme.subtitle}</p>
          </div>
        </div>
      )}

      <div className="space-y-2 sm:space-y-3">
        {empty ? <p className="text-xs italic text-slate-400">No quantities recorded</p> : null}

        {hasSupplier
          ? supplierGroups.map(({ supplier, lines }) => {
              const total = lines.reduce((sum, row) => sum + row.quantity, 0);
              return (
                <div
                  key={supplier}
                  className={`space-y-1.5 rounded-xl border ${theme.innerBorder} bg-white p-2.5 shadow-2xs sm:space-y-2 sm:p-3`}
                >
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-1.5">
                    <div>
                      <span className={`block text-[0.65rem] font-semibold uppercase ${theme.labelText}`}>
                        {theme.groupLabel}
                      </span>
                      <span className="mt-0.5 block text-sm font-extrabold text-slate-900">{supplier}</span>
                    </div>
                    <span
                      className={`mt-1 whitespace-nowrap rounded-md ${theme.pillBg} px-2 py-0.5 font-mono text-xs font-extrabold text-white shadow-2xs`}
                    >
                      {total.toLocaleString()}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {lines.map((line) => (
                      <div
                        key={line.key}
                        className={`flex items-center justify-between rounded-lg border ${theme.rowBorder} ${theme.rowBg} px-2.5 py-1 text-xs shadow-2xs sm:px-3 sm:py-1.5`}
                      >
                        <span className="min-w-0 truncate font-bold text-slate-900">
                          {line.fish}
                          {line.seedSize ? (
                            <span className="ml-1 font-semibold text-slate-500">({line.seedSize})</span>
                          ) : null}
                        </span>
                        <span className={`ml-2 shrink-0 font-mono font-extrabold tabular-nums ${theme.qtyText}`}>
                          {line.quantity.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          : null}

        {hasSociety
          ? societyGroups.map((group) => (
              <div
                key={group.society}
                className={`space-y-1.5 rounded-xl border ${theme.innerBorder} bg-white p-2.5 shadow-2xs sm:space-y-2 sm:p-3`}
              >
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-1.5">
                  <div>
                    <span className={`block text-[0.65rem] font-semibold uppercase ${theme.labelText}`}>Society</span>
                    <span className="mt-0.5 block text-sm font-extrabold text-slate-900">{group.society}</span>
                  </div>
                  <span
                    className={`mt-1 whitespace-nowrap rounded-md ${theme.pillBg} px-2 py-0.5 font-mono text-xs font-extrabold text-white shadow-2xs`}
                  >
                    {group.totalQty.toLocaleString()}
                  </span>
                </div>
                <div className="space-y-1">
                  {group.lines.map((line, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between rounded-lg border ${theme.rowBorder} ${theme.rowBg} px-2.5 py-1 text-xs shadow-2xs sm:px-3 sm:py-1.5`}
                    >
                      <span className="min-w-0 truncate font-bold text-slate-900">
                        {line.fish}
                        {line.seedSize ? (
                          <span className="ml-1 font-semibold text-slate-500">({line.seedSize})</span>
                        ) : null}
                      </span>
                      <span className={`font-mono font-extrabold tabular-nums ${theme.qtyText}`}>
                        {line.quantity.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          : null}
      </div>
    </section>
  );
}

function LedgerTruckSummaryCards({
  journey,
  truckRow,
}: {
  journey: OverviewJourneyRow;
  truckRow: JourneyLedgerTruckRow;
}) {
  const truckObj = (journey.trucks ?? []).find((t) => t.id === truckRow.truckId) as Record<string, unknown> | undefined;
  const labelInfo = finalUnloadTruckLabel(journey, truckRow.truckId);
  const badge = truckEndTypeLabel(String(truckObj?.end_type ?? "FINAL_POINT"));
  const badgeClass = truckEndTypeBadgeClass(String(truckObj?.end_type ?? "FINAL_POINT"));
  const driverName = (truckObj?.driver_name as string | undefined) ?? null;
  const driverPhone = (truckObj?.driver_phone as string | undefined) ?? null;

  const startOdo = truckObj ? resolveStageOdometer(truckObj, "start") : { reading: null, imagePath: null };
  const transferOdo = truckObj ? resolveStageOdometer(truckObj, "transfer") : { reading: null, imagePath: null };
  const finalOdo = truckObj ? resolveStageOdometer(truckObj, "final") : { reading: null, imagePath: null };

  const segment = labelInfo.odometerTruckSegment;
  const getDisplayPath = (path: string | null, pointCode: "SP" | "TP" | "FP") => {
    if (!path) return path;
    return (
      formatOdometerDisplayLabel({
        existingPath: path,
        journeyNumber: journey.db_id ?? journey.id,
        truckSegment: segment,
        pointCode,
      }) || path
    );
  };

  const societyGroups = societyDropGroups(truckRow);
  const purchasedGroups = supplierGroupsForStage(truckRow.qtyLines, "purchased");
  const transferredGroups = supplierGroupsForStage(truckRow.qtyLines, "transferred");
  const droppedSupplierGroups = supplierGroupsForStage(truckRow.qtyLines, "dropped");

  const odometerRows: Array<{
    label: string;
    reading: typeof startOdo.reading;
    imagePath: typeof startOdo.imagePath;
    pointCode: "SP" | "TP" | "FP";
  }> = [];
  if (startOdo.reading || startOdo.imagePath) {
    odometerRows.push({
      label: "Start Odometer",
      ...startOdo,
      pointCode: "SP",
    });
  }
  if (transferOdo.reading || transferOdo.imagePath) {
    odometerRows.push({
      label: "Transfer Odometer",
      ...transferOdo,
      pointCode: "TP",
    });
  }
  if (finalOdo.reading || finalOdo.imagePath) {
    odometerRows.push({
      label: "Final Odometer",
      ...finalOdo,
      pointCode: "FP",
    });
  }

  const cards = (hideHeader: boolean) => ({
    vehicle: (
      <VehicleLedgerCard
        hideHeader={hideHeader}
        truckRow={truckRow}
        badge={badge}
        badgeClass={badgeClass}
        driverName={driverName}
        driverPhone={driverPhone}
        odometerRows={odometerRows}
        getDisplayPath={getDisplayPath}
      />
    ),
    purchased: (
      <LedgerStageQuantityCard
        hideHeader={hideHeader}
        stage="purchased"
        supplierGroups={purchasedGroups}
        societyGroups={[]}
      />
    ),
    transferred: (
      <LedgerStageQuantityCard
        hideHeader={hideHeader}
        stage="transferred"
        supplierGroups={transferredGroups}
        societyGroups={[]}
      />
    ),
    dropped: (
      <LedgerStageQuantityCard
        hideHeader={hideHeader}
        stage="dropped"
        supplierGroups={droppedSupplierGroups}
        societyGroups={societyGroups}
      />
    ),
  });

  const formatTotal = (value: number) => (value > 0 ? value.toLocaleString() : "—");
  const mobileCards = cards(true);
  const desktopCards = cards(false);
  const mobileTabs: MobileSummaryTab[] = [
    {
      key: "vehicle",
      label: "Vehicle",
      meta: formatKm(truckRow.kilometers),
      content: mobileCards.vehicle,
    },
    {
      key: "purchased",
      label: "Purchased",
      meta: formatTotal(sumStage(truckRow.qtyLines, "purchased")),
      content: mobileCards.purchased,
    },
    {
      key: "transferred",
      label: "Transferred",
      meta: formatTotal(sumStage(truckRow.qtyLines, "transferred")),
      content: mobileCards.transferred,
    },
    {
      key: "dropped",
      label: "Dropped",
      meta: formatTotal(sumStage(truckRow.qtyLines, "dropped")),
      content: mobileCards.dropped,
    },
  ];

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-2xs lg:space-y-4 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
            <rect x="1" y="3" width="15" height="13" />
            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
            <circle cx="5.5" cy="18.5" r="2.5" />
            <circle cx="18.5" cy="18.5" r="2.5" />
          </svg>
        </span>
        <span className="text-sm font-extrabold text-slate-900">{truckRow.label}</span>
        <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 font-mono text-xs font-bold tabular-nums text-white shadow-2xs">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
            aria-hidden
          >
            <path d="M12 2a10 10 0 1 0 10 10" />
            <path d="M12 12l5-5" />
          </svg>
          {formatKm(truckRow.kilometers)}
        </span>
      </div>

      <MobileSummaryTabs tabs={mobileTabs} />

      <div className="hidden space-y-4 lg:block">
        {desktopCards.vehicle}
        <div className="grid grid-cols-3 gap-4">
          {desktopCards.purchased}
          {desktopCards.transferred}
          {desktopCards.dropped}
        </div>
      </div>
    </div>
  );
}

export function OverviewJourneyLedger({ journey }: { journey: OverviewJourneyRow }) {
  const ledger = buildJourneyLedgerSummary(journey);

  if (ledger.trucks.length === 0) {
    return (
      <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-4 text-xs text-muted">
        No ledger data for this journey yet.
      </div>
    );
  }

  const routeParts = ledger.routeOverview.split(" → ");
  const allQtyLines = ledger.trucks.flatMap((truck) => truck.qtyLines);

  const stamps = [
    {
      key: "submitted",
      label: "Submitted",
      value: journey.startTime,
      className: "border-slate-200/80 bg-white text-slate-700",
    },
    {
      key: "transferred",
      label: "Transferred",
      value: journey.transferTime,
      className: "border-amber-200/80 bg-amber-50 text-amber-800",
    },
    {
      key: "finalized",
      label: "Finalized",
      value: journey.finalTime,
      className: "border-emerald-200/80 bg-emerald-50 text-emerald-800",
    },
  ];

  const qtyBadges = [
    {
      key: "purchased",
      label: "Purchased",
      value: sumStage(allQtyLines, "purchased"),
      className: "bg-blue-600",
    },
    {
      key: "transferred",
      label: "Transferred",
      value: sumStage(allQtyLines, "transferred"),
      className: "bg-amber-600",
    },
    {
      key: "dropped",
      label: "Dropped",
      value: sumStage(allQtyLines, "dropped"),
      className: "bg-emerald-600",
    },
  ];

  return (
    <div className="border-t border-slate-100 bg-slate-50/70 p-3 sm:p-5">
      <p className="mb-3 text-[0.7rem] font-extrabold uppercase tracking-widest text-slate-500">Journey ledger</p>

      <div className="mb-4 space-y-3 rounded-xl border border-slate-100 bg-gradient-to-r from-slate-50 via-slate-50/80 to-indigo-50/40 p-3 sm:mb-5 sm:p-3.5">
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-800">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-100/70 text-indigo-700">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
              <circle cx="12" cy="12" r="10" />
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
            </svg>
          </span>
          <span className="font-extrabold text-slate-900">{routeParts[0]}</span>
          {routeParts.slice(1).map((segment) => (
            <span key={segment} className="flex items-center gap-2">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="h-4 w-4 text-slate-400"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
              <span className="font-extrabold text-indigo-700">{segment}</span>
            </span>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {stamps.map((stamp) => (
            <div key={stamp.key} className={`min-w-0 rounded-md border px-1.5 py-1 text-center ${stamp.className}`}>
              <span className="block truncate text-[0.6rem] font-bold uppercase tracking-wide opacity-80">
                {stamp.label}
              </span>
              <span className="block truncate text-[0.68rem] font-semibold tabular-nums">
                {stamp.value ? formatStampTime(stamp.value) : "—"}
              </span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {qtyBadges.map((badge) => (
            <div
              key={badge.key}
              className={`min-w-0 rounded-md px-1.5 py-1 text-center text-white shadow-2xs ${badge.className}`}
            >
              <span className="block truncate text-[0.6rem] font-bold uppercase tracking-wide opacity-85">
                {badge.label}
              </span>
              <span className="block truncate font-mono text-xs font-bold tabular-nums">
                {badge.value > 0 ? badge.value.toLocaleString() : "—"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4 lg:space-y-8">
        {ledger.trucks.map((truck) => (
          <LedgerTruckSummaryCards key={truck.truckId} journey={journey} truckRow={truck} />
        ))}
      </div>
    </div>
  );
}
