import type { JourneySummary } from "@/lib/journey-cards";
import { truckEndTypeBadgeClass, truckEndTypeLabel } from "@/lib/journey-end-type-styles";
import {
  secondaryTrucksForPrimary,
  sortJourneyTrucks,
  startPrimaryEntries,
  startPrimaryTrucks,
} from "@/lib/journey-truck-labels";

export type JourneySummaryTruckRow = {
  truck: Record<string, unknown>;
  badge: string;
  badgeClass: string;
};

/** Collapsed card rows after transfer: start primaries, then loaded secondaries (no duplicate DB noise). */
export function buildTransferSummaryRows(journey: JourneySummary): JourneySummaryTruckRow[] {
  const rows: JourneySummaryTruckRow[] = [];

  for (const truck of startPrimaryTrucks(journey)) {
    rows.push({
      truck,
      badge: truckEndTypeLabel(truck.end_type),
      badgeClass: truckEndTypeBadgeClass(truck.end_type),
    });
  }

  for (const { truck: primary } of startPrimaryEntries(journey)) {
    const secondaries = secondaryTrucksForPrimary(journey, primary.id);
    for (const secondary of secondaries) {
      rows.push({
        truck: secondary,
        badge: truckEndTypeLabel(secondary.end_type),
        badgeClass: truckEndTypeBadgeClass(secondary.end_type),
      });
    }
  }

  return rows;
}

/** Default list: all trucks in creation order (starting point view). */
export function buildDefaultSummaryRows(journey: JourneySummary): JourneySummaryTruckRow[] {
  return sortJourneyTrucks(journey).map((truck) => ({
    truck,
    badge: truckEndTypeLabel(truck.end_type),
    badgeClass: truckEndTypeBadgeClass(truck.end_type),
  }));
}
