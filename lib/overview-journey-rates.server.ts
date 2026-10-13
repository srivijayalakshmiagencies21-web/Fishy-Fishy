import "server-only";

import { cache } from "react";
import type { JourneyRateRecord } from "@/lib/journey-rates";
import { loadJourneyRatesData } from "@/lib/journey-rates.server";

export const loadOverviewJourneyRateRecords = cache(async (): Promise<JourneyRateRecord[]> => {
  const { rows } = await loadJourneyRatesData();
  return rows;
});
