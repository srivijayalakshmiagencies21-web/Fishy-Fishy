export function truckItemKey(supplierId: number, fishId: number) {
  return `${supplierId}-${fishId}`;
}

export function parseTruckItemKey(key: string) {
  const [supplier_id, fish_id] = key.split("-").map(Number);
  return { supplier_id, fish_id };
}

type TruckItemRow = {
  supplier_id?: number;
  fish_id?: number;
  quantity?: unknown;
  fish?: { fish_type?: string; seed_size?: string | null };
};

type UnloadQtyLine = { itemKey: string; quantity: number | "" };
type UnloadQtyDrop = { id: string; lines: UnloadQtyLine[] };

function truckItemRows(truck: { items?: TruckItemRow[] | null }): TruckItemRow[] {
  return (truck.items ?? []).filter((item) => item.supplier_id && item.fish_id);
}

/** Quantity recorded at transfer for this supplier + fish (seed size is on fish master). */
export function transferQtyForItemKey(truck: { items?: TruckItemRow[] | null }, itemKey: string): number {
  const { supplier_id, fish_id } = parseTruckItemKey(itemKey);
  const item = truckItemRows(truck).find((row) => row.supplier_id === supplier_id && row.fish_id === fish_id);
  return Number(item?.quantity) || 0;
}

export function sumDroppedQtyForItemKey(
  drops: UnloadQtyDrop[],
  itemKey: string,
  options?: { ignoreQuantityAt?: { dropId: string; itemKey: string } },
): number {
  return drops.reduce((sum, drop) => {
    return (
      sum +
      drop.lines.reduce((lineSum, line) => {
        if (line.itemKey !== itemKey) return lineSum;
        if (
          options?.ignoreQuantityAt &&
          drop.id === options.ignoreQuantityAt.dropId &&
          line.itemKey === options.ignoreQuantityAt.itemKey
        ) {
          return lineSum;
        }
        return lineSum + (line.quantity === "" ? 0 : Number(line.quantity) || 0);
      }, 0)
    );
  }, 0);
}

/** Max quantity allowed on one line given quantities entered on other society drops/lines. */
export function maxQtyForUnloadLine(
  truck: { items?: TruckItemRow[] | null },
  drops: UnloadQtyDrop[],
  dropId: string,
  itemKey: string,
): number {
  const limit = transferQtyForItemKey(truck, itemKey);
  const usedElsewhere = sumDroppedQtyForItemKey(drops, itemKey, {
    ignoreQuantityAt: { dropId, itemKey },
  });
  return Math.max(0, limit - usedElsewhere);
}

export function clampUnloadLineQty(
  truck: { items?: TruckItemRow[] | null },
  drops: UnloadQtyDrop[],
  dropId: string,
  itemKey: string,
  quantity: number | "",
): number | "" {
  if (quantity === "") return "";
  const max = maxQtyForUnloadLine(truck, drops, dropId, itemKey);
  const n = Number(quantity) || 0;
  if (n <= 0) return "";
  return Math.min(n, max);
}

function itemDisplayLabel(truck: { items?: TruckItemRow[] | null }, itemKey: string): string {
  const { supplier_id, fish_id } = parseTruckItemKey(itemKey);
  const item = truckItemRows(truck).find((row) => row.supplier_id === supplier_id && row.fish_id === fish_id);
  const fish = item?.fish?.fish_type ?? "Fish";
  const seed = item?.fish?.seed_size?.trim();
  return seed ? `${fish} (${seed})` : fish;
}

/** Returns an error message when any fish line exceeds transfer quantities. */
export function validateTruckUnloadQuantities(
  truck: { items?: TruckItemRow[] | null },
  drops: UnloadQtyDrop[],
): string | null {
  const totals = new Map<string, number>();
  for (const drop of drops) {
    for (const line of drop.lines) {
      if (line.quantity === "" || Number(line.quantity) <= 0) continue;
      totals.set(line.itemKey, (totals.get(line.itemKey) ?? 0) + Number(line.quantity));
    }
  }

  for (const [key, dropped] of totals) {
    const limit = transferQtyForItemKey(truck, key);
    if (dropped > limit) {
      const label = itemDisplayLabel(truck, key);
      return `${label}: unload total ${dropped.toLocaleString()} exceeds transfer quantity ${limit.toLocaleString()}.`;
    }
  }

  return null;
}
