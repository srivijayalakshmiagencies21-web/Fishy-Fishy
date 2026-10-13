"use client";

import { useMemo } from "react";
import {
  OverviewLedgerFormulaHeaderTrigger,
  OverviewLedgerFormulaProvider,
  OverviewLedgerFormulaStrip,
} from "@/components/overview-ledger-formula-info";
import {
  OverviewLedgerEmpty,
  OverviewLedgerSection,
  overviewLedgerBodyClass,
  overviewLedgerMobileTotalsClass,
  overviewLedgerRowHoverClass,
  overviewLedgerTableFootClass,
  overviewLedgerTableHeadClass,
  overviewLedgerTheme,
} from "@/components/overview-ledger-ui";
import { pcDistrictSummaries, sumPcAmount, type PcLedgerTransactionRow } from "@/lib/overview-pc";
import { formatAmount } from "@/lib/transactions";
import type { GovtRateLedgerRow } from "@/lib/govt-rates";

const ACCENT = "purple" as const;

const LEDGER_FORMULA = [
  "Paid = Money Out · PC category",
  "Txn date maps to financial year (IST)",
  "Grouped by district on the transaction",
];

export function OverviewPcLedger({
  financialYearLabel,
  salesRows,
  transactions,
}: {
  financialYearLabel: string;
  salesRows: GovtRateLedgerRow[];
  transactions: PcLedgerTransactionRow[];
}) {
  const districtSummaries = useMemo(
    () =>
      pcDistrictSummaries(
        salesRows.map((row) => ({ districtId: row.districtId, districtName: row.districtName })),
        transactions,
      ),
    [salesRows, transactions],
  );

  const totalPc = sumPcAmount(transactions);
  const totalsTheme = overviewLedgerMobileTotalsClass(ACCENT);

  if (salesRows.length === 0 && transactions.length === 0) {
    return (
      <OverviewLedgerEmpty accent={ACCENT}>
        No districts for this financial year. Add districts in Vendor & Govt Rates, then record PC
        transactions in Finance.
      </OverviewLedgerEmpty>
    );
  }

  return (
    <OverviewLedgerSection accent={ACCENT}>
        <div className={`space-y-3 p-3 md:hidden ${overviewLedgerBodyClass(ACCENT)}`}>
          {districtSummaries.map((row) => (
            <article key={row.districtId} className="rounded-xl border border-line bg-white p-3.5 shadow-xs">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">{financialYearLabel}</p>
              <h3 className="mt-1 text-sm font-bold text-slate-900">{row.districtName}</h3>
              <dl className="mt-3 grid grid-cols-1 gap-2 text-sm">
                <div className="flex items-center justify-between gap-3 border-t border-line/60 pt-2">
                  <dt className="text-xs font-semibold text-muted">Paid</dt>
                  <dd className="font-bold tabular-nums text-slate-900">{formatAmount(row.amount)}</dd>
                </div>
              </dl>
            </article>
          ))}
          <article className={`rounded-xl border p-3.5 ${totalsTheme.mobileTotals}`}>
            <p className={`text-xs font-bold uppercase tracking-wider ${totalsTheme.mobileTotalsHeading}`}>
              Totals
            </p>
            <dl className="mt-2 grid grid-cols-1 gap-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className={`font-semibold ${totalsTheme.mobileTotalsLabel}`}>Paid</dt>
                <dd className={`font-bold tabular-nums ${totalsTheme.mobileTotalsValue}`}>
                  {formatAmount(totalPc)}
                </dd>
              </div>
            </dl>
          </article>
        </div>

        <div className={`hidden overflow-x-auto md:block ${overviewLedgerBodyClass(ACCENT)}`}>
          <OverviewLedgerFormulaProvider accent={ACCENT} formula={LEDGER_FORMULA} colSpan={3}>
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead>
                <tr className={overviewLedgerTableHeadClass(ACCENT)}>
                  <th className="px-3 py-3 sm:px-4">FY</th>
                  <th className="px-3 py-3 sm:px-4">District</th>
                  <OverviewLedgerFormulaHeaderTrigger label="Paid" />
                </tr>
              </thead>
              <OverviewLedgerFormulaStrip />
              <tbody className={`divide-y bg-white ${overviewLedgerTheme(ACCENT).tbodyDivide}`}>
              {districtSummaries.map((row) => (
                <tr key={row.districtId} className={overviewLedgerRowHoverClass(ACCENT)}>
                  <td className="px-3 py-3 font-semibold text-slate-800 sm:px-4">{financialYearLabel}</td>
                  <td className="px-3 py-3 font-medium text-slate-800 sm:px-4">{row.districtName}</td>
                  <td className="px-3 py-3 font-semibold tabular-nums text-slate-900 sm:px-4">
                    {formatAmount(row.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className={overviewLedgerTableFootClass(ACCENT)}>
                <td className="px-3 py-3 sm:px-4" colSpan={2}>Total</td>
                <td className="px-3 py-3 tabular-nums sm:px-4">{formatAmount(totalPc)}</td>
              </tr>
            </tfoot>
            </table>
          </OverviewLedgerFormulaProvider>
        </div>
    </OverviewLedgerSection>
  );
}
