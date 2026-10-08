import "server-only";

import { unstable_cache } from "next/cache";
import {
  JOURNEY_CARD_SELECT,
  JOURNEY_CARD_SELECT_FALLBACK,
  mapJourneySummaries,
  type JourneySummary,
} from "@/lib/journey-cards";
import {
  overviewFinalDistrict,
  overviewSkipsTransfer,
  overviewStartLocation,
  overviewTransferLocation,
  overviewTruckCounts,
} from "@/lib/overview-journey-meta";
import type { OverviewJourneyRow } from "@/lib/overview-types";
import { createClient } from "@/lib/supabase/server";

export type { OverviewJourneyRow } from "@/lib/overview-types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const JOURNEY_REVALIDATE_SEC = 30;

async function loadStartItemsByTruckId(supabase: SupabaseServerClient, truckIds: string[]) {
  const startItemsByTruckId = new Map<string, any[]>();
  if (truckIds.length === 0) return startItemsByTruckId;

  const { data: startRows, error: startItemsError } = await supabase
    .from("start_truck_items" as any)
    .select("truck_id, supplier_id, fish_id, quantity, supplier:supplier_id(name), fish:fish_id(fish_type, seed_size)")
    .in("truck_id", truckIds);

  if (!startItemsError && startRows) {
    for (const row of startRows as any[]) {
      const list = startItemsByTruckId.get(row.truck_id) ?? [];
      list.push(row);
      startItemsByTruckId.set(row.truck_id, list);
    }
  }
  return startItemsByTruckId;
}

async function loadStartJourneysRaw(supabase: SupabaseServerClient) {
  const [{ count: totalJourneys }, { data: journeys, error }] = await Promise.all([
    supabase.from("journeys").select("*", { count: "exact", head: true }),
    supabase
      .from("journeys")
      .select(`
      db_id:id,
      id:short_id,
      startTime:created_at,
      transferTime:transfer_at,
      finalTime:final_at,
      phase,
      trucks:journey_trucks(
         id,
         created_at,
         primary_truck_id,
         location_name,
         district_id,
         district:district_id(name),
         transporter_id,
         vehicle_number,
         driver_name,
         driver_phone,
         start_odometer_reading,
         start_odometer_image_path,
         transfer_odometer_reading,
         transfer_odometer_image_path,
         final_odometer_reading,
         final_odometer_image_path,
         odometer_reading,
         odometer_image_path,
         end_type,
         transporter:transporter_id(name),
         items:truck_items(
            id,
            supplier_id,
            fish_id,
            quantity,
            supplier:supplier_id(name),
            fish:fish_id(fish_type, seed_size)
         )
      )
    `)
      .in("phase", ["start", "transfer", "final", "closed"])
      .order("created_at", { ascending: true }),
  ]);

  const startItemsByTruckId = new Map<string, any[]>();
  if (!error && journeys?.length) {
    const truckIds = journeys.flatMap((j: any) => (j.trucks ?? []).map((t: any) => t.id)).filter(Boolean);
    if (truckIds.length > 0) {
      const { data: startRows, error: startItemsError } = await supabase
        .from("start_truck_items" as any)
        .select(
          "truck_id, supplier_id, fish_id, quantity, supplier:supplier_id(name), fish:fish_id(fish_type, seed_size)",
        )
        .in("truck_id", truckIds);
      if (!startItemsError && startRows) {
        for (const row of startRows as any[]) {
          const list = startItemsByTruckId.get(row.truck_id) ?? [];
          list.push(row);
          startItemsByTruckId.set(row.truck_id, list);
        }
      }
    }
  }

  let activeJourneys: any[] = [];
  if (!error && journeys) {
    activeJourneys = journeys.map((j: any, idx: number) => ({
      db_id: idx + 1,
      journeyId: j.db_id as string,
      id: j.id,
      phase: j.phase as string,
      startTime: j.startTime,
      transferTime: j.transferTime ?? null,
      finalTime: j.finalTime ?? null,
      trucks: [...(j.trucks ?? [])]
        .sort(
          (a: any, b: any) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime(),
        )
        .map((t: any) => ({
          id: t.id,
          created_at: t.created_at,
          primary_truck_id: t.primary_truck_id,
          location_name: t.location_name,
          district_id: t.district_id,
          district_name: t.district?.name || "Unknown District",
          transporter_id: t.transporter_id,
          vehicle_number: t.vehicle_number,
          driver_name: t.driver_name,
          driver_phone: t.driver_phone,
          start_odometer_reading: t.start_odometer_reading ?? null,
          start_odometer_image_path: t.start_odometer_image_path ?? null,
          transfer_odometer_reading: t.transfer_odometer_reading ?? null,
          transfer_odometer_image_path: t.transfer_odometer_image_path ?? null,
          final_odometer_reading: t.final_odometer_reading ?? null,
          final_odometer_image_path: t.final_odometer_image_path ?? null,
          odometer_reading: t.odometer_reading,
          odometer_image_path: t.odometer_image_path ?? null,
          end_type: t.end_type,
          transporter_name: t.transporter?.name || "Unknown",
          items:
            t.items?.map((item: any) => ({
              id: item.id,
              supplier_id: item.supplier_id,
              fish_id: item.fish_id,
              quantity: item.quantity,
              supplier_name: item.supplier?.name || "Unknown",
              fish_type: item.fish?.fish_type || "Unknown",
              seed_size: item.fish?.seed_size || "Unknown",
            })) || [],
          start_items: (startItemsByTruckId.get(t.id) ?? []).map((item: any) => ({
            supplier_id: item.supplier_id,
            fish_id: item.fish_id,
            quantity: item.quantity,
            supplier_name: item.supplier?.name || "Unknown",
            fish_type: item.fish?.fish_type || "Unknown",
            seed_size: item.fish?.seed_size || "Unknown",
          })),
        })) || [],
    }));
  }

  return { activeJourneys, totalJourneys: totalJourneys || 0 };
}

