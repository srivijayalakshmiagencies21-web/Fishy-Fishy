"use client";

import { salesFillRate } from "@/lib/overview-sales";
import type { DistrictFulfillmentRow } from "@/lib/overview-timeline";

function formatQty(quantity: number) {
  return quantity.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function formatQtyDenom(quantity: number) {
  return `${formatQty(quantity)} QTY`;
}

function formatPercent(percent: number | null) {
  if (percent == null) return "—";
  return `${percent.toLocaleString("en-IN", { maximumFractionDigits: 1, minimumFractionDigits: 0 })}%`;
}

function DistrictFulfillmentIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M7 12h10" />
      <path d="M10 18h4" />
      <circle cx="6" cy="6" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="18" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TimelineDistrictQtyCard({
  financialYearLabel,
  rows,
}: {
  financialYearLabel: string | null;
  rows: DistrictFulfillmentRow[];
}) {
  const totalFinal = rows.reduce((sum, row) => sum + row.finalPointQty, 0);
  const totalAllotted = rows.reduce((sum, row) => sum + (row.allottedQty ?? 0), 0);
  const hasAllotted = rows.some((row) => row.allottedQty != null && row.allottedQty > 0);
  const totalFillPercent = hasAllotted ? salesFillRate(totalFinal, totalAllotted) : null;

  return (
    <section
      className="relative w-full overflow-hidden rounded-xl border border-emerald-200/70 bg-white text-left shadow-xs"
    >
      <div className="p-4 pb-3 sm:p-5 sm:pb-4">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          <div className="min-w-0 flex-1">
            <p
              className="whitespace-nowrap text-[11px] font-bold uppercase leading-tight tracking-wide text-slate-500 sm:text-sm sm:tracking-wider"
              title={
                financialYearLabel
                  ? `District fulfillment · ${financialYearLabel}`
                  : "District fulfillment"
              }
            >
              District fulfillment
              {financialYearLabel ? (
                <span className="font-bold text-slate-400"> · {financialYearLabel}</span>
              ) : null}
            </p>
            <p className="mt-1 flex flex-wrap items-baseline gap-x-2 sm:mt-1.5 sm:gap-x-3">
              <span className="text-2xl font-extrabold tabular-nums tracking-tight text-slate-900 sm:text-3xl">
                {formatQty(totalFinal)}
                {hasAllotted ? (
                  <span className="text-lg font-bold text-slate-400 sm:text-xl">
                    {" "}
                    / {formatQtyDenom(totalAllotted)}
                  </span>
                ) : null}
              </span>
              {totalFillPercent != null ? (
                <span className="text-lg font-extrabold tabular-nums text-emerald-700 sm:text-2xl">
                  {formatPercent(totalFillPercent)}
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 sm:h-12 sm:w-12">
            <DistrictFulfillmentIcon />
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="border-t border-emerald-100 bg-emerald-50/90 px-4 py-6 text-center text-sm text-muted">
          Configure districts in Govt rates for this year to compare allotted quantities.
        </p>
      ) : (
        <ul className="border-t border-emerald-100 bg-emerald-50/90 px-4 py-3 sm:px-5 sm:py-4">
          {rows.map((row) => {
            const percent = row.fillPercent;
            const overTarget = percent != null && percent > 100;
            const barWidth = percent != null ? Math.min(100, percent) : 0;
            return (
              <li key={row.districtId} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-[11px] font-bold uppercase leading-snug tracking-wide text-slate-600 sm:text-xs">
                    {row.districtName}
                  </span>
                  <span className="shrink-0 text-sm font-extrabold tabular-nums text-slate-900">
                    {formatQty(row.finalPointQty)}
                    <span className="font-bold text-slate-400">
                      {" "}
                      / {row.allottedQty != null ? formatQtyDenom(row.allottedQty) : "—"}
                    </span>
                  </span>
                </div>
                <div
                  className="mt-2 h-2 overflow-hidden rounded-full bg-white/80 ring-1 ring-emerald-100"
                  role="progressbar"
                  aria-valuenow={percent ?? 0}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${row.districtName} fulfillment`}
                >
                  <div
                    className={`h-full rounded-full transition-all ${
                      overTarget ? "bg-amber-500" : percent != null && percent > 0 ? "bg-emerald-500" : "bg-slate-200"
                    }`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs font-extrabold tabular-nums text-emerald-800 sm:text-sm">
                  {formatPercent(percent)}
                  {overTarget ? (
                    <span className="ml-1 text-xs font-semibold text-amber-800 sm:text-sm">(over allotted)</span>
                  ) : null}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
