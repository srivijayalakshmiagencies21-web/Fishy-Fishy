import type { SupabaseClient } from "@supabase/supabase-js";
import { secondaryTruckCode } from "@/lib/journey-truck-labels";

export type OdometerPointCode = "SP" | "TP" | "FP";

export { photoLabelFromStoragePath } from "@/lib/odometer-display";

export function formDataFile(formData: FormData, fieldName: string): File | null {
  const entry = formData.get(fieldName);
  if (!(entry instanceof File) || entry.size <= 0) return null;
  return entry;
}

function sanitizeSegment(value: string): string {
  return (
    value
      .trim()
      .toUpperCase()
      .replace(/[/\\?%*:|"<>]/g, "-")
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 64) || "UNKNOWN"
  );
}

function fileExtension(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/heic" || file.type === "image/heif") return "heic";
  return "jpg";
}

/** e.g. ST1A (matches UI secondary truck names). */
export function secondaryTruckStorageLabel(primaryNumber: number, secondaryIndex: number): string {
  return `ST${secondaryTruckCode(primaryNumber, secondaryIndex)}`;
}

/** Storage object path, e.g. J1/PT1/MH12AB1234/SP/45000.jpg or J1/ST1A/…/TP/….jpg */
export function odometerImageObjectPath(args: {
  journeyNumber: number;
  truckSegment: string;
  vehicleNumber: string;
  pointCode: OdometerPointCode;
  odometerReading: number | string | "";
  file: File;
}): string {
  const reading = String(args.odometerReading === "" ? "0" : args.odometerReading).replace(/[^\d]/g, "") || "0";
  const ext = fileExtension(args.file);
  return `J${args.journeyNumber}/${args.truckSegment}/${sanitizeSegment(args.vehicleNumber)}/${args.pointCode}/${reading}.${ext}`;
}

export async function resolveJourneyNumber(supabase: SupabaseClient, journeyId: string): Promise<number> {
  const { data: journey } = await supabase
    .from("journeys")
    .select("created_at")
    .eq("id", journeyId)
    .maybeSingle();

  let query = supabase.from("journeys").select("id", { count: "exact", head: true });
  if (journey?.created_at) {
    query = query.lte("created_at", journey.created_at);
  }
  const { count, error } = await query;
  if (error || !count) return 1;
  return count;
}

/** Primary truck numbering (PT1, PT2, …) from journey trucks sorted by created_at. */
export function primaryTruckNumbersFromRows(
  rows: Array<{ id: string; primary_truck_id?: string | null }>,
): Map<string, number> {
  const map = new Map<string, number>();
  rows
    .filter((row) => !row.primary_truck_id)
    .forEach((row, index) => {
      map.set(row.id, index + 1);
    });
  return map;
}

export async function primaryTruckNumberById(
  supabase: SupabaseClient,
  journeyId: string,
): Promise<Map<string, number>> {
  const { data } = await supabase
    .from("journey_trucks")
    .select("id, primary_truck_id")
    .eq("journey_id", journeyId)
    .order("created_at", { ascending: true });

  return primaryTruckNumbersFromRows(data ?? []);
}

