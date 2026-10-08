import { JourneyPhase, normalizeJourneyPhase } from "@/lib/journey-phase";

export type JourneyPointPage = "start" | "transfer" | "final";

/**
 * Per-page lane: only "In progress" vs "Closed", driven by journeys.phase.
 *
 * start    → start in progress; transfer in progress (Start transfer); final closed
 * transfer → start closed; transfer in progress; final closed
 * final    → start/transfer closed; transfer/final in progress on final page; closed when closed
 * closed   → closed on all pages
 */
export function isJourneyClosedOnPoint(page: JourneyPointPage, phase?: string | null) {
  const value = normalizeJourneyPhase(phase);
  if (page === "start") return value !== JourneyPhase.Start;
  if (page === "transfer") {
    return value === JourneyPhase.Final || value === JourneyPhase.Closed;
  }
  if (page === "final") return value === JourneyPhase.Closed;
  return true;
}

export function splitJourneysByPointLane<T extends { phase?: string | null }>(
  page: JourneyPointPage,
  journeys: T[],
) {
  const inProgress: T[] = [];
  const closed: T[] = [];
  for (const journey of journeys) {
    if (isJourneyClosedOnPoint(page, journey.phase)) closed.push(journey);
    else inProgress.push(journey);
  }
  return { inProgress, closed };
}

export type JourneyPointBadgeLabel = "In progress" | "Closed";

export function journeyPointBadgeLabel(
  page: JourneyPointPage,
  phase?: string | null,
): JourneyPointBadgeLabel {
  return isJourneyClosedOnPoint(page, phase) ? "Closed" : "In progress";
}

/** Overview card: closed only when the full journey is closed. */
export function overviewJourneyBadgeLabel(phase?: string | null): JourneyPointBadgeLabel {
  return normalizeJourneyPhase(phase) === JourneyPhase.Closed ? "Closed" : "In progress";
}
