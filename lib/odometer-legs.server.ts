import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { JourneySummary } from "@/lib/journey-cards";
import { legsFromTruckRow, type TruckOdometerLegs } from "@/lib/journey-odometer-legs";
import { secondaryTruckStorageLabel } from "@/lib/odometer-image";
import { primaryTruckNumber, secondaryTrucksForPrimary } from "@/lib/journey-truck-labels";

function sanitizeVehicleForPrefix(vehicleNumber: string) {
  return vehicleNumber
    .trim()
    .toUpperCase()
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 64) || "UNKNOWN";
}

async function readingFromStorageFolder(
  supabase: SupabaseClient,
  folderPath: string,
): Promise<number | null> {
  const { data, error } = await supabase.storage.from("images").list(folderPath, { limit: 5 });
  if (error || !data?.length) return null;
  for (const file of data) {
    const match = file.name.match(/^(\d+)\./);
    if (match) return Number(match[1]);
  }
  return null;
}

async function enrichLegsFromStorage(
  supabase: SupabaseClient,
  journeyNumber: number,
  truckSegment: string,
  vehicleNumber: string,
  legs: TruckOdometerLegs,
): Promise<TruckOdometerLegs> {
  const vehicle = sanitizeVehicleForPrefix(vehicleNumber);
  const base = `J${journeyNumber}/${truckSegment}/${vehicle}`;

  const next = { ...legs };
  if (next.start == null) {
    next.start = await readingFromStorageFolder(supabase, `${base}/SP`);
  }
  if (next.transfer == null) {
    next.transfer = await readingFromStorageFolder(supabase, `${base}/TP`);
  }
  if (next.final == null) {
    next.final = await readingFromStorageFolder(supabase, `${base}/FP`);
  }
  return next;
}

function truckStorageSegment(journey: JourneySummary, truck: Record<string, unknown>): string {
  const id = String(truck.id ?? "");
  if (truck.primary_truck_id) {
    const primaryId = String(truck.primary_truck_id);
    const primaryNum = primaryTruckNumber(journey, primaryId);
    const siblings = secondaryTrucksForPrimary(journey, primaryId);
    const index = siblings.findIndex((row) => row.id === id);
    return secondaryTruckStorageLabel(primaryNum, Math.max(0, index));
  }
  return `PT${primaryTruckNumber(journey, id)}`;
}

/** Fill missing SP/TP/FP readings from stored odometer photos (older journeys). */
export async function enrichJourneyOdometerLegs(
  supabase: SupabaseClient,
  journey: JourneySummary,
): Promise<JourneySummary> {
  const journeyNumber = journey.db_id;
  const trucks = await Promise.all(
    (journey.trucks ?? []).map(async (truck) => {
      let legs = legsFromTruckRow(truck);
      if (legs.start != null && legs.transfer != null && legs.final != null) {
        return truck;
      }

      const segment = truckStorageSegment(journey, truck as Record<string, unknown>);
      const vehicle = String(truck.vehicle_number ?? "UNKNOWN");
      legs = await enrichLegsFromStorage(supabase, journeyNumber, segment, vehicle, legs);

      return {
        ...truck,
        start_odometer_reading: legs.start ?? truck.start_odometer_reading ?? null,
        transfer_odometer_reading: legs.transfer ?? truck.transfer_odometer_reading ?? null,
        final_odometer_reading: legs.final ?? truck.final_odometer_reading ?? null,
      };
    }),
  );

  return { ...journey, trucks };
}
