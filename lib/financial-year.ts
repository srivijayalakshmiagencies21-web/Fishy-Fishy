import { isoCalendarDateInAppTimeZone, todayIsoDateInAppTimeZone } from "@/lib/ist-dates";

export const FINANCIAL_YEAR_COOKIE = "financial_year_id";

export type FinancialYear = {
  id: number;
  label: string;
  startDate: string;
  endDate: string;
};

export function mapFinancialYearRow(row: {
  id: number;
  label: string;
  start_date: string;
  end_date: string;
}): FinancialYear {
  return {
    id: row.id,
    label: row.label,
    startDate: row.start_date,
    endDate: row.end_date,
  };
}

/** Pick the FY that contains `isoDate` (YYYY-MM-DD, IST calendar), else the latest year by start date. */
export function financialYearIdForDate(years: FinancialYear[], isoDate: string): number | null {
  if (years.length === 0) return null;
  const match = years.find((y) => isoDate >= y.startDate && isoDate <= y.endDate);
  if (match) return match.id;
  const sorted = [...years].sort((a, b) => b.startDate.localeCompare(a.startDate));
  return sorted[0]?.id ?? null;
}

/** Map a journey close / event timestamp to an FY using its IST calendar date. */
export function financialYearIdForTimestamp(years: FinancialYear[], isoTimestamp: string): number | null {
  const isoDate = isoCalendarDateInAppTimeZone(isoTimestamp);
  if (!isoDate) return null;
  return financialYearIdForDate(years, isoDate);
}

/** Indian FY starting in April of `startYear` (e.g. 2028 → 2028-29, Apr 2028–Mar 2029). */
export function financialYearFromAprilStartYear(startYear: number) {
  if (!Number.isInteger(startYear) || startYear < 1990 || startYear > 2100) return null;
  const endYear = startYear + 1;
  const label = `${startYear}-${String(endYear).slice(-2)}`;
  return {
    label,
    startDate: `${startYear}-04-01`,
    endDate: `${endYear}-03-31`,
  };
}

export function suggestedNextAprilStartYear(years: FinancialYear[]): number {
  if (years.length === 0) {
    const today = todayIsoDateInAppTimeZone();
    const calendarYear = Number(today.slice(0, 4));
    const month = Number(today.slice(5, 7));
    return month >= 4 ? calendarYear : calendarYear - 1;
  }
  const sorted = [...years].sort((a, b) => b.startDate.localeCompare(a.startDate));
  const latestStart = Number(sorted[0]!.startDate.slice(0, 4));
  return latestStart + 1;
}
