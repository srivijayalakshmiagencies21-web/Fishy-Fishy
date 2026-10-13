import "server-only";

import type { FinancialYear } from "@/lib/financial-year";
import { loadOverviewJourneyRateRecords } from "@/lib/overview-journey-rates.server";
import { loadVendorPaidTotalsForFinancialYear } from "@/lib/overview-vendor-paid.server";
import {
  applyTransportVendorPaid,
  transportVendorPayableRowsForFinancialYear,
  type TransportVendorPayableRow,
} from "@/lib/overview-transport-vendor-payable";

export async function loadTransportVendorPayableRowsForYear(
  year: FinancialYear | null,
  allYears: FinancialYear[],
): Promise<TransportVendorPayableRow[]> {
  if (!year) return [];
  const [journeyRows, paidTotals] = await Promise.all([
    loadOverviewJourneyRateRecords(),
    loadVendorPaidTotalsForFinancialYear(year, allYears),
  ]);
  const billedRows = transportVendorPayableRowsForFinancialYear(journeyRows, year);
  return applyTransportVendorPaid(billedRows, paidTotals.transportByKey);
}
