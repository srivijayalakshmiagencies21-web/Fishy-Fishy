export type OdometerPointCode = "SP" | "TP" | "FP";

export type TruckOdometerLegs = {
  start: number | null;
  transfer: number | null;
  final: number | null;
};

export type TruckOdometerLegReadings = TruckOdometerLegs;

function numericReading(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Reading encoded in storage path, e.g. …/TP/1500.jpg */
export function parseOdometerReadingFromPath(path: string | null | undefined) {
  if (!path) return null;
  const match = path.match(/\/(SP|TP|FP)\/(\d+)\./i);
  if (!match) return null;
  return { point: match[1].toUpperCase() as OdometerPointCode, reading: Number(match[2]) };
}

export function legsFromTruckRow(truck: {
  start_odometer_reading?: unknown;
  transfer_odometer_reading?: unknown;
  final_odometer_reading?: unknown;
  odometer_reading?: unknown;
  odometer_image_path?: string | null;
}): TruckOdometerLegs {
  const legs: TruckOdometerLegs = {
    start: numericReading(truck.start_odometer_reading),
    transfer: numericReading(truck.transfer_odometer_reading),
    final: numericReading(truck.final_odometer_reading),
  };

  const parsed = parseOdometerReadingFromPath(truck.odometer_image_path);
  if (parsed) {
    if (parsed.point === "SP" && legs.start == null) legs.start = parsed.reading;
    if (parsed.point === "TP" && legs.transfer == null) legs.transfer = parsed.reading;
    if (parsed.point === "FP" && legs.final == null) legs.final = parsed.reading;
  }

  const live = numericReading(truck.odometer_reading);
  if (live != null && parsed) {
    if (parsed.point === "SP" && legs.start == null) legs.start = live;
    if (parsed.point === "TP" && legs.transfer == null) legs.transfer = live;
    if (parsed.point === "FP" && legs.final == null) legs.final = live;
  }

  return legs;
}

export function resolveStageOdometer(
  truck: {
    start_odometer_reading?: unknown;
    start_odometer_image_path?: string | null;
    transfer_odometer_reading?: unknown;
    transfer_odometer_image_path?: string | null;
    final_odometer_reading?: unknown;
    final_odometer_image_path?: string | null;
    odometer_reading?: unknown;
    odometer_image_path?: string | null;
  },
  stageOrLabel?: string,
): { reading: number | string | null; imagePath: string | null } {
  const norm = (stageOrLabel ?? "").toLowerCase();

  if (norm.includes("start")) {
    const reading =
      numericReading(truck.start_odometer_reading) ??
      parseOdometerReadingFromPath(truck.start_odometer_image_path)?.reading ??
      (truck.odometer_image_path && /\/SP\//.test(truck.odometer_image_path) ? numericReading(truck.odometer_reading) : null);
    const imagePath =
      truck.start_odometer_image_path ??
      (truck.odometer_image_path && /\/SP\//.test(truck.odometer_image_path) ? truck.odometer_image_path : null);
    return { reading, imagePath };
  }

  if (norm.includes("transfer")) {
    const reading =
      numericReading(truck.transfer_odometer_reading) ??
      parseOdometerReadingFromPath(truck.transfer_odometer_image_path)?.reading ??
      (truck.odometer_image_path && /\/TP\//.test(truck.odometer_image_path) ? numericReading(truck.odometer_reading) : null);
    const imagePath =
      truck.transfer_odometer_image_path ??
      (truck.odometer_image_path && /\/TP\//.test(truck.odometer_image_path) ? truck.odometer_image_path : null);
    return { reading, imagePath };
  }

  if (norm.includes("final")) {
    const reading =
      numericReading(truck.final_odometer_reading) ??
      parseOdometerReadingFromPath(truck.final_odometer_image_path)?.reading ??
      (truck.odometer_image_path && /\/FP\//.test(truck.odometer_image_path) ? numericReading(truck.odometer_reading) : null);
    const imagePath =
      truck.final_odometer_image_path ??
      (truck.odometer_image_path && /\/FP\//.test(truck.odometer_image_path) ? truck.odometer_image_path : null);
    return { reading, imagePath };
  }

  return {
    reading: numericReading(truck.odometer_reading),
    imagePath: truck.odometer_image_path ?? null,
  };
}

function legKm(from: number | null, to: number | null): number | null {
  if (from == null || to == null) return null;
  const delta = to - from;
  return delta >= 0 ? delta : null;
}

/**
 * Total distance for a truck across recorded legs.
 * Primary example: start 1000 → transfer 1500 → final 1600 ⇒ 500 + 100 = 600 km.
 */
export function totalDistanceKmFromLegs(
  legs: TruckOdometerLegs,
  options?: { skipTransfer?: boolean },
): number | null {
  if (options?.skipTransfer) {
    return legKm(legs.start, legs.final);
  }

  let total = 0;
  let hasLeg = false;

  const startToTransfer = legKm(legs.start, legs.transfer);
  if (startToTransfer != null) {
    total += startToTransfer;
    hasLeg = true;
  }

  const transferToFinal = legKm(legs.transfer, legs.final);
  if (transferToFinal != null) {
    total += transferToFinal;
    hasLeg = true;
  }

  if (!hasLeg) {
    const direct = legKm(legs.start, legs.final);
    if (direct != null) return direct;
    return null;
  }

  return total;
}

/** Human-readable leg breakdown for ledger UI. */
export function formatDistanceLegs(legs: TruckOdometerLegs, options?: { skipTransfer?: boolean }): string | null {
  const parts: string[] = [];
  if (!options?.skipTransfer) {
    const a = legKm(legs.start, legs.transfer);
    if (a != null) parts.push(`Start→Transfer ${a.toLocaleString()} km`);
  }
  const b = legKm(legs.transfer, legs.final);
  if (b != null) parts.push(`Transfer→Final ${b.toLocaleString()} km`);
  if (parts.length === 0) {
    const direct = legKm(legs.start, legs.final);
    if (direct != null) parts.push(`Start→Final ${direct.toLocaleString()} km`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Start reading before transfer overwrites the live odometer column. */
export function snapshotStartBeforeTransfer(truck: {
  odometer_reading?: unknown;
  odometer_image_path?: string | null;
  start_odometer_reading?: unknown;
  start_odometer_image_path?: string | null;
}): number | null {
  const reading = numericReading(truck.start_odometer_reading);
  if (reading != null) return reading;
  const fromStartPath = parseOdometerReadingFromPath(truck.start_odometer_image_path);
  if (fromStartPath) return fromStartPath.reading;
  const parsed = parseOdometerReadingFromPath(truck.odometer_image_path);
  if (parsed?.point === "SP") return parsed.reading;
  if (!truck.odometer_image_path || /\/SP\//.test(truck.odometer_image_path)) {
    return numericReading(truck.odometer_reading);
  }
  return null;
}

/** Transfer reading before final unload overwrites the live odometer column. */
export function snapshotTransferBeforeFinal(truck: {
  odometer_reading?: unknown;
  odometer_image_path?: string | null;
  transfer_odometer_reading?: unknown;
  transfer_odometer_image_path?: string | null;
  start_odometer_reading?: unknown;
}): number | null {
  const reading = numericReading(truck.transfer_odometer_reading);
  if (reading != null) return reading;
  const fromTransferPath = parseOdometerReadingFromPath(truck.transfer_odometer_image_path);
  if (fromTransferPath) return fromTransferPath.reading;
  const parsed = parseOdometerReadingFromPath(truck.odometer_image_path);
  if (parsed?.point === "TP") return parsed.reading;
  if (!truck.odometer_image_path || /\/TP\//.test(truck.odometer_image_path)) {
    return numericReading(truck.odometer_reading);
  }
  return null;
}
