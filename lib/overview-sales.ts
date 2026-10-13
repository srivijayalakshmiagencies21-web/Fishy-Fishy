import type { FinancialYear } from "@/lib/financial-year";
import { isoCalendarDateInAppTimeZone } from "@/lib/ist-dates";
import type { JourneyRateRecord } from "@/lib/journey-rates";

export function journeyClosedInFinancialYear(closedAt: string, year: FinancialYear): boolean {
  const isoDate = isoCalendarDateInAppTimeZone(closedAt);
  if (!isoDate) return false;
  return isoDate >= year.startDate && isoDate <= year.endDate;
}

/** Sum final-point unload qty per district for closed journeys in `year` (IST close date). */
export function finalPointQtyByDistrictForFinancialYear(
  records: JourneyRateRecord[],
  year: FinancialYear,
): Record<number, number> {
  const byDistrict: Record<number, number> = {};
  for (const record of records) {
    if (!record.closedAt || record.districtId == null) continue;
    if (!journeyClosedInFinancialYear(record.closedAt, year)) continue;
    const qty = record.finalPointQuantity;
    if (qty <= 0) continue;
    byDistrict[record.districtId] = (byDistrict[record.districtId] ?? 0) + qty;
  }
  return byDistrict;
}

export function salesAmount(rate: number | null, qty: number | null): number | null {
  if (rate == null || qty == null) return null;
  const product = rate * qty;
  if (!Number.isFinite(product)) return null;
  return product;
}

/** Current sales as a % of projected sales (fulfillment). */
export function salesFillRate(current: number | null, projected: number | null): number | null {
  if (projected == null || projected <= 0) return null;
  const currentValue = current ?? 0;
  if (!Number.isFinite(currentValue)) return null;
  const pct = (currentValue / projected) * 100;
  return Number.isFinite(pct) ? pct : null;
}

export function sumSalesAmounts(values: Array<number | null>): number | null {
  let total = 0;
  let hasValue = false;
  for (const value of values) {
    if (value == null) continue;
    hasValue = true;
    total += value;
  }
  return hasValue ? total : null;
}

export function totalSuppliedSalesAmount(
  rows: Array<{ districtId: number; rate: number | null }>,
  finalPointQtyByDistrict: Record<number, number>,
): number | null {
  return sumSalesAmounts(
    rows.map((row) => salesAmount(row.rate, finalPointQtyByDistrict[row.districtId] ?? 0)),
  );
}

/** Govt rates ledger: rate × recorded qty per district, summed for the FY. */
export function totalRecordedSalesAmount(
  rows: Array<{ rate: number | null; govtRecordedQty: number | null }>,
): number | null {
  return sumSalesAmounts(rows.map((row) => salesAmount(row.rate, row.govtRecordedQty)));
}

export function formatOverviewRatioPercent(
  numerator: number | null,
  denominator: number | null,
): string | null {
  const pct = salesFillRate(numerator, denominator);
  if (pct == null) return null;
  return `${pct.toLocaleString("en-IN", { maximumFractionDigits: 1 })}%`;
}
