import type { JourneySummary } from "@/lib/journey-cards";

export function secondaryTruckCode(primaryNumber: number, secondaryIndex: number) {
  const letter = String.fromCharCode(65 + secondaryIndex);
  return `${primaryNumber}${letter}`;
}

export function sortJourneyTrucks(journey: JourneySummary) {
  return [...(journey.trucks ?? [])].sort(
    (a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime(),
  );
}

/** Start-point primaries (no parent truck). */
export function startPrimaryTrucks(journey: JourneySummary) {
  const startLocation = journey.startLocation;
  return sortJourneyTrucks(journey).filter((truck) => {
    if (truck.primary_truck_id) return false;
    if (truck.end_type === "TRANSFER_POINT") return true;
    if (truck.end_type === "FINAL_POINT") {
      return (truck.location_name ?? startLocation) === startLocation;
    }
    return true;
  });
}

export function legacyTransferPrimaryId(journey: JourneySummary) {
  return startPrimaryTrucks(journey).find((truck) => truck.end_type === "TRANSFER_POINT")?.id ?? null;
}

export function primaryTruckNumber(journey: JourneySummary, primaryTruckId: string) {
  const primaries = startPrimaryTrucks(journey);
  const index = primaries.findIndex((truck) => truck.id === primaryTruckId);
  return index >= 0 ? index + 1 : 1;
}

export function isSecondaryTruck(
  journey: JourneySummary,
  truck: { end_type?: string; primary_truck_id?: string | null; location_name?: string },
) {
  if (truck.primary_truck_id) return true;
  if (truck.end_type !== "FINAL_POINT") return false;
  return (truck.location_name ?? "") !== journey.startLocation;
}

function resolvePrimaryId(journey: JourneySummary, truck: { primary_truck_id?: string | null }) {
  return truck.primary_truck_id ?? legacyTransferPrimaryId(journey);
}

/** Secondaries for one start primary, in creation order (matches transfer 1A, 1B, …). */
export function secondaryTrucksForPrimary(journey: JourneySummary, primaryTruckId: string) {
  return sortJourneyTrucks(journey).filter(
    (row) =>
      row.end_type === "FINAL_POINT" &&
      isSecondaryTruck(journey, row) &&
      resolvePrimaryId(journey, row) === primaryTruckId,
  );
}

/** Start primaries for carousels (excludes transfer-created secondaries). */
export function startPrimaryEntries(journey: JourneySummary) {
  return startPrimaryTrucks(journey).map((truck, index) => ({
    truck,
    primaryNumber: index + 1,
  }));
}

export type FinalUnloadTruckLabel = {
  title: string;
  subtitle: string;
  kind: "primary" | "secondary";
  primaryTruckId: string | null;
  primaryNumber: number | null;
};

export function finalUnloadTruckLabel(journey: JourneySummary, truckId: string): FinalUnloadTruckLabel {
  const sorted = sortJourneyTrucks(journey);
  const truck = sorted.find((row) => row.id === truckId);
  if (!truck) {
    return { title: "Truck details", subtitle: "", kind: "secondary", primaryTruckId: null, primaryNumber: null };
  }

  const primaries = startPrimaryTrucks(journey);

  if (!isSecondaryTruck(journey, truck)) {
    const num = primaries.findIndex((row) => row.id === truckId) + 1;
    return {
      title: `Primary Truck ${num} Details`,
      subtitle: "Ends at final point",
      kind: "primary",
      primaryTruckId: truck.id,
      primaryNumber: num,
    };
  }

  const primaryId = resolvePrimaryId(journey, truck);
  const primaryNum = primaryId ? primaryTruckNumber(journey, primaryId) : 1;
  const primaryTruck = primaryId ? sorted.find((row) => row.id === primaryId) : primaries[0];
  const siblings = primaryId ? secondaryTrucksForPrimary(journey, primaryId) : [];
  const secIndex = siblings.findIndex((row) => row.id === truckId);
  const code = secondaryTruckCode(primaryNum, Math.max(0, secIndex));
  const primaryVehicle = primaryTruck?.vehicle_number ?? "—";

  return {
    title: `Secondary Truck ${code} Details`,
    subtitle: `From primary truck ${primaryNum} (${primaryVehicle})`,
    kind: "secondary",
    primaryTruckId: primaryId,
    primaryNumber: primaryNum,
  };
}

export type FinalUnloadGroup = {
  primaryId: string;
  primaryNumber: number;
  primaryVehicle: string;
  endsAtTransfer: boolean;
  unloadTrucks: any[];
};

/** Group final-unload trucks under their start primary (transfer primaries as anchors). */
export function finalUnloadGroups(journey: JourneySummary, unloadTrucks: any[]): FinalUnloadGroup[] {
  const primaries = startPrimaryTrucks(journey);
  const legacyPrimaryId = legacyTransferPrimaryId(journey);
  const byPrimary = new Map<string, any[]>();

  for (const truck of unloadTrucks) {
    if (isSecondaryTruck(journey, truck)) {
      const pid = resolvePrimaryId(journey, truck) ?? legacyPrimaryId;
      if (!pid) continue;
      const list = byPrimary.get(pid) ?? [];
      list.push(truck);
      byPrimary.set(pid, list);
      continue;
    }
    byPrimary.set(truck.id, [truck]);
  }

  const groups: FinalUnloadGroup[] = [];
  for (const primary of primaries) {
    const trucks = byPrimary.get(primary.id);
    if (!trucks?.length) continue;
    groups.push({
      primaryId: primary.id,
      primaryNumber: primaries.findIndex((row) => row.id === primary.id) + 1,
      primaryVehicle: primary.vehicle_number ?? "—",
      endsAtTransfer: primary.end_type === "TRANSFER_POINT",
      unloadTrucks: [...trucks].sort(
        (a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime(),
      ),
    });
    byPrimary.delete(primary.id);
  }

  for (const [primaryId, trucks] of byPrimary) {
    const primary = primaries.find((row) => row.id === primaryId);
    groups.push({
      primaryId,
      primaryNumber: primary ? primaries.findIndex((row) => row.id === primaryId) + 1 : 0,
      primaryVehicle: primary?.vehicle_number ?? trucks[0]?.vehicle_number ?? "—",
      endsAtTransfer: primary?.end_type === "TRANSFER_POINT",
      unloadTrucks: trucks,
    });
  }

  return groups.sort((a, b) => a.primaryNumber - b.primaryNumber);
}
