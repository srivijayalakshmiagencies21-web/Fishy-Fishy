import type { JourneySummary } from "@/lib/journey-cards";
import {
  formatDistanceLegs,
  legsFromTruckRow,
  totalDistanceKmFromLegs,
} from "@/lib/journey-odometer-legs";
import { overviewSkipsTransfer } from "@/lib/overview-journey-meta";
import {
  startSummaryItemFishType,
  startSummaryItemSeedSize,
  startSummaryItemSupplierName,
  startSummaryItemsForTruck,
} from "@/lib/journey-start-summary";
import { sortJourneyTrucks, startPrimaryTrucks } from "@/lib/journey-truck-labels";
import { normalizeJourneyPhase, JourneyPhase } from "@/lib/journey-phase";

export function supplierRateLineKey(supplierId: number, fishId: number) {
  return `s:${supplierId}:${fishId}`;
}

export function transporterRateLineKey(truckId: string) {
  return `t:${truckId}`;
}

export type JourneyRateSupplierLine = {
  lineKey: string;
  supplier: string;
  fishType: string;
  seedSize: string;
  quantity: number;
  rate: number | null;
};

export type JourneyRateTransporterLine = {
  lineKey: string;
  transporter: string;
  vehicleNumber: string;
  kilometers: number | null;
  distanceLegsLabel: string | null;
  rate: number | null;
};

export type JourneyRateRecord = {
  journeyNumber: number;
  shortId: string;
  journeyId: string;
  closedAt: string | null;
  suppliers: JourneyRateSupplierLine[];
  localTransporters: JourneyRateTransporterLine[];
  nonLocalTransporters: JourneyRateTransporterLine[];
};

type TruckRow = Record<string, unknown> & {
  vehicle_number?: string;
  start_odometer_reading?: unknown;
  transfer_odometer_reading?: unknown;
  final_odometer_reading?: unknown;
  odometer_reading?: unknown;
  odometer_image_path?: string | null;
  transporter?: {
    name?: string | null;
    transporter_scope?: string | null;
  };
};

function transporterScope(truck: TruckRow): "Local" | "Non-Local" | null {
  const raw = truck.transporter?.transporter_scope?.trim();
  if (raw === "Local" || raw === "Non-Local") return raw;
  return null;
}

function distanceForTruck(journey: JourneySummary, truck: TruckRow) {
  const skipTransfer = overviewSkipsTransfer(journey.trucks);
  const legs = legsFromTruckRow(truck);
  return {
    kilometers: totalDistanceKmFromLegs(legs, { skipTransfer }),
    distanceLegsLabel: formatDistanceLegs(legs, { skipTransfer }),
  };
}

export function buildJourneySupplierLines(journey: JourneySummary): JourneyRateSupplierLine[] {
  const map = new Map<string, JourneyRateSupplierLine>();

  for (const truck of startPrimaryTrucks(journey)) {
    for (const item of startSummaryItemsForTruck(journey, truck)) {
      const supplier = startSummaryItemSupplierName(item);
      const fishType = startSummaryItemFishType(item);
      const seedSize = startSummaryItemSeedSize(item);
      const quantity = Number(item.quantity) || 0;
      if (quantity <= 0) continue;

      const supplierId = item.supplier_id;
      const fishId = item.fish_id;
      if (!supplierId || !fishId) continue;

      const key = supplierRateLineKey(supplierId, fishId);
      const existing = map.get(key);
      if (existing) {
        existing.quantity += quantity;
      } else {
        map.set(key, {
          lineKey: key,
          supplier,
          fishType,
          seedSize,
          quantity,
          rate: null,
        });
      }
    }
  }

  return [...map.values()].sort((a, b) => {
    const bySupplier = a.supplier.localeCompare(b.supplier);
    if (bySupplier !== 0) return bySupplier;
    const byFish = a.fishType.localeCompare(b.fishType);
    if (byFish !== 0) return byFish;
    return a.seedSize.localeCompare(b.seedSize);
  });
}

function buildTransporterLinesForScope(
  journey: JourneySummary,
  scope: "Local" | "Non-Local",
): JourneyRateTransporterLine[] {
  const lines: JourneyRateTransporterLine[] = [];

  for (const truck of sortJourneyTrucks(journey)) {
    if (transporterScope(truck as TruckRow) !== scope) continue;
    const truckId = String(truck.id ?? "");
    if (!truckId) continue;
    const { kilometers, distanceLegsLabel } = distanceForTruck(journey, truck as TruckRow);
    lines.push({
      lineKey: transporterRateLineKey(truckId),
      transporter: truck.transporter?.name?.trim() || "Unknown",
      vehicleNumber: truck.vehicle_number?.trim() || "—",
      kilometers,
      distanceLegsLabel,
      rate: null,
    });
  }

  return lines;
}

export function buildJourneyRateRecord(journey: JourneySummary, journeyNumber: number): JourneyRateRecord {
  return {
    journeyNumber,
    shortId: journey.id,
    journeyId: journey.journeyId,
    closedAt: journey.finalTime ?? null,
    suppliers: buildJourneySupplierLines(journey),
    localTransporters: buildTransporterLinesForScope(journey, "Local"),
    nonLocalTransporters: buildTransporterLinesForScope(journey, "Non-Local"),
  };
}

export function isClosedJourney(phase?: string | null) {
  return normalizeJourneyPhase(phase) === JourneyPhase.Closed;
}

export function journeyRateStorageKey(journeyId: string, lineKey: string) {
  return `${journeyId}:${lineKey}`;
}

export function supplierAdditionalChargeKey(groupTitle: string) {
  return `additional:supplier:${groupTitle.trim().toLowerCase()}`;
}

export function transporterAdditionalChargeKey(scope: "local" | "non-local", groupTitle: string) {
  return `additional:transporter:${scope}:${groupTitle.trim().toLowerCase()}`;
}

export function parseChargeAmount(rateText: string): number {
  const trimmed = rateText.trim();
  if (!trimmed) return 0;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

export function computeLineAmount(multiplier: number | null, rateText: string): number | null {
  if (multiplier == null) return null;
  const trimmed = rateText.trim();
  if (!trimmed) return null;
  const rate = Number(trimmed);
  if (!Number.isFinite(rate) || rate < 0) return null;
  return multiplier * rate;
}

export function buildInitialRateMap(rows: JourneyRateRecord[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const record of rows) {
    for (const line of [
      ...record.suppliers,
      ...record.localTransporters,
      ...record.nonLocalTransporters,
    ]) {
      const key = journeyRateStorageKey(record.journeyId, line.lineKey);
      map[key] = line.rate != null ? String(line.rate) : "";
    }
  }
  return map;
}
