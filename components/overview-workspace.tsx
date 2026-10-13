"use client";

import { useMemo, useState } from "react";
import { OverviewKpiCards, overviewKpiDefaults } from "@/components/overview-kpi-cards";
import { OverviewSalesLedger } from "@/components/overview-sales-ledger";
import { OverviewSeedVendorLedger } from "@/components/overview-seed-vendor-ledger";
import { OverviewTransportVendorLedger } from "@/components/overview-transport-vendor-ledger";
import { OverviewPcLedger } from "@/components/overview-pc-ledger";
import { OverviewExpensesLedger } from "@/components/overview-expenses-ledger";
import {
  formatOverviewRatioPercent,
  sumSalesAmounts,
  totalRecordedSalesAmount,
  totalSuppliedSalesAmount,
} from "@/lib/overview-sales";
import type { SeedVendorPayableRow } from "@/lib/overview-seed-vendor-payable";
import type { TransportVendorPayableRow } from "@/lib/overview-transport-vendor-payable";
import { formatAmount } from "@/lib/transactions";
import type { GovtRateLedgerRow } from "@/lib/govt-rates";
import { sumExpensesAmount, type ExpensesLedgerTransactionRow } from "@/lib/overview-expenses";
import { sumPcAmount, type PcLedgerTransactionRow } from "@/lib/overview-pc";

const SALES_KPI_ID = "sales-value";
const SEED_VENDOR_KPI_ID = "seed-vendor-payable";
const TRANSPORT_VENDOR_KPI_ID = "transport-vendor-payable";
const PC_KPI_ID = "pc";
const EXPENSES_KPI_ID = "expenses";

export function OverviewWorkspace({
  salesRows,
  finalPointQtyByDistrict,
  incomeReceivedByDistrict,
  seedVendorPayableRows,
  transportVendorPayableRows,
  pcLedgerTransactions,
  expensesLedgerTransactions,
  expenseCategoryNames,
  financialYearLabel,
}: {
  salesRows: GovtRateLedgerRow[];
  finalPointQtyByDistrict: Record<number, number>;
  incomeReceivedByDistrict: Record<number, number>;
  seedVendorPayableRows: SeedVendorPayableRow[];
  transportVendorPayableRows: TransportVendorPayableRow[];
  pcLedgerTransactions: PcLedgerTransactionRow[];
  expensesLedgerTransactions: ExpensesLedgerTransactionRow[];
  expenseCategoryNames: string[];
  financialYearLabel: string;
}) {
  const [selectedKpiId, setSelectedKpiId] = useState<string | null>(null);

  const kpiItems = useMemo(() => {
    const supplied = totalSuppliedSalesAmount(salesRows, finalPointQtyByDistrict);
    const recorded = totalRecordedSalesAmount(salesRows);
    const seedVendorBilled = sumSalesAmounts(seedVendorPayableRows.map((row) => row.billed));
    const transportVendorBilled = sumSalesAmounts(
      transportVendorPayableRows.map((row) => row.billed),
    );
    const pcPaid = sumPcAmount(pcLedgerTransactions);
    const expensesPaid = sumExpensesAmount(expensesLedgerTransactions);

    const pctOfSupplied = (amount: number | null) => ({
      label: "% of supplied",
      value: formatOverviewRatioPercent(amount, supplied),
    });
    const pctOfRecorded = (amount: number | null) => ({
      label: "% of recorded",
      value: formatOverviewRatioPercent(amount, recorded),
    });

    return overviewKpiDefaults.map((item) => {
      const withYear = { ...item, subtitle: financialYearLabel };
      if (item.id === SALES_KPI_ID) {
        return {
          ...withYear,
          value: supplied != null ? formatAmount(supplied) : null,
          metrics: undefined,
        };
      }
      if (item.id === SEED_VENDOR_KPI_ID) {
        return {
          ...withYear,
          value: seedVendorBilled != null ? formatAmount(seedVendorBilled) : null,
          metrics: [pctOfSupplied(seedVendorBilled), pctOfRecorded(seedVendorBilled)],
        };
      }
      if (item.id === TRANSPORT_VENDOR_KPI_ID) {
        return {
          ...withYear,
          value: transportVendorBilled != null ? formatAmount(transportVendorBilled) : null,
          metrics: [pctOfSupplied(transportVendorBilled), pctOfRecorded(transportVendorBilled)],
        };
      }
      if (item.id === PC_KPI_ID) {
        return {
          ...withYear,
          value: formatAmount(pcPaid),
          metrics: [pctOfSupplied(pcPaid), pctOfRecorded(pcPaid)],
        };
      }
      if (item.id === EXPENSES_KPI_ID) {
        return {
          ...withYear,
          value: formatAmount(expensesPaid),
          metrics: [pctOfSupplied(expensesPaid), pctOfRecorded(expensesPaid)],
        };
      }
      return withYear;
    });
  }, [
    financialYearLabel,
    salesRows,
    finalPointQtyByDistrict,
    seedVendorPayableRows,
    transportVendorPayableRows,
    pcLedgerTransactions,
    expensesLedgerTransactions,
  ]);

  const visibleKpiItems =
    selectedKpiId != null ? kpiItems.filter((item) => item.id === selectedKpiId) : kpiItems;

  return (
    <div className="space-y-4 sm:space-y-6">
      {selectedKpiId != null ? (
        <button
          type="button"
          onClick={() => setSelectedKpiId(null)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue hover:text-blue-dark"
        >
          <span aria-hidden="true">←</span>
          All KPIs
        </button>
      ) : null}

      <OverviewKpiCards
        items={visibleKpiItems}
        selectedId={selectedKpiId}
        focused={selectedKpiId != null}
        onSelect={(id) => setSelectedKpiId(id)}
      />

      {selectedKpiId === SALES_KPI_ID ? (
        <OverviewSalesLedger
          financialYearLabel={financialYearLabel}
          rows={salesRows}
          finalPointQtyByDistrict={finalPointQtyByDistrict}
          incomeReceivedByDistrict={incomeReceivedByDistrict}
        />
      ) : selectedKpiId === SEED_VENDOR_KPI_ID ? (
        <OverviewSeedVendorLedger
          financialYearLabel={financialYearLabel}
          rows={seedVendorPayableRows}
        />
      ) : selectedKpiId === TRANSPORT_VENDOR_KPI_ID ? (
        <OverviewTransportVendorLedger
          financialYearLabel={financialYearLabel}
          rows={transportVendorPayableRows}
        />
      ) : selectedKpiId === PC_KPI_ID ? (
        <OverviewPcLedger
          financialYearLabel={financialYearLabel}
          salesRows={salesRows}
          transactions={pcLedgerTransactions}
        />
      ) : selectedKpiId === EXPENSES_KPI_ID ? (
        <OverviewExpensesLedger
          financialYearLabel={financialYearLabel}
          categoryNames={expenseCategoryNames}
          transactions={expensesLedgerTransactions}
        />
      ) : null}
    </div>
  );
}
