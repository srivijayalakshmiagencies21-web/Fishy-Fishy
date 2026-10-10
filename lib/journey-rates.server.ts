import "server-only";

import { JOURNEY_CARD_SELECT_FALLBACK, mapJourneySummaries, type JourneySummary } from "@/lib/journey-cards";
import {
  buildInitialRateMap,
  buildJourneyRateRecord,
  isClosedJourney,
  journeyRateStorageKey,
  type JourneyRateRecord,
  type JourneyRateSupplierLine,
  type JourneyRateTransporterLine,
} from "@/lib/journey-rates";
import { createClient } from "@/lib/supabase/server";

const JOURNEY_RATES_TRUCK_FIELDS = `
     start_odometer_reading,
     start_odometer_image_path,
     transfer_odometer_reading,
     transfer_odometer_image_path,
     final_odometer_reading,
     final_odometer_image_path,
     id,
     created_at,
     location_name,
     district_id,
     district:district_id(name),
     vehicle_number,
     driver_name,
     driver_phone,
     odometer_reading,
     odometer_image_path,
     end_type,
     primary_truck_id,
     transporter_id,
     transporter:transporter_id(name, transporter_scope),
     items:truck_items(
        supplier_id,
        fish_id,
        quantity,
        supplier:supplier_id(name),
        fish:fish_id(fish_type, seed_size)
     )
`;

const JOURNEY_RATES_SELECT = `
  journeyId:id,
  id:short_id,
  startTime:created_at,
  transferTime:transfer_at,
  finalTime:final_at,
  phase,
  trucks:journey_trucks(
     ${JOURNEY_RATES_TRUCK_FIELDS}
  )
`;

async function loadStartItemsByTruckId(supabase: Awaited<ReturnType<typeof createClient>>, truckIds: string[]) {
  const startItemsByTruckId = new Map<string, unknown[]>();
  if (truckIds.length === 0) return startItemsByTruckId;

  const { data: startRows, error } = await supabase
    .from("start_truck_items" as any)
    .select("truck_id, supplier_id, fish_id, quantity, supplier:supplier_id(name), fish:fish_id(fish_type, seed_size)")
    .in("truck_id", truckIds);

  if (!error && startRows) {
    for (const row of startRows as any[]) {
      const list = startItemsByTruckId.get(row.truck_id) ?? [];
      list.push(row);
      startItemsByTruckId.set(row.truck_id, list);
    }
  }
  return startItemsByTruckId;
}

async function fetchClosedJourneys(supabase: Awaited<ReturnType<typeof createClient>>): Promise<JourneySummary[]> {
  const fallbackSelect = JOURNEY_CARD_SELECT_FALLBACK.replace(
    "transporter:transporter_id(name)",
    "transporter:transporter_id(name, transporter_scope)",
  );

  let { data, error } = await supabase
    .from("journeys")
    .select(JOURNEY_RATES_SELECT as any)
    .in("phase", ["closed", "COMPLETED"])
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[journey-rates] fetch failed, retrying fallback:", error.message);
    ({ data, error } = await supabase
      .from("journeys")
      .select(fallbackSelect as any)
      .in("phase", ["closed", "COMPLETED"])
      .order("created_at", { ascending: true }));
    if (error) {
      console.error("[journey-rates] fallback fetch failed:", error.message);
      return [];
    }
  }

  const journeys = (data ?? []) as any[];
  const truckIds = journeys.flatMap((j) => (j.trucks ?? []).map((t: any) => t.id)).filter(Boolean);
  const startItemsByTruckId = await loadStartItemsByTruckId(supabase, truckIds);

  const withStartItems = journeys.map((j) => ({
    ...j,
    trucks: (j.trucks ?? []).map((t: any) => ({
      ...t,
      start_items: startItemsByTruckId.get(t.id) ?? [],
    })),
  }));

  return mapJourneySummaries(withStartItems).filter((row) => isClosedJourney(row.phase));
}

async function loadRateLinesByJourney(supabase: Awaited<ReturnType<typeof createClient>>, journeyIds: string[]) {
  const map = new Map<string, Map<string, number | null>>();
  if (journeyIds.length === 0) return map;

  const { data, error } = await (supabase as any)
    .from("journey_rate_lines")
    .select("journey_id, line_key, rate")
    .in("journey_id", journeyIds);

  if (error) {
    console.error("[journey-rates] could not load saved rates:", error.message);
    return map;
  }

  for (const row of (data ?? []) as { journey_id: string; line_key: string; rate: number | null }[]) {
    const byLine = map.get(row.journey_id) ?? new Map<string, number | null>();
    byLine.set(row.line_key, row.rate == null ? null : Number(row.rate));
    map.set(row.journey_id, byLine);
  }
  return map;
}

function applySavedRates(record: JourneyRateRecord, byLine: Map<string, number | null> | undefined): JourneyRateRecord {
  const rateFor = (lineKey: string) => byLine?.get(lineKey) ?? null;
  return {
    ...record,
    suppliers: record.suppliers.map((line: JourneyRateSupplierLine) => ({
      ...line,
      rate: rateFor(line.lineKey),
    })),
    localTransporters: record.localTransporters.map((line: JourneyRateTransporterLine) => ({
      ...line,
      rate: rateFor(line.lineKey),
    })),
    nonLocalTransporters: record.nonLocalTransporters.map((line: JourneyRateTransporterLine) => ({
      ...line,
      rate: rateFor(line.lineKey),
    })),
  };
}

async function journeyNumberById(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.from("journeys").select("id").order("created_at", { ascending: true });
  const map = new Map<string, number>();
  for (const [index, row] of (data ?? []).entries()) {
    map.set(row.id, index + 1);
  }
  return map;
}

function buildRateTextMap(
  rows: JourneyRateRecord[],
  ratesByJourney: Map<string, Map<string, number | null>>,
): Record<string, string> {
  const map = buildInitialRateMap(rows);
  for (const record of rows) {
    const byLine = ratesByJourney.get(record.journeyId);
    if (!byLine) continue;
    for (const [lineKey, rate] of byLine.entries()) {
      map[journeyRateStorageKey(record.journeyId, lineKey)] = rate != null ? String(rate) : "";
    }
  }
  return map;
}

export async function loadJourneyRatesData(): Promise<{
  rows: JourneyRateRecord[];
  initialRateTexts: Record<string, string>;
  error: string | null;
}> {
  try {
    const supabase = await createClient();
    const [summaries, numbers] = await Promise.all([
      fetchClosedJourneys(supabase),
      journeyNumberById(supabase),
    ]);
    const journeyIds = summaries.map((row) => row.journeyId);
    const ratesByJourney = await loadRateLinesByJourney(supabase, journeyIds);
    const ordered = [...summaries].sort((a, b) => {
      const aTime = a.finalTime ? Date.parse(a.finalTime) : 0;
      const bTime = b.finalTime ? Date.parse(b.finalTime) : 0;
      if (bTime !== aTime) return bTime - aTime;
      return (numbers.get(b.journeyId) ?? 0) - (numbers.get(a.journeyId) ?? 0);
    });

    const rows = ordered.map((summary) => {
      const record = buildJourneyRateRecord(summary, numbers.get(summary.journeyId) ?? summary.db_id);
      return applySavedRates(record, ratesByJourney.get(summary.journeyId));
    });
    return { rows, initialRateTexts: buildRateTextMap(rows, ratesByJourney), error: null };
  } catch (err) {
    return {
      rows: [],
      initialRateTexts: {},
      error: err instanceof Error ? err.message : "Could not load journey rates.",
    };
  }
}
