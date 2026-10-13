import type { FinancialYear } from "@/lib/financial-year";
import { journeyFinalPointTotalQty } from "@/lib/journey-final-unload-summary";
import { JourneyPhase, normalizeJourneyPhase } from "@/lib/journey-phase";
import type { GovtRateLedgerRow } from "@/lib/govt-rates";
import { journeyClosedInFinancialYear, salesFillRate } from "@/lib/overview-sales";
import type { OverviewJourneyRow } from "@/lib/overview-types";

export type DistrictFulfillmentRow = {
  districtId: number;
  districtName: string;
  finalPointQty: number;
  allottedQty: number | null;
  fillPercent: number | null;
};

function finalQtyByDistrictId(journeys: OverviewJourneyRow[]): Map<number, { districtName: string; qty: number }> {
  const map = new Map<number, { districtName: string; qty: number }>();

  for (const journey of journeys) {
    const quantity = journeyFinalPointTotalQty(journey);
    if (quantity <= 0 || journey.finalDistrictId == null) continue;
    const districtName = journey.finalDistrict.trim() || "Unknown";
    const existing = map.get(journey.finalDistrictId) ?? { districtName, qty: 0 };
    existing.qty += quantity;
    map.set(journey.finalDistrictId, existing);
  }

  return map;
}

/** Final point qty vs govt allotted qty per district (FY govt ledger rows). */
export function timelineDistrictFulfillmentRows(
  journeys: OverviewJourneyRow[],
  govtRowsForYear: GovtRateLedgerRow[],
): DistrictFulfillmentRow[] {
  const finalByDistrict = finalQtyByDistrictId(journeys);
  const rows: DistrictFulfillmentRow[] = [];
  const seenIds = new Set<number>();

  for (const ledger of govtRowsForYear) {
    seenIds.add(ledger.districtId);
    const finalPointQty = finalByDistrict.get(ledger.districtId)?.qty ?? 0;
    const allottedQty = ledger.govtAllottedQty;
    rows.push({
      districtId: ledger.districtId,
      districtName: ledger.districtName,
      finalPointQty,
      allottedQty,
      fillPercent: salesFillRate(finalPointQty, allottedQty),
    });
  }

  for (const [districtId, { districtName, qty }] of finalByDistrict) {
    if (seenIds.has(districtId)) continue;
    rows.push({
      districtId,
      districtName,
      finalPointQty: qty,
      allottedQty: null,
      fillPercent: null,
    });
  }

  return rows.sort((a, b) => a.districtName.localeCompare(b.districtName));
}

/** Closed journeys: FY from close time (IST). In progress: FY from journey start (IST). */
export function overviewJourneyInFinancialYear(
  journey: OverviewJourneyRow,
  year: FinancialYear,
): boolean {
  const closed = normalizeJourneyPhase(journey.phase) === JourneyPhase.Closed;
  const instant = closed ? (journey.finalTime ?? journey.startTime) : journey.startTime;
  if (!instant) return false;
  return journeyClosedInFinancialYear(instant, year);
}
