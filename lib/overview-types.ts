import type { JourneySummary } from "@/lib/journey-cards";

export type OverviewJourneyRow = JourneySummary & {
  skipsTransfer: boolean;
  truckCounts: { start: number; transfer: number; final: number };
  transferLocation: string;
  finalDistrict: string;
};
