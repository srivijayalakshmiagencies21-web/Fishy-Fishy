import type { JourneySummary } from "@/lib/journey-cards";
import { JourneyPhase, normalizeJourneyPhase } from "@/lib/journey-phase";
import { startPrimaryTrucks } from "@/lib/journey-truck-labels";

export function isTransferPointOdometerPath(path?: string | null) {
  return Boolean(path && /\/TP\//.test(path));
}

/** Transfer data saved to DB (not merely phase moved to transfer). */
export function hasPersistedTransferRecording(journey: JourneySummary): boolean {
  const phase = normalizeJourneyPhase(journey.phase);
  if (phase === JourneyPhase.Final || phase === JourneyPhase.Closed) return true;
  if (phase !== JourneyPhase.Transfer) return false;

  if ((journey.trucks ?? []).some((truck) => truck.primary_truck_id)) return true;

  for (const truck of startPrimaryTrucks(journey)) {
    if (
      truck.transfer_odometer_image_path ||
      truck.transfer_odometer_reading != null ||
      isTransferPointOdometerPath(truck.odometer_image_path as string | undefined)
    ) {
      return true;
    }
  }

  return false;
}
