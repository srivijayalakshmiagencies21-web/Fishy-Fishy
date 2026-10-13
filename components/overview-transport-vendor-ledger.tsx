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
import { sumSalesAmounts } from "@/lib/overview-sales";
import type { TransportVendorPayableRow } from "@/lib/overview-transport-vendor-payable";

const ACCENT = "amber" as const;

const LEDGER_FORMULA = [
  "Billed = rate × km (closed journeys in FY, IST)",
  "Paid = Money Out in Transport Local / Non-Local Vendor (txn date → FY)",
  "Outstanding = Billed − Paid",
];

function formatBilled(amount: number | null) {
  if (amount == null) return "—";
  return formatAmount(amount);
}

function vendorOutstanding(billed: number | null, paid: number) {
  if (billed == null) return null;
  return billed - paid;
}

export function OverviewTransportVendorLedger({
  financialYearLabel,
  rows,
}: {
  financialYearLabel: string;
  rows: TransportVendorPayableRow[];
}) {
  const totalBilled = sumSalesAmounts(rows.map((row) => row.billed));
  const totalPaid = rows.reduce((sum, row) => sum + row.paid, 0);
  const totalOutstanding = totalBilled == null ? null : totalBilled - totalPaid;
  const totalsTheme = overviewLedgerMobileTotalsClass(ACCENT);

  if (rows.length === 0) {
    return (
      <OverviewLedgerEmpty accent={ACCENT}>
        No transport vendor lines for this financial year. Closed journeys with transporter km appear from
        Vendor rates.
      </OverviewLedgerEmpty>
    );
  }

  return (
    <OverviewLedgerSection accent={ACCENT}>
      <div className={`space-y-3 p-3 md:hidden ${overviewLedgerBodyClass(ACCENT)}`}>
        {rows.map((row) => (
          <article key={row.vendorName} className="rounded-xl border border-line bg-white p-3.5 shadow-xs">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">{financialYearLabel}</p>
            <h3 className="mt-1 text-sm font-bold text-slate-900">{row.vendorName}</h3>
            <dl className="mt-3 grid grid-cols-1 gap-2 text-sm">
              <div className="flex items-center justify-between gap-3 border-t border-line/60 pt-2">
                <dt className="text-xs font-semibold text-muted">Billed</dt>
                <dd className="font-bold tabular-nums text-slate-900">{formatBilled(row.billed)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-xs font-semibold text-muted">Paid</dt>
                <dd className="font-bold tabular-nums text-slate-900">{formatAmount(row.paid)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-xs font-semibold text-muted">Outstanding</dt>
                <dd className="font-bold tabular-nums text-slate-900">
                  {formatBilled(vendorOutstanding(row.billed, row.paid))}
                </dd>
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
              <dt className={`font-semibold ${totalsTheme.mobileTotalsLabel}`}>Billed</dt>
              <dd className={`font-bold tabular-nums ${totalsTheme.mobileTotalsValue}`}>
                {formatBilled(totalBilled)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className={`font-semibold ${totalsTheme.mobileTotalsLabel}`}>Paid</dt>
              <dd className={`font-bold tabular-nums ${totalsTheme.mobileTotalsValue}`}>
                {formatAmount(totalPaid)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className={`font-semibold ${totalsTheme.mobileTotalsLabel}`}>Outstanding</dt>
              <dd className={`font-bold tabular-nums ${totalsTheme.mobileTotalsValue}`}>
                {formatBilled(totalOutstanding)}
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
                <th className="px-3 py-3 sm:px-4">Vendor</th>
                <th className="px-3 py-3 sm:px-4">Billed</th>
                <th className="px-3 py-3 sm:px-4">Paid</th>
                <OverviewLedgerFormulaHeaderTrigger label="Outstanding" />
              </tr>
            </thead>
            <OverviewLedgerFormulaStrip />
            <tbody className={`divide-y bg-white ${overviewLedgerTheme(ACCENT).tbodyDivide}`}>
            {rows.map((row) => (
              <tr key={row.vendorName} className={overviewLedgerRowHoverClass(ACCENT)}>
                <td className="px-3 py-3 font-semibold text-slate-800 sm:px-4">{financialYearLabel}</td>
                <td className="px-3 py-3 font-medium text-slate-800 sm:px-4">{row.vendorName}</td>
                <td className="px-3 py-3 font-semibold tabular-nums text-slate-900 sm:px-4">
                  {formatBilled(row.billed)}
                </td>
                <td className="px-3 py-3 font-semibold tabular-nums text-slate-900 sm:px-4">
                  {formatAmount(row.paid)}
                </td>
                <td className="px-3 py-3 font-semibold tabular-nums text-slate-900 sm:px-4">
                  {formatBilled(vendorOutstanding(row.billed, row.paid))}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className={overviewLedgerTableFootClass(ACCENT)}>
              <td className="px-3 py-3 sm:px-4" colSpan={2}>Total</td>
              <td className="px-3 py-3 tabular-nums sm:px-4">{formatBilled(totalBilled)}</td>
              <td className="px-3 py-3 tabular-nums sm:px-4">{formatAmount(totalPaid)}</td>
              <td className="px-3 py-3 tabular-nums sm:px-4">{formatBilled(totalOutstanding)}</td>
            </tr>
          </tfoot>
          </table>
        </OverviewLedgerFormulaProvider>
      </div>
    </OverviewLedgerSection>
  );
}
