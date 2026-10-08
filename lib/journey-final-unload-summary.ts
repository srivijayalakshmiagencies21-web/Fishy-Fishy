import { trucksForFinalUnload, type JourneySummary } from "@/lib/journey-cards";
import { truckEndTypeBadgeClass, truckEndTypeLabel } from "@/lib/journey-end-type-styles";
import { JourneyPhase, normalizeJourneyPhase } from "@/lib/journey-phase";
import type { JourneySummaryTruckRow } from "@/lib/journey-transfer-summary";

export function journeyUnloadSubmitted(journey: JourneySummary): boolean {
  if (normalizeJourneyPhase(journey.phase) === JourneyPhase.Closed) return true;
  return trucksForFinalUnload(journey.trucks).some((truck) => (truck.unload_drops ?? []).length > 0);
}

/** Summary card rows for final point after unload is recorded. */
export function buildFinalUnloadSummaryRows(journey: JourneySummary): JourneySummaryTruckRow[] {
  return trucksForFinalUnload(journey.trucks).map((truck) => ({
    truck,
    badge: truckEndTypeLabel(truck.end_type ?? "FINAL_POINT"),
    badgeClass: truckEndTypeBadgeClass(truck.end_type ?? "FINAL_POINT"),
  }));
}

export function truckSummaryQuantity(truck: Record<string, unknown>, mode: "items" | "unload_drops"): number {
  if (mode === "unload_drops") {
    return ((truck.unload_drops as any[]) ?? []).reduce(
      (sum, drop) => sum + (Number(drop.quantity) || 0),
      0,
    );
  }
  return ((truck.items as any[]) ?? []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
}
