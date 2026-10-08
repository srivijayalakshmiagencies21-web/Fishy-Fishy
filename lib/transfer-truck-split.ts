/** Transfer-created trucks are inserted after start trucks; gap in created_at separates batches. */

export const TRANSFER_TRUCK_GAP_MS = 5 * 60 * 1000;

export function splitStartAndTransferTruckIds(trucks: { id: string; created_at: string }[]) {
  if (trucks.length === 0) return { preserve: [] as string[], remove: [] as string[] };
  const sorted = [...trucks].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  let splitAt = sorted.length;
  for (let i = 1; i < sorted.length; i++) {
    const gap = new Date(sorted[i].created_at).getTime() - new Date(sorted[i - 1].created_at).getTime();
    if (gap > TRANSFER_TRUCK_GAP_MS) {
      splitAt = i;
      break;
    }
  }
  return {
    preserve: sorted.slice(0, splitAt).map((truck) => truck.id),
    remove: sorted.slice(splitAt).map((truck) => truck.id),
  };
}
