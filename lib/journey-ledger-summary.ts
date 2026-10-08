import type { JourneySummary } from "@/lib/journey-cards";
import {
  formatDistanceLegs,
  legsFromTruckRow,
  totalDistanceKmFromLegs,
} from "@/lib/journey-odometer-legs";
import { overviewSkipsTransfer, overviewTransferLocation } from "@/lib/overview-journey-meta";
import { startSummaryItemsForTruck } from "@/lib/journey-start-summary";
import {
  finalUnloadTruckLabel,
  isSecondaryTruck,
  secondaryTrucksForPrimary,
  sortJourneyTrucks,
  startPrimaryEntries,
  startPrimaryTrucks,
} from "@/lib/journey-truck-labels";

type TruckRow = Record<string, unknown> & {
  id?: string;
  vehicle_number?: string;
  transporter?: { name?: string | null };
  odometer_reading?: number | string | null;
  odometer_image_path?: string | null;
  location_name?: string | null;
  district?: { name?: string | null };
  items?: Array<{
    supplier_id?: number;
    fish_id?: number;
    quantity?: unknown;
    supplier?: { name?: string | null };
    fish?: { fish_type?: string | null; seed_size?: string | null };
  }>;
  unload_drops?: Array<{
    quantity?: unknown;
    society?: { name?: string | null };
    supplier?: { name?: string | null };
    supplier_id?: number;
    fish_id?: number;
    fish?: { fish_type?: string | null; seed_size?: string | null };
  }>;
};

export type LedgerQtyLine = {
  key: string;
  supplier: string;
  fish: string;
  seedSize: string;
  purchased: number | null;
  transferred: number | null;
  dropped: number | null;
};

export type LedgerSocietyDrop = {
  society: string;
  lines: Array<{ supplier: string; fish: string; seedSize: string; quantity: number }>;
};

export type JourneyLedgerTruckRow = {
  truckId: string;
  label: string;
  transporter: string;
  vehicleNumber: string;
  routeLabel: string;
  kilometers: number | null;
  distanceLegsLabel: string | null;
  qtyLines: LedgerQtyLine[];
  societyDrops: LedgerSocietyDrop[];
};

export type JourneyLedgerSummary = {
  routeOverview: string;
  trucks: JourneyLedgerTruckRow[];
};

function itemKey(supplierId: number, fishId: number) {
  return `${supplierId}-${fishId}`;
}

function mergeQtyLines(lines: LedgerQtyLine[], patch: Partial<LedgerQtyLine> & { key: string }) {
  const existing = lines.find((row) => row.key === patch.key);
  if (existing) {
    if (patch.purchased != null) existing.purchased = patch.purchased;
    if (patch.transferred != null) existing.transferred = patch.transferred;
    if (patch.dropped != null) existing.dropped = patch.dropped;
    return;
  }
  lines.push({
    key: patch.key,
    supplier: patch.supplier ?? "Unknown",
    fish: patch.fish ?? "—",
    seedSize: patch.seedSize ?? "",
    purchased: patch.purchased ?? null,
    transferred: patch.transferred ?? null,
    dropped: patch.dropped ?? null,
  });
}

function purchasedLines(journey: JourneySummary, primary: TruckRow): LedgerQtyLine[] {
  const lines: LedgerQtyLine[] = [];
  for (const item of startSummaryItemsForTruck(journey, primary as any)) {
    if (!item.supplier_id || !item.fish_id) continue;
    const qty = Number(item.quantity) || 0;
    if (qty <= 0) continue;
    mergeQtyLines(lines, {
      key: itemKey(item.supplier_id, item.fish_id),
      supplier: item.supplier_name ?? item.supplier?.name ?? "Unknown",
      fish: item.fish_type ?? item.fish?.fish_type ?? "—",
      seedSize: item.seed_size ?? item.fish?.seed_size ?? "",
      purchased: qty,
    });
  }
  return lines;
}

function transferredLines(truck: TruckRow): LedgerQtyLine[] {
  const lines: LedgerQtyLine[] = [];
  for (const item of truck.items ?? []) {
    if (!item.supplier_id || !item.fish_id) continue;
    const qty = Number(item.quantity) || 0;
    if (qty <= 0) continue;
    mergeQtyLines(lines, {
      key: itemKey(item.supplier_id, item.fish_id),
      supplier: item.supplier?.name ?? "Unknown",
      fish: item.fish?.fish_type ?? "—",
      seedSize: item.fish?.seed_size ?? "",
      transferred: qty,
    });
  }
  return lines;
}

function droppedLines(truck: TruckRow): { totals: LedgerQtyLine[]; societies: LedgerSocietyDrop[] } {
  const totals: LedgerQtyLine[] = [];
  const bySociety = new Map<string, LedgerSocietyDrop>();

  for (const drop of truck.unload_drops ?? []) {
    const qty = Number(drop.quantity) || 0;
    if (qty <= 0 || !drop.supplier_id || !drop.fish_id) continue;
    const key = itemKey(drop.supplier_id, drop.fish_id);
    const supplier = drop.supplier?.name ?? "Unknown";
    const fish = drop.fish?.fish_type ?? "—";
    const seedSize = drop.fish?.seed_size ?? "";
    const existing = totals.find((row) => row.key === key);
    if (existing) {
      existing.dropped = (existing.dropped ?? 0) + qty;
    } else {
      mergeQtyLines(totals, { key, supplier, fish, seedSize, dropped: qty });
    }

    const societyName = drop.society?.name?.trim() || "Society";
    const society =
      bySociety.get(societyName) ??
      (() => {
        const row: LedgerSocietyDrop = { society: societyName, lines: [] };
        bySociety.set(societyName, row);
        return row;
      })();
    society.lines.push({ supplier, fish, seedSize, quantity: qty });
  }

  return { totals, societies: [...bySociety.values()] };
}

