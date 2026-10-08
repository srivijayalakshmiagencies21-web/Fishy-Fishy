"use client";

import type { ReactNode } from "react";
import type { JourneySummary } from "@/lib/journey-cards";
import { truckSummaryQuantity } from "@/lib/journey-final-unload-summary";
import type { JourneySummaryTruckRow } from "@/lib/journey-transfer-summary";
import { OdometerSummaryDetail } from "@/components/odometer-summary-detail";
import { buildDefaultSummaryRows } from "@/lib/journey-transfer-summary";
import { resolveStageOdometer } from "@/lib/journey-odometer-legs";

export type JourneySummaryDetailMode = "items" | "unload_drops";

export function JourneySummaryCard({
  journey,
  expanded,
  onToggleExpanded,
  statusBadge,
  optionsMenu,
  footer,
  truckRows,
  detailMode = "items",
  odometerLabel = "Odometer",
  expandedSectionTitle = "Starting Point — Full Details",
  timestampLabel = "Submitted on",
  timestampValue,
}: {
  journey: JourneySummary;
  expanded: boolean;
  onToggleExpanded: () => void;
  statusBadge: ReactNode;
  optionsMenu?: ReactNode;
  footer?: ReactNode;
  truckRows?: JourneySummaryTruckRow[];
  detailMode?: JourneySummaryDetailMode;
  odometerLabel?: string;
  expandedSectionTitle?: string;
  timestampLabel?: string;
  timestampValue?: string | null;
}) {
  const rows = truckRows ?? buildDefaultSummaryRows(journey);
  const displayTimestamp = timestampValue ?? journey.startTime;
  return (
    <section className="surface overflow-hidden">
      <div className="flex items-center justify-between border-b border-line bg-blue-soft/30 px-5 py-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-blue-dark">Journey #{journey.db_id}</h2>
          <span className="rounded bg-gray-50/80 px-2 py-1 text-xs font-medium text-gray-400">
            {timestampLabel}{" "}
            {displayTimestamp
              ? new Date(displayTimestamp).toLocaleString("en-IN", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {statusBadge}
          <button
            type="button"
            onClick={onToggleExpanded}
            className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 transition-colors hover:text-blue-800"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
            >
              {expanded ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
            </svg>
            {expanded ? "Hide Details" : "View Details"}
          </button>
          {optionsMenu}
        </div>
      </div>

      <div className="p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-800">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 shrink-0 text-purple-600"
          >
            <circle cx="12" cy="12" r="10" />
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
          </svg>
          {journey.startLocation}
          <span className="mx-1 font-normal text-gray-400">→</span>
          {journey.district}
        </div>

        <div className="space-y-1">
          {rows.map(({ truck, badge, badgeClass }, index) => {
            const totalQty = truckSummaryQuantity(truck as Record<string, unknown>, detailMode);
            return (
              <div
                key={(truck.id as string) ?? index}
                className="grid grid-cols-[minmax(0,1fr)_7.5rem_7.25rem] items-center gap-x-3 border-t border-gray-100 py-2.5 text-sm first:border-t-0 max-sm:grid-cols-1 max-sm:gap-y-2"
              >
                <div className="flex min-w-0 items-center gap-3 font-medium text-gray-800">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4 shrink-0 text-blue-500"
                  >
                    <rect x="1" y="3" width="15" height="13" />
                    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                    <circle cx="5.5" cy="18.5" r="2.5" />
                    <circle cx="18.5" cy="18.5" r="2.5" />
                  </svg>
                  <div className="flex min-w-0 items-center divide-x divide-gray-200">
                    <span className="shrink-0 pr-2.5 font-semibold text-gray-900 sm:w-28 sm:pr-3">{String(truck.vehicle_number ?? "")}</span>
                    <span className="min-w-0 max-w-[5.5rem] truncate px-2.5 sm:w-32 sm:max-w-none sm:px-3">{String(truck.driver_name ?? "")}</span>
                    <span className="shrink-0 whitespace-nowrap pl-2.5 tabular-nums text-gray-600 sm:pl-3">{String(truck.driver_phone ?? "")}</span>
                  </div>
                </div>
                <span
                  className={`max-sm:justify-self-start justify-self-center whitespace-nowrap rounded px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-widest ${badgeClass}`}
                >
                  {badge}
                </span>
                <div className="max-sm:justify-self-start justify-self-end whitespace-nowrap text-right font-bold tabular-nums text-blue-600">
                  {totalQty.toLocaleString()}{" "}
                  <span className="text-xs font-semibold uppercase tracking-wide text-blue-500">Qty</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {expanded ? (
        <div className="space-y-5 border-t border-gray-100 bg-gray-50/50 px-5 py-4">
          <p className="text-[0.65rem] font-bold uppercase tracking-widest text-gray-400">{expandedSectionTitle}</p>
          {rows.map(({ truck, badge, badgeClass }, tIdx) => (
            <div key={(truck.id as string) ?? tIdx} className="space-y-3">
              <div className="flex items-center gap-2">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3.5 w-3.5 shrink-0 text-blue-500"
                >
                  <rect x="1" y="3" width="15" height="13" />
                  <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                  <circle cx="5.5" cy="18.5" r="2.5" />
                  <circle cx="18.5" cy="18.5" r="2.5" />
                </svg>
                <span className="text-xs font-bold text-gray-800">{String(truck.vehicle_number ?? "")}</span>
                <span
                  className={`ml-1 rounded px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-widest ${badgeClass}`}
                >
                  {badge}
                </span>
              </div>
              {(() => {
                const stageOdo = resolveStageOdometer(truck as Record<string, any>, odometerLabel);
                return (
                  <OdometerSummaryDetail
                    label={odometerLabel}
                    reading={stageOdo.reading}
                    imagePath={stageOdo.imagePath}
                  />
                );
              })()}
              <div className="space-y-1 pl-5">
                {detailMode === "unload_drops"
                  ? ((truck.unload_drops as any[]) ?? []).map((drop: any, iIdx: number) => (
                      <div
                        key={iIdx}
                        className="flex items-center justify-between border-b border-gray-100 py-1.5 text-xs text-gray-600 last:border-0"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-gray-800">{drop.society?.name || "Society"}</span>
                          <span className="text-gray-300">·</span>
                          <span className="font-medium text-gray-700">{drop.supplier?.name || "Unknown"}</span>
                          <span className="text-gray-300">·</span>
                          <span>{drop.fish?.fish_type || "—"}</span>
                          {drop.fish?.seed_size ? (
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[0.6rem] font-semibold text-gray-500">
                              {drop.fish.seed_size}
                            </span>
                          ) : null}
                        </div>
                        <span className="ml-4 whitespace-nowrap font-bold text-gray-800">
                          {Number(drop.quantity).toLocaleString()}
                        </span>
                      </div>
                    ))
                  : ((truck.items as any[]) ?? []).map((item: any, iIdx: number) => (
                      <div
                        key={iIdx}
                        className="flex items-center justify-between border-b border-gray-100 py-1.5 text-xs text-gray-600 last:border-0"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-gray-800">{item.supplier?.name || "Unknown"}</span>
                          <span className="text-gray-300">·</span>
                          <span>{item.fish?.fish_type || "—"}</span>
                          {item.fish?.seed_size ? (
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[0.6rem] font-semibold text-gray-500">
                              {item.fish.seed_size}
                            </span>
                          ) : null}
                        </div>
                        <span className="ml-4 whitespace-nowrap font-bold text-gray-800">
                          {Number(item.quantity).toLocaleString()}
                        </span>
                      </div>
                    ))}
              </div>
              {tIdx < rows.length - 1 ? <div className="border-t border-gray-200 pt-1" /> : null}
            </div>
          ))}
        </div>
      ) : null}

      {footer}
    </section>
  );
}
