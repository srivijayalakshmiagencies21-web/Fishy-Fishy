"use server";

import { snapshotStartBeforeTransfer, snapshotTransferBeforeFinal } from "@/lib/journey-odometer-legs";
import {
  formDataFile,
  odometerImageObjectPath,
  primaryTruckNumberById,
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
  revalidatePath("/overview");
  invalidateJourneyCaches();
  return { success: true };
}

async function resolveSocietyId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  districtId: number,
  society_id: number | null | undefined,
  society_name: string | undefined,
): Promise<{ id: number } | { error: string }> {
  if (society_id) return { id: society_id };

  const name = society_name?.trim();
  if (!name) return { error: "Society is required for each drop." };

  const { data: existing, error: readError } = await supabase
    .from("societies")
    .select("id")
    .eq("district_id", districtId)
    .ilike("name", name)
    .maybeSingle();

  if (readError) return { error: readError.message };

  if (existing?.id) return { id: existing.id as number };

  const { data: inserted, error: insertError } = await supabase
    .from("societies")
    .insert({ district_id: districtId, name })
    .select("id")
    .single();

  if (insertError || !inserted) {
    if (/duplicate|unique/i.test(insertError?.message ?? "")) {
      const { data: retry } = await supabase
        .from("societies")
        .select("id")
        .eq("district_id", districtId)
        .ilike("name", name)
        .maybeSingle();
      if (retry?.id) return { id: retry.id as number };
    }
    return { error: insertError?.message ?? "Could not save society to district masters." };
  }

  return { id: inserted.id as number };
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

  let districtId = payload.district_id ?? null;
  if (!districtId) {
    const { data: truckRow } = await supabase
      .from("journey_trucks")
      .select("district_id")
      .eq("journey_id", journeyId)
      .not("district_id", "is", null)
      .limit(1)
      .maybeSingle();
    districtId = truckRow?.district_id ?? null;
  }
  if (!districtId) {
    return { success: false, error: "Journey district is missing — cannot save societies." };
  }

  const journeyNumber = await resolveJourneyNumber(supabase, journeyId);
  const primaryNumbers = await primaryTruckNumberById(supabase, journeyId);

  for (const truck of payload.trucks) {
    const { data: truckItems, error: itemsError } = await supabase
      .from("truck_items")
      .select("supplier_id, fish_id, quantity, fish:fish_id(fish_type, seed_size)")
      .eq("truck_id", truck.truck_id);

    if (itemsError) return { success: false, error: itemsError.message };

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

  for (const truck of payload.trucks) {
    let odometer_image_path: string | null = null;
    const odometer_image = formDataFile(formData, `unload_image_${truck.truck_id}`);
    if (odometer_image) {
      try {
        const { data: truckRow } = await supabase
          .from("journey_trucks")
          .select("vehicle_number, primary_truck_id")
          .eq("id", truck.truck_id)
          .maybeSingle();

        const vehicleNumber = truckRow?.vehicle_number ?? "UNKNOWN";
        const primaryId = truckRow?.primary_truck_id;
        let truckSegment: string;

        if (primaryId) {
          const primaryTruckNumber = primaryNumbers.get(primaryId) ?? 1;
          const { data: siblings } = await supabase
            .from("journey_trucks")
            .select("id")
            .eq("primary_truck_id", primaryId)
            .order("created_at", { ascending: true });
          const secondaryIndex = siblings?.findIndex((row: any) => row.id === truck.truck_id) ?? 0;
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
        odometer_image_path = await uploadOdometerImageStored(supabase, odometer_image, objectPath);
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "Upload failed." };
      }
    }

    if (!odometer_image_path) {
      const { data: existingRow } = await supabase
        .from("journey_trucks")
        .select("odometer_image_path")
        .eq("id", truck.truck_id)
        .maybeSingle();
      odometer_image_path = (existingRow?.odometer_image_path as string | null) ?? null;
    }

    if (!odometer_image_path) {
      return { success: false, error: "Odometer capture is required to complete unload for each truck." };
    }

    const { data: existingTruck } = await supabase
      .from("journey_trucks" as any)
      .select(
        "odometer_reading, odometer_image_path, start_odometer_reading, start_odometer_image_path, transfer_odometer_reading, transfer_odometer_image_path, final_odometer_reading, primary_truck_id",
      )
      .eq("id", truck.truck_id)
      .maybeSingle();

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

    if (truckError) {
      return { success: false, error: truckError.message };
    }

    await supabase.from("truck_unload_drops" as any).delete().eq("truck_id", truck.truck_id);

    const drops = truck.drops.filter((drop) => drop.quantity > 0);
    if (drops.length > 0) {
      const resolvedDrops: Array<{
        truck_id: string;
        society_id: number;
        supplier_id: number;
        fish_id: number;
        quantity: number;
      }> = [];

      for (const drop of drops) {
        const resolved = await resolveSocietyId(supabase, districtId, drop.society_id, drop.society_name);
        if ("error" in resolved) return { success: false, error: resolved.error };
        resolvedDrops.push({
          truck_id: truck.truck_id,
          society_id: resolved.id,
          supplier_id: drop.supplier_id,
          fish_id: drop.fish_id,
          quantity: drop.quantity,
        });
      }

      const { error: dropsError } = await supabase.from("truck_unload_drops" as any).insert(resolvedDrops as any);
      if (dropsError) return { success: false, error: dropsError.message };
    }
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
  revalidatePath("/overview");
  revalidatePath("/masters/districts");
  invalidateJourneyCaches();
  invalidateMasterCache("districts");
  return { success: true };
}