function combineQtyLines(...groups: LedgerQtyLine[][]): LedgerQtyLine[] {
  const map = new Map<string, LedgerQtyLine>();
  for (const group of groups) {
    for (const line of group) {
      const existing = map.get(line.key);
      if (!existing) {
        map.set(line.key, { ...line });
        continue;
      }
      if (line.purchased != null) existing.purchased = (existing.purchased ?? 0) + line.purchased;
      if (line.transferred != null) existing.transferred = (existing.transferred ?? 0) + line.transferred;
      if (line.dropped != null) existing.dropped = (existing.dropped ?? 0) + line.dropped;
    }
  }
  return [...map.values()].filter(
    (row) => (row.purchased ?? 0) > 0 || (row.transferred ?? 0) > 0 || (row.dropped ?? 0) > 0,
  );
}

function routeForTruck(journey: JourneySummary, truck: TruckRow, skipTransfer: boolean): string {
  const start = journey.startLocation;
  const transfer = overviewTransferLocation(journey.trucks) || truck.location_name?.trim() || "Transfer";
  const finalName = truck.district?.name?.trim() || journey.district || "Final";

  if (skipTransfer) {
    return `${start} → ${finalName}`;
  }
  if (truck.end_type === "TRANSFER_POINT") {
    return `${start} → ${transfer}`;
  }
  if (isSecondaryTruck(journey, truck as any)) {
    return `${transfer} → ${finalName}`;
  }
  if (truck.end_type === "FINAL_POINT") {
    const atStart = (truck.location_name ?? start) === start;
    if (atStart) return `${start} → ${finalName}`;
    return `${start} → ${transfer} → ${finalName}`;
  }
  return `${start} → ${finalName}`;
}

function distanceForTruck(journey: JourneySummary, truck: TruckRow, skipTransfer: boolean) {
  const legs = legsFromTruckRow(truck);
  const kilometers = totalDistanceKmFromLegs(legs, { skipTransfer });
  const distanceLegsLabel = formatDistanceLegs(legs, { skipTransfer });
  return { kilometers, distanceLegsLabel };
}

function buildTruckRow(
  journey: JourneySummary,
  truck: TruckRow,
  label: string,
  skipTransfer: boolean,
  primary?: TruckRow,
): JourneyLedgerTruckRow {
  const purchased = primary && truck.id !== primary.id ? [] : purchasedLines(journey, primary ?? truck);
  const transferred = transferredLines(truck);
  const { totals: droppedTotals, societies } = droppedLines(truck);
  const qtyLines = combineQtyLines(purchased, transferred, droppedTotals);
  const { kilometers, distanceLegsLabel } = distanceForTruck(journey, truck, skipTransfer);

  return {
    truckId: String(truck.id ?? label),
    label,
    transporter: truck.transporter?.name?.trim() || "—",
    vehicleNumber: String(truck.vehicle_number ?? "—"),
    routeLabel: routeForTruck(journey, truck, skipTransfer),
    kilometers,
    distanceLegsLabel,
    qtyLines,
    societyDrops: societies,
  };
}

/** Summarized ledger for overview (quantities, route, odometer km). */
export function buildJourneyLedgerSummary(journey: JourneySummary): JourneyLedgerSummary {
  const skipTransfer = overviewSkipsTransfer(journey.trucks);
  const transferName = skipTransfer ? null : overviewTransferLocation(journey.trucks);
  const finalName = journey.district || "Final";
  const routeOverview = skipTransfer
    ? `${journey.startLocation} → ${finalName}`
    : transferName
      ? `${journey.startLocation} → ${transferName} → ${finalName}`
      : `${journey.startLocation} → ${finalName}`;

  const trucks: JourneyLedgerTruckRow[] = [];

  for (const { truck: primary, primaryNumber } of startPrimaryEntries(journey)) {
    const primaryLabel = finalUnloadTruckLabel(journey, String(primary.id)).title.replace(" Details", "");
    if (primary.end_type === "TRANSFER_POINT") {
      trucks.push(buildTruckRow(journey, primary as TruckRow, primaryLabel, skipTransfer));
      for (const secondary of secondaryTrucksForPrimary(journey, String(primary.id))) {
        const secLabel = finalUnloadTruckLabel(journey, String(secondary.id)).title.replace(" Details", "");
        trucks.push(
          buildTruckRow(journey, secondary as TruckRow, secLabel, skipTransfer, primary as TruckRow),
        );
      }
      continue;
    }

    if (primary.end_type === "FINAL_POINT") {
      trucks.push(buildTruckRow(journey, primary as TruckRow, primaryLabel, skipTransfer));
    }
  }

  const seen = new Set(trucks.map((row) => row.truckId));
  for (const truck of sortJourneyTrucks(journey)) {
    if (!truck.id || seen.has(truck.id)) continue;
    if (truck.end_type !== "FINAL_POINT") continue;
    const label = finalUnloadTruckLabel(journey, String(truck.id)).title.replace(" Details", "");
    trucks.push(buildTruckRow(journey, truck as TruckRow, label, skipTransfer));
  }

  return { routeOverview, trucks };
}
