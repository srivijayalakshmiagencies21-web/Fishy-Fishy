import "server-only";

import type { FinancialYear } from "@/lib/financial-year";
import { finalPointQtyByDistrictForFinancialYear } from "@/lib/overview-sales";
import { loadOverviewJourneyRateRecords } from "@/lib/overview-journey-rates.server";

export async function loadFinalPointQtyByDistrictForYear(
  year: FinancialYear | null,
): Promise<Record<number, number>> {
  if (!year) return {};
  const rows = await loadOverviewJourneyRateRecords();
  return finalPointQtyByDistrictForFinancialYear(rows, year);
}
