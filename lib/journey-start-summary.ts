import type { JourneySummary } from "@/lib/journey-cards";
import { JourneyPhase, normalizeJourneyPhase } from "@/lib/journey-phase";
import { startPrimaryTrucks } from "@/lib/journey-truck-labels";

/** Map start-page journey payload to {@link JourneySummary} for truck helpers. */
export function toJourneySummary(journey: {
  phase?: string | null;
  trucks?: any[];
}): JourneySummary {
  const trucks = journey.trucks ?? [];
  const startPrimary = trucks.find((truck) => !truck.primary_truck_id);
  return {
    db_id: 0,
    id: "",
    journeyId: "",
    startLocation: startPrimary?.location_name ?? trucks[0]?.location_name ?? "",
    district: startPrimary?.district_name ?? trucks[0]?.district_name ?? "",
    districtId: startPrimary?.district_id ?? trucks[0]?.district_id ?? null,
    startTime: "",
    phase: journey.phase ?? undefined,
    trucks,
  };
}

/** Trucks created at start (excludes transfer secondaries). */
export function startSummaryTrucks(journey: { phase?: string | null; trucks?: any[] }) {
  return startPrimaryTrucks(toJourneySummary(journey));
}

export type StartSummaryItemRow = {
  supplier_id?: number;
  fish_id?: number;
  quantity?: unknown;
  supplier_name?: string;
  fish_type?: string;
  seed_size?: string;
  supplier?: { name?: string };
  fish?: { fish_type?: string; seed_size?: string | null };
};

export function startSummaryItemSupplierName(item: StartSummaryItemRow) {
  return item.supplier_name ?? item.supplier?.name ?? "Unknown";
}

export function startSummaryItemFishType(item: StartSummaryItemRow) {
  return item.fish_type ?? item.fish?.fish_type ?? "—";
}

export function startSummaryItemSeedSize(item: StartSummaryItemRow) {
  const size = item.seed_size ?? item.fish?.seed_size;
  return size && String(size).trim() ? String(size).trim() : "";
}

function mergeItemRows(rows: StartSummaryItemRow[]): StartSummaryItemRow[] {
  const map = new Map<string, StartSummaryItemRow>();
  for (const item of rows) {
    if (!item.supplier_id || !item.fish_id) continue;
    const key = `${item.supplier_id}-${item.fish_id}`;
    const qty = Number(item.quantity) || 0;
    if (qty <= 0) continue;
    const existing = map.get(key);
    if (existing) {
      existing.quantity = (Number(existing.quantity) || 0) + qty;
    } else {
      map.set(key, { ...item, quantity: qty });
    }
  }
  return Array.from(map.values());
}

/** Only quantities saved at start (`start_truck_items`, or live `truck_items` while still in transit). */
export function startSummaryItemsForTruck(
  journey: { phase?: string | null; trucks?: any[] },
  truck: { items?: StartSummaryItemRow[]; start_items?: StartSummaryItemRow[] },
): StartSummaryItemRow[] {
  const snapshot = truck.start_items ?? [];
  if (snapshot.length > 0) {
    return mergeItemRows(snapshot);
  }

  if (normalizeJourneyPhase(journey.phase) === JourneyPhase.Start) {
    return mergeItemRows(truck.items ?? []);
  }

  return [];
}

export function startSummaryTruckTotalQty(
  journey: { phase?: string | null; trucks?: any[] },
  truck: { items?: StartSummaryItemRow[]; start_items?: StartSummaryItemRow[] },
): number | null {
  const items = startSummaryItemsForTruck(journey, truck);
  if (
    items.length === 0 &&
    normalizeJourneyPhase(journey.phase) !== JourneyPhase.Start &&
    !(truck.start_items?.length)
  ) {
    return null;
  }
  return items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
}

export function startSummaryHasArchivedQuantities(
  journey: { phase?: string | null; trucks?: any[] },
): boolean {
  if (normalizeJourneyPhase(journey.phase) === JourneyPhase.Start) return true;
  return startSummaryTrucks(journey).some((truck) => (truck.start_items?.length ?? 0) > 0);
}
