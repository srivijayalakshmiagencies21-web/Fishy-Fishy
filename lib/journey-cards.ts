const JOURNEY_CARD_TRUCK_FIELDS = `
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
     transporter:transporter_id(name),
     items:truck_items(
        supplier_id,
        fish_id,
        quantity,
        supplier:supplier_id(name),
        fish:fish_id(fish_type, seed_size)
     ),
     unload_drops:truck_unload_drops(
        society_id,
        supplier_id,
        fish_id,
        quantity,
        society:society_id(name),
        supplier:supplier_id(name),
        fish:fish_id(fish_type, seed_size)
     )
`;

const JOURNEY_CARD_TRUCK_ODOMETER_STAGE_FIELDS = `
     start_odometer_reading,
     start_odometer_image_path,
     transfer_odometer_reading,
     transfer_odometer_image_path,
     final_odometer_reading,
     final_odometer_image_path,
`;

/** Full card query including per-leg odometer columns (requires migration). */
export const JOURNEY_CARD_SELECT = `
  journeyId:id,
  id:short_id,
  startTime:created_at,
  transferTime:transfer_at,
  finalTime:final_at,
  phase,
  trucks:journey_trucks(
     ${JOURNEY_CARD_TRUCK_ODOMETER_STAGE_FIELDS}
     ${JOURNEY_CARD_TRUCK_FIELDS}
  )
`;

/** Used when stage odometer columns are unavailable or PostgREST schema is stale. */
export const JOURNEY_CARD_SELECT_FALLBACK = `
  journeyId:id,
  id:short_id,
  startTime:created_at,
  transferTime:transfer_at,
  finalTime:final_at,
  phase,
  trucks:journey_trucks(
     ${JOURNEY_CARD_TRUCK_FIELDS}
  )
`;

export type JourneySummary = {
  db_id: number;
  id: string;
  journeyId: string;
  startLocation: string;
  district: string;
  districtId: number | null;
  startTime: string;
  transferTime?: string | null;
  finalTime?: string | null;
  phase?: string;
  trucks: any[];
};

/** Trucks that unload at final point (excludes primaries ending at transfer). */
export function trucksForFinalUnload(trucks: any[] | undefined | null): any[] {
  return (trucks ?? []).filter((truck) => truck.end_type === "FINAL_POINT");
}

export function mapJourneySummaries(journeys: any[]): JourneySummary[] {
  return journeys.map((j: any, idx: number) => {
    const trucks = [...(j.trucks ?? [])].sort(
      (a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime(),
    );
    const firstTruck = trucks[0];
    return {
      db_id: idx + 1,
      id: j.id,
      journeyId: j.journeyId,
      startLocation: firstTruck?.location_name || "Unknown Location",
      district: firstTruck?.district?.name || "Unknown District",
      districtId: firstTruck?.district_id ?? null,
      startTime: j.startTime,
      transferTime: j.transferTime ?? null,
      finalTime: j.finalTime ?? null,
      phase: j.phase as string,
      trucks,
    };
  });
}
