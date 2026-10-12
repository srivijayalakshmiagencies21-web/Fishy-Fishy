import type { JourneySummary } from "@/lib/journey-cards";
import { JourneyPhase, normalizeJourneyPhase } from "@/lib/journey-phase";

export function isTransferPointOdometerPath(path?: string | null) {
  return Boolean(path && /\/TP\//.test(path));
}

/** Transfer data saved to DB (not merely phase moved to transfer). */
export function hasPersistedTransferRecording(journey: JourneySummary): boolean {
  const phase = normalizeJourneyPhase(journey.phase);
  if (phase === JourneyPhase.Final || phase === JourneyPhase.Closed) return true;
  if (phase !== JourneyPhase.Transfer) return false;

  // `transfer_at` is set by the transfer submit and cleared when the recording is deleted.
  if (journey.transferTime) return true;

  // Journeys recorded before `transfer_at` existed: secondaries only exist after a transfer submit.
  return (journey.trucks ?? []).some((truck) => truck.primary_truck_id);
}
