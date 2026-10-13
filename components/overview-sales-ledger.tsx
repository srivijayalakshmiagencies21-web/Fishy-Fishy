"use client";

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
import { formatAmount } from "@/lib/transactions";
import { salesAmount, sumSalesAmounts } from "@/lib/overview-sales";
import type { GovtRateLedgerRow } from "@/lib/govt-rates";

const ACCENT = "emerald" as const;

const LEDGER_FORMULA = [
  "Supplied = govt rate × final point unload qty",
  "Received = income in Finance for this FY and district",
  "Outstanding = Supplied − Received",
];

function formatSalesValue(amount: number | null) {
  if (amount == null) return "—";
  return formatAmount(amount);
}

export function OverviewSalesLedger({
  financialYearLabel,
  rows,
  finalPointQtyByDistrict,
  incomeReceivedByDistrict,
}: {
  financialYearLabel: string;
  rows: GovtRateLedgerRow[];
  finalPointQtyByDistrict: Record<number, number>;
  incomeReceivedByDistrict: Record<number, number>;
}) {
  const sortedRows = [...rows].sort((a, b) => a.districtName.localeCompare(b.districtName));

  const currentValues = sortedRows.map((row) => {
    const finalQty = finalPointQtyByDistrict[row.districtId] ?? 0;
    return salesAmount(row.rate, finalQty);
  });
  const receivedValues = sortedRows.map((row) => incomeReceivedByDistrict[row.districtId] ?? 0);
  const outstandingValues = currentValues.map((supplied, index) =>
    supplied == null ? null : supplied - receivedValues[index],
  );
  const totalCurrent = sumSalesAmounts(currentValues);
  const totalReceived = receivedValues.reduce((sum, value) => sum + value, 0);
  const totalOutstanding = totalCurrent == null ? null : totalCurrent - totalReceived;
  const totalsTheme = overviewLedgerMobileTotalsClass(ACCENT);

  if (sortedRows.length === 0) {
    return (
      <OverviewLedgerEmpty accent={ACCENT}>
        No govt rate rows for this financial year. Configure districts in Vendor & Govt Rates.
      </OverviewLedgerEmpty>
    );
  }

  return (
    <OverviewLedgerSection accent={ACCENT}>
      <div className={`space-y-3 p-3 md:hidden ${overviewLedgerBodyClass(ACCENT)}`}>
        {sortedRows.map((row, index) => {
          const current = currentValues[index];
          const received = receivedValues[index];
          const outstanding = outstandingValues[index];
          return (
            <article key={row.id} className="rounded-xl border border-line bg-white p-3.5 shadow-xs">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">{financialYearLabel}</p>
              <h3 className="mt-1 text-sm font-bold text-slate-900">{row.districtName}</h3>
              <dl className="mt-3 grid grid-cols-1 gap-2 text-sm">
                <div className="flex items-center justify-between gap-3 border-t border-line/60 pt-2">
                  <dt className="text-xs font-semibold text-muted">Supplied</dt>
                  <dd className="font-bold tabular-nums text-slate-900">{formatSalesValue(current)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-xs font-semibold text-muted">Received</dt>
                  <dd className="font-bold tabular-nums text-slate-900">{formatAmount(received)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-xs font-semibold text-muted">Outstanding</dt>
                  <dd className="font-bold tabular-nums text-slate-900">{formatSalesValue(outstanding)}</dd>
                </div>
              </dl>
            </article>
          );
        })}
        <article className={`rounded-xl border p-3.5 ${totalsTheme.mobileTotals}`}>
          <p className={`text-xs font-bold uppercase tracking-wider ${totalsTheme.mobileTotalsHeading}`}>
            Totals
          </p>
          <dl className="mt-2 grid grid-cols-1 gap-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className={`font-semibold ${totalsTheme.mobileTotalsLabel}`}>Supplied</dt>
              <dd className={`font-bold tabular-nums ${totalsTheme.mobileTotalsValue}`}>
                {formatSalesValue(totalCurrent)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className={`font-semibold ${totalsTheme.mobileTotalsLabel}`}>Received</dt>
              <dd className={`font-bold tabular-nums ${totalsTheme.mobileTotalsValue}`}>
                {formatAmount(totalReceived)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className={`font-semibold ${totalsTheme.mobileTotalsLabel}`}>Outstanding</dt>
              <dd className={`font-bold tabular-nums ${totalsTheme.mobileTotalsValue}`}>
                {formatSalesValue(totalOutstanding)}
              </dd>
            </div>
          </dl>
        </article>
      </div>

      <div className={`hidden overflow-x-auto md:block ${overviewLedgerBodyClass(ACCENT)}`}>
        <OverviewLedgerFormulaProvider accent={ACCENT} formula={LEDGER_FORMULA} colSpan={5}>
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className={overviewLedgerTableHeadClass(ACCENT)}>
                <th className="px-3 py-3 sm:px-4">FY</th>
                <th className="px-3 py-3 sm:px-4">District</th>
                <th className="px-3 py-3 sm:px-4">Supplied</th>
                <th className="px-3 py-3 sm:px-4">Received</th>
                <OverviewLedgerFormulaHeaderTrigger label="Outstanding" />
              </tr>
            </thead>
            <OverviewLedgerFormulaStrip />
            <tbody className={`divide-y bg-white ${overviewLedgerTheme(ACCENT).tbodyDivide}`}>
            {sortedRows.map((row, index) => (
              <tr key={row.id} className={overviewLedgerRowHoverClass(ACCENT)}>
                <td className="px-3 py-3 font-semibold text-slate-800 sm:px-4">{financialYearLabel}</td>
                <td className="px-3 py-3 font-medium text-slate-800 sm:px-4">{row.districtName}</td>
                <td className="px-3 py-3 font-semibold tabular-nums text-slate-900 sm:px-4">
                  {formatSalesValue(currentValues[index])}
                </td>
                <td className="px-3 py-3 font-semibold tabular-nums text-slate-900 sm:px-4">
                  {formatAmount(receivedValues[index])}
                </td>
                <td className="px-3 py-3 font-semibold tabular-nums text-slate-900 sm:px-4">
                  {formatSalesValue(outstandingValues[index])}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className={overviewLedgerTableFootClass(ACCENT)}>
              <td className="px-3 py-3 sm:px-4" colSpan={2}>Total</td>
              <td className="px-3 py-3 tabular-nums sm:px-4">{formatSalesValue(totalCurrent)}</td>
              <td className="px-3 py-3 tabular-nums sm:px-4">{formatAmount(totalReceived)}</td>
              <td className="px-3 py-3 tabular-nums sm:px-4">{formatSalesValue(totalOutstanding)}</td>
            </tr>
          </tfoot>
          </table>
        </OverviewLedgerFormulaProvider>
      </div>
    </OverviewLedgerSection>
  );
}
