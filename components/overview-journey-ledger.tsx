"use client";

import { buildJourneyLedgerSummary } from "@/lib/journey-ledger-summary";
import type { OverviewJourneyRow } from "@/lib/overview-types";

function formatQty(value: number | null) {
  if (value == null || value <= 0) return "—";
  return value.toLocaleString();
}

function formatKm(value: number | null) {
  if (value == null) return "—";
  return `${value.toLocaleString()} km`;
}

export function OverviewJourneyLedger({ journey }: { journey: OverviewJourneyRow }) {
  const ledger = buildJourneyLedgerSummary(journey);

  if (ledger.trucks.length === 0) {
    return (
      <div className="border-t border-line bg-gray-50/80 px-5 py-4 text-xs text-muted">
        No ledger data for this journey yet.
      </div>
    );
  }

  return (
    <div className="border-t border-line bg-gray-50/80 px-5 py-4">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-800">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="h-4 w-4 shrink-0 text-purple-600"
          aria-hidden
        >
          <circle cx="12" cy="12" r="10" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </svg>
        <span className="text-gray-600">{ledger.routeOverview.split(" → ")[0]}</span>
        {ledger.routeOverview.split(" → ").slice(1).map((segment) => (
          <span key={segment} className="flex items-center gap-2">
            <span className="font-normal text-gray-400">→</span>
            <span>{segment}</span>
          </span>
        ))}
      </div>

      <div className="space-y-4">
        {ledger.trucks.map((truck) => (
          <div key={truck.truckId} className="overflow-hidden rounded-lg border border-line bg-white">
            <div className="border-b border-line bg-blue-soft/20 px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-bold text-blue-dark">{truck.label}</p>
                <p className="text-xs font-medium tabular-nums text-gray-600">{formatKm(truck.kilometers)}</p>
              </div>
              <p className="mt-1 text-xs text-gray-600">{truck.routeLabel}</p>
              {truck.distanceLegsLabel ? (
                <p className="mt-1 text-[11px] text-gray-500">{truck.distanceLegsLabel}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-600">
                <span>
                  <span className="font-semibold text-gray-500">Transporter:</span> {truck.transporter}
                </span>
                <span>
                  <span className="font-semibold text-gray-500">Vehicle:</span> {truck.vehicleNumber}
                </span>
              </div>
            </div>

            {truck.qtyLines.length > 0 ? (
              <div className="overflow-x-auto px-4 py-3">
                <table className="w-full min-w-[32rem] text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 text-[0.65rem] font-bold uppercase tracking-wider text-gray-400">
                      <th className="pb-2 pr-3 font-bold">Supplier</th>
                      <th className="pb-2 pr-3 font-bold">Fish</th>
                      <th className="pb-2 pr-3 text-right font-bold">Purchased</th>
                      <th className="pb-2 pr-3 text-right font-bold">Transferred</th>
                      <th className="pb-2 text-right font-bold">Dropped</th>
                    </tr>
                  </thead>
                  <tbody>
                    {truck.qtyLines.map((line) => (
                      <tr key={line.key} className="border-b border-gray-50 last:border-0">
                        <td className="py-2 pr-3 font-medium text-gray-800">{line.supplier}</td>
                        <td className="py-2 pr-3 text-gray-700">
                          {line.fish}
                          {line.seedSize ? (
                            <span className="ml-1 rounded bg-gray-100 px-1 py-0.5 text-[0.6rem] text-gray-500">
                              {line.seedSize}
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums text-gray-800">{formatQty(line.purchased)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-gray-800">{formatQty(line.transferred)}</td>
                        <td className="py-2 text-right tabular-nums font-semibold text-blue-dark">
                          {formatQty(line.dropped)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-4 py-3 text-xs text-muted">No quantity lines recorded for this truck.</p>
            )}

            {truck.societyDrops.length > 0 ? (
              <div className="border-t border-gray-100 bg-gray-50/60 px-4 py-3">
                <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-wider text-gray-400">
                  Dropped by society
                </p>
                <div className="space-y-2">
                  {truck.societyDrops.map((society) => (
                    <div key={society.society} className="rounded-md border border-gray-100 bg-white px-3 py-2">
                      <p className="text-xs font-semibold text-gray-800">{society.society}</p>
                      <ul className="mt-1 space-y-1">
                        {society.lines.map((line, idx) => (
                          <li key={`${line.supplier}-${line.fish}-${idx}`} className="flex justify-between text-[11px] text-gray-600">
                            <span>
                              {line.supplier} · {line.fish}
                              {line.seedSize ? ` (${line.seedSize})` : ""}
                            </span>
                            <span className="tabular-nums font-semibold text-gray-800">
                              {line.quantity.toLocaleString()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
