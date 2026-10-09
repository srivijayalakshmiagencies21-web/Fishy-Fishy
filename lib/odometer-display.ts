/** Client-safe helpers for showing stored odometer captures (no server imports). */

export function getFileExtension(fileOrName: File | string | null | undefined): string {
  if (!fileOrName) return "jpg";
  const name = typeof fileOrName === "string" ? fileOrName : fileOrName.name;
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext && /^[a-z0-9]{2,5}$/.test(ext)) return ext;
  return "jpg";
}

export function photoLabelFromStoragePath(path: string | null | undefined) {
  if (!path) return null;
  return path.trim();
}

function parseStoragePathParts(path: string): string[] {
  return path.split("/").filter(Boolean);
}

function journeyLabelFromPart(part: string, journeyNumber?: number | string | null): string {
  if (journeyNumber != null && journeyNumber !== "") return `J${journeyNumber}`;
  if (/^\d+$/.test(part)) return `J${part}`;
  if (part.startsWith("J")) return part;
  return `J${part}`;
}

function segmentFromPart(part: string): string | null {
  if (/^(PT|ST)\d/i.test(part)) return part.toUpperCase();
  return null;
}

function pointFromStorageParts(parts: string[]): "SP" | "TP" | "FP" | null {
  // J1/PT1/VEH/TP/45000.jpg
  if (parts.length >= 5) {
    const candidate = parts[parts.length - 2] ?? "";
    if (/^(SP|TP|FP)$/i.test(candidate)) return candidate.toUpperCase() as "SP" | "TP" | "FP";
  }
  const fileStem = (parts[parts.length - 1] ?? "").split(".")[0] ?? "";
  if (/^(SP|TP|FP)$/i.test(fileStem)) return fileStem.toUpperCase() as "SP" | "TP" | "FP";
  if (/^(SP|TP|FP)_/i.test(fileStem)) {
    return fileStem.split("_")[0]!.toUpperCase() as "SP" | "TP" | "FP";
  }
  return null;
}

/** User-facing label, e.g. J1/PT1/TP.jpg (not the reading in the storage object name). */
export function formatOdometerDisplayLabel(args: {
  photoName?: string | null;
  existingPath?: string | null;
  journeyNumber?: number | string | null;
  truckSegment?: string | null;
  pointCode?: "SP" | "TP" | "FP" | null;
}): string | null {
  const source = args.photoName || args.existingPath;
  if (!source) return null;

  const ext = getFileExtension(args.existingPath || args.photoName || source);
  const parsePath =
    [args.existingPath, args.photoName].find((p) => p && p.includes("/")) ?? null;

  let journey =
    args.journeyNumber != null && args.journeyNumber !== "" ? `J${args.journeyNumber}` : "J1";
  let segment = args.truckSegment?.trim() || "PT1";
  let point: "SP" | "TP" | "FP" = args.pointCode ?? "SP";

  if (parsePath) {
    const parts = parseStoragePathParts(parsePath);
    if (parts.length > 0) {
      journey = journeyLabelFromPart(parts[0]!, args.journeyNumber);
    }
    if (!args.truckSegment?.trim() && parts.length > 1) {
      const fromPath = segmentFromPart(parts[1]!);
      if (fromPath) segment = fromPath;
    }
    if (!args.pointCode) {
      const fromPath = pointFromStorageParts(parts);
      if (fromPath) point = fromPath;
    }
  }

  if (args.pointCode) point = args.pointCode;

  return `${journey}/${segment}/${point}.${ext}`;
}
