"use server";

import { snapshotStartBeforeTransfer, snapshotTransferBeforeFinal } from "@/lib/journey-odometer-legs";
import {
  formDataFile,
  odometerImageObjectPath,
  primaryTruckNumbersFromRows,
  resolveJourneyNumber,
  secondaryTruckStorageLabel,
} from "@/lib/odometer-image";
import { uploadOdometerImageStored } from "@/lib/odometer-upload.server";
import { validateTruckUnloadQuantities } from "@/lib/journey-final-unload-quantity";
import { JourneyPhase, normalizeJourneyPhase } from "@/lib/journey-phase";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { invalidateJourneyCaches, invalidateMasterCache } from "@/lib/cache-tags.server";

export async function startFinalUnload(journeyId: string) {
  const supabase = (await createClient()) as any;
  if (!journeyId) return { success: false, error: "Invalid journey." };

  const { data: journey, error: fetchError } = await supabase
    .from("journeys" as any)
    .select("phase")
    .eq("id", journeyId)
    .maybeSingle();

  if (fetchError) return { success: false, error: fetchError.message };
  if (!journey) return { success: false, error: "Journey not found." };

  const phase = normalizeJourneyPhase(journey.phase);
  if (phase === JourneyPhase.Final || phase === JourneyPhase.Closed) {
    return { success: true };
  }

  if (phase !== JourneyPhase.Transfer) {
    return { success: false, error: "Record transfer before starting final unload." };
  }

  const { error } = await supabase
    .from("journeys" as any)
    .update({ phase: JourneyPhase.Final } as any)
    .eq("id", journeyId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/final");
  revalidatePath("/transfer");
  revalidatePath("/start");
  revalidatePath("/timeline");
  invalidateJourneyCaches();
  return { success: true };
}

async function resolveSocietyId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  districtId: number,
  society_id: number | null | undefined,
  society_name: string | undefined,
): Promise<{ id: number; name: string } | { error: string }> {
  if (society_id) {
    const { data, error } = await supabase
      .from("societies")
      .select("id, name")
      .eq("id", society_id)
      .maybeSingle();
    if (error) return { error: error.message };
    if (!data?.id) return { error: "Choose a valid society." };
    return { id: data.id as number, name: String(data.name).trim() };
  }

  const name = society_name?.trim();
  if (!name) return { error: "Society is required for each drop." };

  const { data: existing, error: readError } = await supabase
    .from("societies")
    .select("id, name")
    .eq("district_id", districtId)
    .ilike("name", name)
    .maybeSingle();

  if (readError) return { error: readError.message };

  if (existing?.id) {
    return { id: existing.id as number, name: String(existing.name).trim() };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("societies")
    .insert({ district_id: districtId, name })
    .select("id, name")
    .single();

  if (insertError || !inserted) {
    if (/duplicate|unique/i.test(insertError?.message ?? "")) {
      const { data: retry } = await supabase
        .from("societies")
        .select("id, name")
        .eq("district_id", districtId)
        .ilike("name", name)
        .maybeSingle();
      if (retry?.id) {
        return { id: retry.id as number, name: String(retry.name).trim() };
      }
    }
    return { error: insertError?.message ?? "Could not save society to district masters." };
  }

  return { id: inserted.id as number, name: String(inserted.name).trim() };
}

export async function recordUnload(state: unknown, formData: FormData) {
  const supabase = (await createClient()) as any;

  const journeyId = formData.get("journey_id") as string;
  const payloadStr = formData.get("payload") as string;
  if (!journeyId || !payloadStr) {
    return { success: false, error: "Invalid submission." };
  }

  const payload = JSON.parse(payloadStr) as {
    district_id?: number | null;
    trucks: Array<{
      truck_id: string;
      odometer_reading: number | "";
      drops: Array<{
        society_id?: number | null;
        society_name?: string;
        supplier_id: number;
        fish_id: number;
        quantity: number;
      }>;
    }>;
  };

  const unloadTruckIds = payload.trucks.map((truck) => truck.truck_id);

  const [
    { data: allTruckRows, error: trucksError },
    { data: allTruckItems, error: itemsError },
    journeyNumber,
  ] = await Promise.all([
    supabase
      .from("journey_trucks" as any)
      .select(
        "id, vehicle_number, primary_truck_id, created_at, district_id, odometer_reading, odometer_image_path, start_odometer_reading, start_odometer_image_path, transfer_odometer_reading, transfer_odometer_image_path, final_odometer_reading",
      )
      .eq("journey_id", journeyId)
      .order("created_at", { ascending: true }),
    unloadTruckIds.length > 0
      ? supabase
          .from("truck_items")
          .select("truck_id, supplier_id, fish_id, quantity, fish:fish_id(fish_type, seed_size)")
          .in("truck_id", unloadTruckIds)
      : Promise.resolve({ data: [], error: null }),
    resolveJourneyNumber(supabase, journeyId),
  ]);

  if (trucksError) return { success: false, error: trucksError.message };
  if (itemsError) return { success: false, error: itemsError.message };

  const truckRows = (allTruckRows ?? []) as any[];
  const truckRowMap = new Map<string, any>(truckRows.map((row) => [row.id as string, row]));
  const primaryNumbers = primaryTruckNumbersFromRows(truckRows);

  const districtId =
    payload.district_id ?? (truckRows.find((row) => row.district_id != null)?.district_id as number | undefined) ?? null;
  if (!districtId) {
    return { success: false, error: "Journey district is missing — cannot save societies." };
  }

  const itemsByTruckId = new Map<string, any[]>();
  for (const item of (allTruckItems ?? []) as any[]) {
    const list = itemsByTruckId.get(item.truck_id) ?? [];
    list.push(item);
    itemsByTruckId.set(item.truck_id, list);
  }

  for (const truck of payload.trucks) {
    const truckItems = itemsByTruckId.get(truck.truck_id) ?? [];

    const dropsForValidation = [
      {
        id: "submit",
        lines: truck.drops
          .filter((drop) => drop.quantity > 0)
          .map((drop) => ({
            itemKey: `${drop.supplier_id}-${drop.fish_id}`,
            quantity: drop.quantity,
          })),
      },
    ];
    const qtyError = validateTruckUnloadQuantities({ items: truckItems ?? [] }, dropsForValidation);
    if (qtyError) return { success: false, error: qtyError };
  }

  const missingOdometer = payload.trucks.some(
    (truck) =>
      !formDataFile(formData, `unload_image_${truck.truck_id}`) &&
      !truckRowMap.get(truck.truck_id)?.odometer_image_path,
  );
  if (missingOdometer) {
    return { success: false, error: "Odometer capture is required to complete unload for each truck." };
  }

  const societyKey = (drop: { society_id?: number | null; society_name?: string }) =>
    drop.society_id ? `id:${drop.society_id}` : `name:${drop.society_name?.trim().toLowerCase() ?? ""}`;

  const societyByKey = new Map<string, { id: number; name: string }>();
  for (const truck of payload.trucks) {
    for (const drop of truck.drops) {
      if (drop.quantity <= 0) continue;
      const key = societyKey(drop);
      if (societyByKey.has(key)) continue;
      const resolved = await resolveSocietyId(supabase, districtId, drop.society_id, drop.society_name);
      if ("error" in resolved) return { success: false, error: resolved.error };
      societyByKey.set(key, { id: resolved.id, name: resolved.name });
    }
  }

  const uploadUnloadPhoto = async (truck: (typeof payload.trucks)[number]): Promise<string | null> => {
    const odometer_image = formDataFile(formData, `unload_image_${truck.truck_id}`);
    if (!odometer_image) return null;

    const truckRow = truckRowMap.get(truck.truck_id);
    const vehicleNumber = truckRow?.vehicle_number ?? "UNKNOWN";
    const primaryId = truckRow?.primary_truck_id;
    let truckSegment: string;

    if (primaryId) {
      const primaryTruckNumber = primaryNumbers.get(primaryId) ?? 1;
      const siblings = truckRows.filter((r: any) => r.primary_truck_id === primaryId);
      const secondaryIndex = siblings.findIndex((row: any) => row.id === truck.truck_id);
      truckSegment = secondaryTruckStorageLabel(
        primaryTruckNumber,
        secondaryIndex >= 0 ? secondaryIndex : 0,
      );
    } else {
      truckSegment = `PT${primaryNumbers.get(truck.truck_id) ?? 1}`;
    }

    const objectPath = odometerImageObjectPath({
      journeyNumber,
      truckSegment,
      vehicleNumber,
      pointCode: "FP",
      odometerReading: truck.odometer_reading,
      file: odometer_image,
    });
    return uploadOdometerImageStored(supabase, odometer_image, objectPath);
  };

  const saveUnloadTruck = async (truck: (typeof payload.trucks)[number]): Promise<string | null> => {
    const existingTruck = truckRowMap.get(truck.truck_id);
    const odometer_image_path =
      (await uploadUnloadPhoto(truck)) ?? (existingTruck?.odometer_image_path as string | null) ?? null;

    const startOdometer = snapshotStartBeforeTransfer(existingTruck ?? {});
    const transferOdometer = snapshotTransferBeforeFinal(existingTruck ?? {});

    const startImagePath =
      existingTruck?.start_odometer_image_path ??
      (existingTruck?.odometer_image_path && /\/SP\//.test(existingTruck.odometer_image_path)
        ? existingTruck.odometer_image_path
        : null);

    const transferImagePath =
      existingTruck?.transfer_odometer_image_path ??
      (existingTruck?.odometer_image_path && /\/TP\//.test(existingTruck.odometer_image_path)
        ? existingTruck.odometer_image_path
        : null);

    const { error: truckError } = await supabase
      .from("journey_trucks" as any)
      .update({
        odometer_reading: truck.odometer_reading,
        start_odometer_reading: startOdometer,
        ...(startImagePath ? { start_odometer_image_path: startImagePath } : {}),
        transfer_odometer_reading: transferOdometer,
        ...(transferImagePath ? { transfer_odometer_image_path: transferImagePath } : {}),
        final_odometer_reading: truck.odometer_reading,
        final_odometer_image_path: odometer_image_path,
        ...(odometer_image_path ? { odometer_image_path } : {}),
      } as any)
      .eq("id", truck.truck_id);

    if (truckError) return truckError.message;

    await supabase.from("truck_unload_drops" as any).delete().eq("truck_id", truck.truck_id);

    const resolvedDrops = truck.drops
      .filter((drop) => drop.quantity > 0)
      .map((drop) => {
        const society = societyByKey.get(societyKey(drop))!;
        return {
          truck_id: truck.truck_id,
          society_id: society.id,
          society_name: society.name,
          supplier_id: drop.supplier_id,
          fish_id: drop.fish_id,
          quantity: drop.quantity,
        };
      });

    if (resolvedDrops.length > 0) {
      const { error: dropsError } = await supabase.from("truck_unload_drops" as any).insert(resolvedDrops as any);
      if (dropsError) return dropsError.message;
    }
    return null;
  };

  let saveErrors: Array<string | null>;
  try {
    saveErrors = await Promise.all(payload.trucks.map((truck) => saveUnloadTruck(truck)));
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Upload failed." };
  }
  const saveError = saveErrors.find((message) => message !== null);
  if (saveError) {
    return { success: false, error: saveError };
  }

  const { error: phaseError } = await supabase
    .from("journeys" as any)
    .update({ phase: JourneyPhase.Closed, final_at: new Date().toISOString() } as any)
    .eq("id", journeyId);

  if (phaseError) {
    return { success: false, error: phaseError.message };
  }

  revalidatePath("/final");
  revalidatePath("/transfer");
  revalidatePath("/start");
  revalidatePath("/timeline");
  revalidatePath("/masters/districts");
  invalidateJourneyCaches();
  invalidateMasterCache("districts");
  return { success: true };
}

function odometerFieldsAfterFinalDelete(truck: {
  transfer_odometer_reading?: number | null;
  transfer_odometer_image_path?: string | null;
  start_odometer_reading?: number | null;
  start_odometer_image_path?: string | null;
  odometer_reading?: number | null;
  odometer_image_path?: string | null;
}) {
  if (truck.transfer_odometer_image_path) {
    return {
      odometer_reading: truck.transfer_odometer_reading ?? truck.odometer_reading,
      odometer_image_path: truck.transfer_odometer_image_path,
    };
  }
  if (truck.start_odometer_image_path) {
    return {
      odometer_reading: truck.start_odometer_reading ?? truck.odometer_reading,
      odometer_image_path: truck.start_odometer_image_path,
    };
  }
  const path = truck.odometer_image_path;
  if (path && /\/TP\//.test(path)) {
    return {
      odometer_reading: truck.transfer_odometer_reading ?? truck.odometer_reading,
      odometer_image_path: path,
    };
  }
  if (path && /\/SP\//.test(path)) {
    return {
      odometer_reading: truck.start_odometer_reading ?? truck.odometer_reading,
      odometer_image_path: path,
    };
  }
  return {
    odometer_reading: truck.odometer_reading,
    odometer_image_path: truck.odometer_image_path,
  };
}

/** Clears saved final unload, drops, and final odometer; returns journey to transfer leg. */
export async function deleteFinalUnloadRecording(journeyId: string) {
  const supabase = (await createClient()) as any;
  if (!journeyId) return { success: false, error: "Invalid journey." };

  const { data: journey, error: journeyError } = await supabase
    .from("journeys" as any)
    .select("phase")
    .eq("id", journeyId)
    .maybeSingle();

  if (journeyError) return { success: false, error: journeyError.message };
  if (!journey) return { success: false, error: "Journey not found." };

  const phase = normalizeJourneyPhase(journey.phase);
  if (phase !== JourneyPhase.Final && phase !== JourneyPhase.Closed) {
    return { success: false, error: "Final unload has not started for this journey." };
  }

  const { data: trucks, error: trucksError } = await supabase
    .from("journey_trucks" as any)
    .select(
      "id, end_type, odometer_reading, odometer_image_path, start_odometer_reading, start_odometer_image_path, transfer_odometer_reading, transfer_odometer_image_path",
    )
    .eq("journey_id", journeyId);

  if (trucksError) return { success: false, error: trucksError.message };

  const finalTrucks = (trucks ?? []).filter((row: any) => row.end_type === "FINAL_POINT");
  const truckIds = finalTrucks.map((row: any) => row.id as string);

  if (truckIds.length > 0) {
    const { error: dropsError } = await supabase
      .from("truck_unload_drops" as any)
      .delete()
      .in("truck_id", truckIds);
    if (dropsError) return { success: false, error: dropsError.message };

    for (const truck of finalTrucks) {
      const restored = odometerFieldsAfterFinalDelete(truck);
      const { error: truckError } = await supabase
        .from("journey_trucks" as any)
        .update({
          final_odometer_reading: null,
          final_odometer_image_path: null,
          odometer_reading: restored.odometer_reading,
          odometer_image_path: restored.odometer_image_path,
        } as any)
        .eq("id", truck.id);
      if (truckError) return { success: false, error: truckError.message };
    }
  }

  const { error: phaseError } = await supabase
    .from("journeys" as any)
    .update({ phase: JourneyPhase.Transfer, final_at: null } as any)
    .eq("id", journeyId);

  if (phaseError) return { success: false, error: phaseError.message };

  revalidatePath("/final");
  revalidatePath("/transfer");
  revalidatePath("/start");
  revalidatePath("/timeline");
  invalidateJourneyCaches();
  return { success: true };
}
