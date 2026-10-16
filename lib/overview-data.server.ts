import "server-only";

import { financialYearIdForDate, type FinancialYear } from "@/lib/financial-year";
import type { GovtRateLedgerRow } from "@/lib/govt-rates";
import { fetchGovtRateLedger } from "@/lib/govt-rates.server";
import { fetchJourneyRatesData } from "@/lib/journey-rates.server";
import {
  expensesLedgerTransactionsForFinancialYear,
  overviewExpenseCategoryNames,
  type ExpensesLedgerTransactionRow,
} from "@/lib/overview-expenses";
import { pcLedgerTransactionsForFinancialYear, type PcLedgerTransactionRow } from "@/lib/overview-pc";
import { finalPointQtyByDistrictForFinancialYear } from "@/lib/overview-sales";
import {
  applySeedVendorPaid,
  seedVendorPayableRowsForFinancialYear,
  type SeedVendorPayableRow,
} from "@/lib/overview-seed-vendor-payable";
import {
  applyTransportVendorPaid,
  transportVendorPayableRowsForFinancialYear,
  type TransportVendorPayableRow,
} from "@/lib/overview-transport-vendor-payable";
import { aggregateVendorPaidFromTransactions } from "@/lib/overview-vendor-paid";
import { workspaceCache, type ServerSupabase, type SkipCache } from "@/lib/workspace-cache.server";

export type OverviewData = {
  salesRows: GovtRateLedgerRow[];
  finalPointQtyByDistrict: Record<number, number>;
  incomeReceivedByDistrict: Record<number, number>;
  seedVendorPayableRows: SeedVendorPayableRow[];
  transportVendorPayableRows: TransportVendorPayableRow[];
  pcLedgerTransactions: PcLedgerTransactionRow[];
  expensesLedgerTransactions: ExpensesLedgerTransactionRow[];
  expenseCategoryNames: string[];
};

const EMPTY_OVERVIEW: OverviewData = {
  salesRows: [],
  finalPointQtyByDistrict: {},
  incomeReceivedByDistrict: {},
  seedVendorPayableRows: [],
  transportVendorPayableRows: [],
  pcLedgerTransactions: [],
  expensesLedgerTransactions: [],
  expenseCategoryNames: [],
};

/** Every Overview KPI for one financial year, loaded in a single parallel batch. */
export function loadOverviewData(
  userId: string,
  financialYears: FinancialYear[],
  selectedYear: FinancialYear | null,
): Promise<OverviewData> {
  if (!selectedYear) return Promise.resolve(EMPTY_OVERVIEW);
  return workspaceCache(`overview:${selectedYear.id}`, userId, (supabase, skipCache) =>
    fetchOverviewData(supabase, skipCache, financialYears, selectedYear),
  );
}

async function fetchOverviewData(
  supabase: ServerSupabase,
  skipCache: SkipCache,
  financialYears: FinancialYear[],
  year: FinancialYear,
): Promise<OverviewData> {
  const [govtLedgerRows, journeyRates, outTxnResult, incomeResult, categoriesResult, districtsResult] =
    await Promise.all([
      fetchGovtRateLedger(supabase, skipCache),
      fetchJourneyRatesData(supabase, skipCache),
      supabase
        .from("transactions")
        .select("id, amount, category, district_id, txn_date, party, type")
        .eq("type", "out")
        .order("txn_date", { ascending: false })
        .order("id", { ascending: false }),
      (supabase as any)
        .from("transactions")
        .select("amount, district_id")
        .eq("type", "in")
        .eq("financial_year_id", year.id),
      supabase
        .from("transaction_categories")
        .select("name, transaction_type")
        .eq("active", true)
        .order("name"),
      supabase.from("districts").select("id, name"),
    ]);

  const salesRows = govtLedgerRows.filter((row) => row.financialYearId === year.id);
  const journeyRows = journeyRates.rows;
  const yearIdForDate = (isoDate: string) => financialYearIdForDate(financialYears, isoDate);

  const incomeReceivedByDistrict: Record<number, number> = {};
  if (incomeResult.error) {
    console.error("[overview] load income received failed:", incomeResult.error.message);
    skipCache();
  } else {
    for (const row of (incomeResult.data ?? []) as { amount: unknown; district_id: number | null }[]) {
      const districtId = row.district_id;
      const amount = Number(row.amount);
      if (districtId == null || !Number.isFinite(amount) || amount <= 0) continue;
      incomeReceivedByDistrict[districtId] = (incomeReceivedByDistrict[districtId] ?? 0) + amount;
    }
  }

  if (categoriesResult.error) {
    console.error("[overview] load expense categories failed:", categoriesResult.error.message);
    skipCache();
  }
  if (districtsResult.error) skipCache();

  const outRows = (outTxnResult.data ?? []).map((row) => ({
    id: row.id,
    amount: Number(row.amount),
    category: row.category,
    district_id: row.district_id,
    txn_date: row.txn_date,
    party: row.party,
    type: row.type,
  }));
  if (outTxnResult.error) {
    console.error("[overview] load out transactions failed:", outTxnResult.error.message);
    skipCache();
  }

  const paidTotals = outTxnResult.error
    ? { seedByKey: {}, transportByKey: {} }
    : aggregateVendorPaidFromTransactions(outRows, year.id, yearIdForDate);

  const districtNames: Record<number, string> = Object.fromEntries(
    salesRows.map((row) => [row.districtId, row.districtName]),
  );
  for (const row of districtsResult.data ?? []) {
    districtNames[row.id] = row.name;
  }

  return {
    salesRows,
    finalPointQtyByDistrict: finalPointQtyByDistrictForFinancialYear(journeyRows, year),
    incomeReceivedByDistrict,
    seedVendorPayableRows: applySeedVendorPaid(
      seedVendorPayableRowsForFinancialYear(journeyRows, year),
      paidTotals.seedByKey,
    ),
    transportVendorPayableRows: applyTransportVendorPaid(
      transportVendorPayableRowsForFinancialYear(journeyRows, year),
      paidTotals.transportByKey,
    ),
    pcLedgerTransactions: outTxnResult.error
      ? []
      : pcLedgerTransactionsForFinancialYear(outRows, year.id, yearIdForDate, districtNames),
    expensesLedgerTransactions: outTxnResult.error
      ? []
      : expensesLedgerTransactionsForFinancialYear(outRows, year.id, yearIdForDate),
    expenseCategoryNames: outTxnResult.error ? [] : overviewExpenseCategoryNames(categoriesResult.data ?? []),
  };
}
