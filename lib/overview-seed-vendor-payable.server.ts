import "server-only";

import type { FinancialYear } from "@/lib/financial-year";
import { loadOverviewJourneyRateRecords } from "@/lib/overview-journey-rates.server";
import { loadVendorPaidTotalsForFinancialYear } from "@/lib/overview-vendor-paid.server";
import {
  applySeedVendorPaid,
  seedVendorPayableRowsForFinancialYear,
  type SeedVendorPayableRow,
} from "@/lib/overview-seed-vendor-payable";

export async function loadSeedVendorPayableRowsForYear(
  year: FinancialYear | null,
  allYears: FinancialYear[],
): Promise<SeedVendorPayableRow[]> {
  if (!year) return [];
  const [journeyRows, paidTotals] = await Promise.all([
    loadOverviewJourneyRateRecords(),
    loadVendorPaidTotalsForFinancialYear(year, allYears),
  ]);
  const billedRows = seedVendorPayableRowsForFinancialYear(journeyRows, year);
  return applySeedVendorPaid(billedRows, paidTotals.seedByKey);
}