async function fetchJourneyCardRows(
  supabase: SupabaseServerClient,
  options?: { phases?: string[] },
) {
  let query = supabase.from("journeys").select(JOURNEY_CARD_SELECT).order("created_at", { ascending: true });
  if (options?.phases?.length) {
    query = query.in("phase", options.phases);
  }

  let { data, error } = await query;
  if (error) {
    console.error("[journeys] card fetch failed, retrying without odometer stage columns:", error.message);
    let fallbackQuery = supabase
      .from("journeys")
      .select(JOURNEY_CARD_SELECT_FALLBACK)
      .order("created_at", { ascending: true });
    if (options?.phases?.length) {
      fallbackQuery = fallbackQuery.in("phase", options.phases);
    }
    ({ data, error } = await fallbackQuery);
    if (error) {
      console.error("[journeys] card fallback fetch failed:", error.message);
      return [];
    }
  }
  return data ?? [];
}

async function loadJourneySummariesRaw(supabase: SupabaseServerClient, phases: string[]) {
  const journeys = await fetchJourneyCardRows(supabase, { phases });
  return journeys.length > 0 ? mapJourneySummaries(journeys) : [];
}

async function loadOverviewJourneysRaw(supabase: SupabaseServerClient): Promise<OverviewJourneyRow[]> {
  const journeys = await fetchJourneyCardRows(supabase);
  if (journeys.length === 0) return [];

  const truckIds = journeys.flatMap((j: any) => (j.trucks ?? []).map((t: any) => t.id)).filter(Boolean);
  const startItemsByTruckId = await loadStartItemsByTruckId(supabase, truckIds);

  const withStartItems = journeys.map((j: any) => ({
    ...j,
    trucks: (j.trucks ?? []).map((t: any) => ({
      ...t,
      start_items: startItemsByTruckId.get(t.id) ?? [],
    })),
  }));

  const rows: OverviewJourneyRow[] = mapJourneySummaries(withStartItems).map((summary) => {
    const trucks = summary.trucks;
    return {
      ...summary,
      startLocation: overviewStartLocation(trucks),
      skipsTransfer: overviewSkipsTransfer(trucks),
      truckCounts: overviewTruckCounts(trucks),
      transferLocation: overviewTransferLocation(trucks),
      finalDistrict: overviewFinalDistrict(trucks),
    };
  });
  rows.reverse();
  return rows;
}

async function journeyCache<T>(
  key: string,
  userId: string,
  loader: (supabase: SupabaseServerClient) => Promise<T>,
): Promise<T> {
  const supabase = await createClient();
  return unstable_cache(() => loader(supabase), [`${key}-v4`, userId], {
    revalidate: JOURNEY_REVALIDATE_SEC,
    tags: ["journeys", `journeys:${userId}`],
  })();
}

export function loadStartPageJourneys(userId: string): Promise<{ activeJourneys: any[]; totalJourneys: number }> {
  return journeyCache("journeys-start", userId, loadStartJourneysRaw);
}

export function loadTransferJourneys(userId: string): Promise<JourneySummary[]> {
  return journeyCache("journeys-transfer", userId, (supabase) =>
    loadJourneySummariesRaw(supabase, ["start", "transfer", "final", "closed"]),
  );
}

export function loadFinalJourneys(userId: string): Promise<JourneySummary[]> {
  return journeyCache("journeys-final", userId, (supabase) =>
    loadJourneySummariesRaw(supabase, ["transfer", "final", "closed"]),
  );
}

/** Overview always loads fresh (no unstable_cache) so auth + schema changes are not masked. */
export async function loadOverviewJourneys(_userId: string): Promise<OverviewJourneyRow[]> {
  const supabase = await createClient();
  return loadOverviewJourneysRaw(supabase);
}
