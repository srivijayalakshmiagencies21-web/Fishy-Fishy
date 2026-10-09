type OverviewTruckRow = {
  created_at?: string | null;
  primary_truck_id?: string | null;
  location_name?: string | null;
  end_type?: string | null;
  district?: { name?: string | null } | null;
};

function sortTrucks(trucks: OverviewTruckRow[]) {
  return [...trucks].sort(
    (a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime(),
  );
}

/** A journey skips transfer only when no truck routes through the transfer point. */
export function overviewSkipsTransfer(trucks: OverviewTruckRow[] | undefined | null) {
  const list = trucks ?? [];
  if (list.length === 0) return false;
  const usesTransfer = list.some((t) => t.primary_truck_id || t.end_type === "TRANSFER_POINT");
  return !usesTransfer;
}

/** Start location (first primary / earliest truck). */
export function overviewStartLocation(trucks: OverviewTruckRow[] | undefined | null) {
  const sorted = sortTrucks(trucks ?? []);
  const startPrimary = sorted.find((t) => !t.primary_truck_id) ?? sorted[0];
  return startPrimary?.location_name?.trim() || "Unknown";
}

/** Primaries created at start (same rules as startPrimaryTrucks). */
export function overviewStartTruckCount(trucks: OverviewTruckRow[] | undefined | null) {
  const sorted = sortTrucks(trucks ?? []);
  const startLocation = overviewStartLocation(sorted);
  return sorted.filter((truck) => {
    if (truck.primary_truck_id) return false;
    if (truck.end_type === "TRANSFER_POINT") return true;
    if (truck.end_type === "FINAL_POINT") {
      return (truck.location_name ?? startLocation) === startLocation;
    }
    return true;
  }).length;
}

function overviewSecondaryTrucks(trucks: OverviewTruckRow[], startLocation: string) {
  return sortTrucks(trucks).filter((truck) => {
    if (truck.primary_truck_id) return true;
    if (truck.end_type !== "FINAL_POINT") return false;
    return (truck.location_name ?? "") !== startLocation;
  });
}

/**
 * Trucks at transfer — same total as the transfer summary card:
 * start primaries plus loaded secondaries once transfer is recorded;
 * before that, primaries that end at the transfer point.
 */
export function overviewTransferTruckCount(trucks: OverviewTruckRow[] | undefined | null) {
  if (overviewSkipsTransfer(trucks)) return 0;
  const sorted = sortTrucks(trucks ?? []);
  const startLocation = overviewStartLocation(sorted);
  const secondaries = overviewSecondaryTrucks(sorted, startLocation);
  if (secondaries.length > 0) {
    return overviewStartTruckCount(sorted) + secondaries.length;
  }
  return sorted.filter((t) => !t.primary_truck_id && t.end_type === "TRANSFER_POINT").length;
}

/** Trucks that run the final unload leg (FINAL_POINT rows). */
export function overviewFinalTruckCount(trucks: OverviewTruckRow[] | undefined | null) {
  const sorted = sortTrucks(trucks ?? []);
  return sorted.filter((t) => t.end_type === "FINAL_POINT").length;
}

/** Transfer point name from secondaries created at transfer (or any truck not at start). */
export function overviewTransferLocation(trucks: OverviewTruckRow[] | undefined | null) {
  const sorted = sortTrucks(trucks ?? []);
  const startLocation = overviewStartLocation(sorted);
  const atTransfer = sorted.find(
    (t) => t.primary_truck_id && (t.location_name ?? "").trim() && t.location_name !== startLocation,
  );
  return atTransfer?.location_name?.trim() ?? "";
}

/** Destination district shown at final stop (primary final route or unload trucks). */
export function overviewFinalDistrict(trucks: OverviewTruckRow[] | undefined | null) {
  const sorted = sortTrucks(trucks ?? []);
  const directFinal = sorted.find((t) => !t.primary_truck_id && t.end_type === "FINAL_POINT");
  if (directFinal?.district?.name) return directFinal.district.name;

  const anyFinal = sorted.find((t) => t.end_type === "FINAL_POINT");
  if (anyFinal?.district?.name) return anyFinal.district.name;

  const startPrimary = sorted.find((t) => !t.primary_truck_id) ?? sorted[0];
  return startPrimary?.district?.name?.trim() || "Unknown";
}

export type OverviewTruckCounts = {
  start: number;
  transfer: number;
  final: number;
};

export function overviewTruckCounts(trucks: OverviewTruckRow[] | undefined | null): OverviewTruckCounts {
  return {
    start: overviewStartTruckCount(trucks),
    transfer: overviewTransferTruckCount(trucks),
    final: overviewFinalTruckCount(trucks),
  };
}
