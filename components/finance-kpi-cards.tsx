"use client";

import { useMemo, useState } from "react";
import {
  buildCategoryMetaMap,
  executiveBalanceSummarySplit,
  executiveInflowSplit,
  kpiCategorySplit,
  kpiDefinitionsForVariant,
  kpiTotalAmount,
  type CategoryMeta,
  type FinanceKpiKey,
  type FinanceKpiVariant,
  type FinanceKpiWallet,
} from "@/lib/finance-kpi";
import { formatAmount, type TransactionRow } from "@/lib/transactions";

export function FinanceKpiCards({
  rows,
  categoryMetaByName,
  variant,
  wallets,
}: {
  rows: TransactionRow[];
  categoryMetaByName: Record<string, CategoryMeta>;
  variant: FinanceKpiVariant;
  wallets: FinanceKpiWallet[];
}) {
  const definitions = useMemo(() => kpiDefinitionsForVariant(variant), [variant]);
  const [activeKpi, setActiveKpi] = useState<FinanceKpiKey | null>(null);
  const metaMap = useMemo(() => buildCategoryMetaMap(categoryMetaByName), [categoryMetaByName]);

  const totals = useMemo(() => {
    const out = {} as Record<string, number>;
    for (const def of definitions) {
      out[def.key] = kpiTotalAmount(rows, metaMap, def.key, wallets);
    }
    return out;
  }, [rows, metaMap, definitions, variant, wallets]);

  const activeDef = definitions.find((d) => d.key === activeKpi);

  const split = useMemo(() => {
    if (!activeKpi || !activeDef) return [];
    if (activeDef.splitMode === "balance-summary") {
      return executiveBalanceSummarySplit(rows, wallets);
    }
    if (activeDef.splitMode === "inflow-summary") {
      return executiveInflowSplit(rows, wallets);
    }
    return kpiCategorySplit(rows, metaMap, activeKpi, wallets);
  }, [activeKpi, activeDef, rows, metaMap, wallets]);

  function toggleKpi(key: FinanceKpiKey) {
    setActiveKpi((current) => (current === key ? null : key));
  }

  const gridClass =
    variant === "executive" ? "grid grid-cols-1 gap-3 sm:grid-cols-3" : "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5";

  return (
    <section className="space-y-3">
      <div className={gridClass}>
        {definitions.map((def) => {
          const selected = activeKpi === def.key;
          return (
            <button
              key={def.key}
              type="button"
              onClick={() => toggleKpi(def.key)}
              className={[
                "flex min-h-[5.5rem] flex-col items-start justify-center gap-0.5 rounded-xl border border-blue/25 bg-blue-soft px-4 py-3 text-left transition-colors hover:border-blue/40",
                selected ? "ring-2 ring-blue ring-offset-2 ring-offset-[var(--page)]" : "",
              ].join(" ")}
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-blue-dark/80">
                {def.subtitle ? (
                  <>
                    {def.label} · <span className="text-blue-dark">{def.subtitle}</span>
                  </>
                ) : (
                  def.label
                )}
              </span>
              <span className="text-xl font-bold tabular-nums text-blue-dark">{formatAmount(totals[def.key] ?? 0)}</span>
            </button>
          );
        })}
      </div>

      {activeKpi && activeDef ? (
        <div className="surface overflow-hidden rounded-xl border border-line">
          <div className="border-b border-line bg-blue-soft px-4 py-2.5">
            <p className="text-sm font-semibold text-blue-dark">
              {activeDef.splitMode === "balance-summary"
                ? "Available balance · "
                : activeDef.splitMode === "inflow-summary"
                  ? "Inflows · "
                  : "Category split · "}
              {activeDef.subtitle ? `${activeDef.label} (${activeDef.subtitle})` : activeDef.label}
            </p>
          </div>
          {split.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">No activity in this bucket yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {split.map((row) => (
                <li key={row.category} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
                  <span className="min-w-0 font-medium">{row.category}</span>
                  <span className="shrink-0 tabular-nums text-muted">
                    {row.count > 0 ? `${row.count} · ` : ""}
                    {formatAmount(row.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
