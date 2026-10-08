/** Workflow phase stored on `journeys.phase` (not exposed in UI as DB enums). */
export const JourneyPhase = {
  Start: "start",
  Transfer: "transfer",
  Final: "final",
  Closed: "closed",
} as const;

export type JourneyPhaseValue = (typeof JourneyPhase)[keyof typeof JourneyPhase];

const LEGACY_PHASE: Record<string, JourneyPhaseValue> = {
  IN_TRANSIT: JourneyPhase.Start,
  AT_TRANSFER: JourneyPhase.Transfer,
  UNLOADING: JourneyPhase.Final,
  COMPLETED: JourneyPhase.Closed,
};

export function normalizeJourneyPhase(raw?: string | null): JourneyPhaseValue {
  if (!raw) return JourneyPhase.Start;
  return (LEGACY_PHASE[raw] ?? raw) as JourneyPhaseValue;
}

export function journeyPhaseAtTransferOrLater(phase?: string | null) {
  const value = normalizeJourneyPhase(phase);
  return value !== JourneyPhase.Start;
}
