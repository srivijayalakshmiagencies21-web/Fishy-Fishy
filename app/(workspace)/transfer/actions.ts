"use server";

import { snapshotStartBeforeTransfer } from "@/lib/journey-odometer-legs";
import {
  formDataFile,
  odometerImageObjectPath,
  primaryTruckNumberById,
  resolveJourneyNumber,
  secondaryTruckStorageLabel,
} from "@/lib/odometer-image";
import { uploadOdometerImageStored } from "@/lib/odometer-upload.server";
import { JourneyPhase, normalizeJourneyPhase } from "@/lib/journey-phase";
import { createClient } from "@/lib/supabase/server";
import { splitStartAndTransferTruckIds } from "@/lib/transfer-truck-split";
import { revalidatePath } from "next/cache";
import { invalidateJourneyCaches } from "@/lib/cache-tags.server";

/** Start transfer — closes Start page lane and opens Transfer in progress. */
export async function startTransfer(journeyId: string) {
  const supabase = (await createClient()) as any;
  if (!journeyId) return { success: false, error: "Invalid journey." };

  const { data: journey, error: fetchError } = await supabase
    .from("journeys" as any)
    .select("phase")
    .eq("id", journeyId)
    .maybeSingle();

  if (fetchError) return { success: false, error: fetchError.message };
  if (!journey) return { success: false, error: "Journey not found." };

  if (normalizeJourneyPhase(journey.phase) !== JourneyPhase.Start) {
    return { success: true };
  }

  const { error } = await supabase
    .from("journeys" as any)
    .update({ phase: JourneyPhase.Transfer } as any)
    .eq("id", journeyId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/start");
  revalidatePath("/transfer");
  revalidatePath("/overview");
  invalidateJourneyCaches();
  return { success: true };
}

export async function recordTransfer(state: unknown, formData: FormData) {
  const supabase = (await createClient()) as any;

  const journeyId = formData.get("journey_id") as string;
  const payloadStr = formData.get("payload") as string;
  if (!journeyId || !payloadStr) {
    return { success: false, error: "Invalid submission." };
  }

  const payload = JSON.parse(payloadStr) as {
    transfer_location_name: string;
    transfer_district_id: number | null;
    arrivals: Record<string, { odometer_reading: number | ""; existingOdometerImagePath?: string | null }>;
    primary_items: Array<{ truck_id: string; supplier_id: number; fish_id: number; quantity: number | "" }>;
    trucks: Array<{
      id: string;
      primary_truck_id?: string;
      transporter_id: number | null;
      vehicle_number: string;
      driver_name: string;
      driver_phone: string;
      odometer_reading: number | "";
      existingOdometerImagePath?: string | null;
      items: Array<{ supplier_id: number; fish_id: number; quantity: number | "" }>;
    }>;
  };

  const { data: secondaryTrucks, error: secondaryFetchError } = await supabase
    .from("journey_trucks" as any)
    .select("id")
    .eq("journey_id", journeyId)
    .not("primary_truck_id", "is", null);

  if (secondaryFetchError) {
    return { success: false, error: secondaryFetchError.message };
  }

  const secondaryIds = (secondaryTrucks ?? []).map((row: any) => row.id as string);
  if (secondaryIds.length > 0) {
    const { error: removeError } = await supabase.from("journey_trucks" as any).delete().in("id", secondaryIds);
    if (removeError) return { success: false, error: removeError.message };
  }

  const { data: trucksAfterSecondaryDelete, error: trucksListError } = await supabase
    .from("journey_trucks" as any)
    .select("id, created_at")
    .eq("journey_id", journeyId)
    .order("created_at", { ascending: true });

  if (trucksListError) return { success: false, error: trucksListError.message };

  const { remove: legacyTransferIds } = splitStartAndTransferTruckIds(
    (trucksAfterSecondaryDelete ?? []) as { id: string; created_at: string }[],
  );

  if (legacyTransferIds.length > 0) {
    const { error: legacyRemoveError } = await supabase
      .from("journey_trucks" as any)
      .delete()
      .in("id", legacyTransferIds);
    if (legacyRemoveError) return { success: false, error: legacyRemoveError.message };
  }

  const journeyNumber = await resolveJourneyNumber(supabase, journeyId);
  const primaryNumbers = await primaryTruckNumberById(supabase, journeyId);

  const primaryIds = new Set(primaryNumbers.keys());

  for (const [truckId, arrival] of Object.entries(payload.arrivals)) {
    if (!primaryIds.has(truckId)) continue;

    let odometer_image_path: string | null = arrival.existingOdometerImagePath ?? null;
    const odometer_image = formDataFile(formData, `arrival_image_${truckId}`);
    if (odometer_image) {
      try {
        const primaryTruckNumber = primaryNumbers.get(truckId) ?? 1;
        const { data: primaryRow } = await supabase
          .from("journey_trucks")
          .select("vehicle_number")
          .eq("id", truckId)
          .maybeSingle();
        const vehicleNumber = primaryRow?.vehicle_number ?? "UNKNOWN";
        const objectPath = odometerImageObjectPath({
          journeyNumber,
          truckSegment: `PT${primaryTruckNumber}`,
          vehicleNumber,
          pointCode: "TP",
          odometerReading: arrival.odometer_reading,
          file: odometer_image,
        });
        odometer_image_path = await uploadOdometerImageStored(supabase, odometer_image, objectPath);
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "Upload failed." };
      }
    }

    if (!odometer_image_path) {
      return { success: false, error: "Odometer capture is required for each primary truck at transfer." };
    }

    const { data: existingPrimary } = await supabase
      .from("journey_trucks" as any)
      .select(
        "odometer_reading, odometer_image_path, start_odometer_reading, start_odometer_image_path, transfer_odometer_reading, final_odometer_reading",
      )
      .eq("id", truckId)
      .maybeSingle();

    const startOdometer = snapshotStartBeforeTransfer(existingPrimary ?? {});
    const startImagePath =
      existingPrimary?.start_odometer_image_path ??
      (existingPrimary?.odometer_image_path && /\/SP\//.test(existingPrimary.odometer_image_path)
        ? existingPrimary.odometer_image_path
        : null);

    const { error } = await supabase
      .from("journey_trucks" as any)
      .update({
        odometer_reading: arrival.odometer_reading,
        start_odometer_reading: startOdometer,
        ...(startImagePath ? { start_odometer_image_path: startImagePath } : {}),
        transfer_odometer_reading: arrival.odometer_reading,
        transfer_odometer_image_path: odometer_image_path,
        ...(odometer_image_path ? { odometer_image_path } : {}),
      } as any)
      .eq("id", truckId);

    if (error) {
      return { success: false, error: error.message };
    }
  }

  const itemsByTruck = new Map<string, Array<{ supplier_id: number; fish_id: number; quantity: number }>>();
  for (const row of payload.primary_items) {
    const qty = row.quantity === "" ? 0 : Number(row.quantity) || 0;
    const list = itemsByTruck.get(row.truck_id) ?? [];
    list.push({ supplier_id: row.supplier_id, fish_id: row.fish_id, quantity: qty });
    itemsByTruck.set(row.truck_id, list);
  }

  for (const truckId of new Set(payload.primary_items.map((row) => row.truck_id))) {
    await supabase.from("truck_items" as any).delete().eq("truck_id", truckId);
    const items = itemsByTruck.get(truckId) ?? [];
    if (items.length > 0) {
      const { error } = await supabase.from("truck_items" as any).insert(
        items.map((item) => ({ truck_id: truckId, ...item })) as any,
      );
      if (error) return { success: false, error: error.message };
    }
  }

  const secondaryBatchIndex = new Map<string, number>();

  for (const truck of payload.trucks) {
    if (!truck.items.some((item) => item.quantity !== "" && Number(item.quantity) > 0)) continue;

    let odometer_image_path: string | null = truck.existingOdometerImagePath ?? null;
    const odometer_image = formDataFile(formData, `odometer_image_${truck.id}`);
    if (odometer_image) {
      try {
        const primaryId = truck.primary_truck_id ?? "";
        const primaryTruckNumber = primaryNumbers.get(primaryId) ?? 1;
        const { count: existingSecondaries } = await supabase
          .from("journey_trucks")
          .select("*", { count: "exact", head: true })
          .eq("primary_truck_id", primaryId);
        const batchOffset = secondaryBatchIndex.get(primaryId) ?? 0;
        secondaryBatchIndex.set(primaryId, batchOffset + 1);
        const secondaryIndex = (existingSecondaries ?? 0) + batchOffset;

        const objectPath = odometerImageObjectPath({
          journeyNumber,
          truckSegment: secondaryTruckStorageLabel(primaryTruckNumber, secondaryIndex),
          vehicleNumber: truck.vehicle_number,
          pointCode: "TP",
          odometerReading: truck.odometer_reading,
          file: odometer_image,
        });
        odometer_image_path = await uploadOdometerImageStored(supabase, odometer_image, objectPath);
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "Upload failed." };
      }
    }

    if (!odometer_image_path) {
      return { success: false, error: "Odometer capture is required for each secondary truck." };
    }

    const { data: inserted, error: truckError } = await supabase
      .from("journey_trucks" as any)
      .insert({
        journey_id: journeyId,
        primary_truck_id: truck.primary_truck_id ?? null,
        location_name: payload.transfer_location_name,
        district_id: payload.transfer_district_id,
        transporter_id: truck.transporter_id,
        vehicle_number: truck.vehicle_number,
        driver_name: truck.driver_name,
        driver_phone: truck.driver_phone,
        odometer_reading: truck.odometer_reading,
        transfer_odometer_reading: truck.odometer_reading,
        transfer_odometer_image_path: odometer_image_path,
        end_type: "FINAL_POINT",
        odometer_image_path,
      } as any)
      .select("id")
      .single();

    if (truckError || !inserted) {
      return { success: false, error: truckError?.message ?? "Could not save secondary truck." };
    }

    const items = truck.items
      .filter((item) => item.quantity !== "" && Number(item.quantity) > 0)
      .map((item) => ({
        truck_id: inserted.id,
        supplier_id: item.supplier_id,
        fish_id: item.fish_id,
        quantity: Number(item.quantity),
      }));

    if (items.length > 0) {
      const { error: itemsError } = await supabase.from("truck_items" as any).insert(items as any);
      if (itemsError) return { success: false, error: itemsError.message };
    }
  }

  const { error: phaseError } = await supabase
    .from("journeys" as any)
    .update({ phase: JourneyPhase.Transfer, transfer_at: new Date().toISOString() } as any)
    .eq("id", journeyId);

  if (phaseError) {
    return { success: false, error: phaseError.message };
  }

  revalidatePath("/transfer");
  revalidatePath("/final");
  revalidatePath("/start");
  revalidatePath("/overview");
  invalidateJourneyCaches();
  return { success: true };
}

export async function deleteTransferRecording(journeyId: string) {
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
  if (phase === JourneyPhase.Final || phase === JourneyPhase.Closed) {
    return {
      success: false,
      error: "Transfer cannot be changed after final unload has started.",
    };
  }

  const { data: secondaryTrucks, error: trucksError } = await supabase
    .from("journey_trucks" as any)
    .select(
      `
      id,
      primary_truck_id,
      items:truck_items(supplier_id, fish_id, quantity)
    `,
    )
    .eq("journey_id", journeyId)
    .not("primary_truck_id", "is", null);

  if (trucksError) return { success: false, error: trucksError.message };

  const restoreByPrimary = new Map<
    string,
    Map<string, { supplier_id: number; fish_id: number; quantity: number }>
  >();

  for (const secondary of secondaryTrucks ?? []) {
    const primaryId = secondary.primary_truck_id as string | null;
    if (!primaryId) continue;
    const bucket =
      restoreByPrimary.get(primaryId) ??
      new Map<string, { supplier_id: number; fish_id: number; quantity: number }>();
    for (const item of (secondary as any).items ?? []) {
      const supplier_id = item.supplier_id as number;
      const fish_id = item.fish_id as number;
      const qty = Number(item.quantity) || 0;
      if (!supplier_id || !fish_id || qty <= 0) continue;
      const key = `${supplier_id}-${fish_id}`;
      const row = bucket.get(key) ?? { supplier_id, fish_id, quantity: 0 };
      row.quantity += qty;
      bucket.set(key, row);
    }
    restoreByPrimary.set(primaryId, bucket);
  }

  for (const [primaryId, restoredItems] of restoreByPrimary) {
    const { data: primaryItems } = await supabase
      .from("truck_items" as any)
      .select("supplier_id, fish_id, quantity")
      .eq("truck_id", primaryId);

    const merged = new Map<string, { supplier_id: number; fish_id: number; quantity: number }>();
    for (const item of primaryItems ?? []) {
      const supplier_id = item.supplier_id as number;
      const fish_id = item.fish_id as number;
      const key = `${supplier_id}-${fish_id}`;
      merged.set(key, {
        supplier_id,
        fish_id,
        quantity: Number(item.quantity) || 0,
      });
    }
    for (const row of restoredItems.values()) {
      const key = `${row.supplier_id}-${row.fish_id}`;
      const existing = merged.get(key);
      merged.set(key, {
        ...row,
        quantity: (existing?.quantity ?? 0) + row.quantity,
      });
    }

    await supabase.from("truck_items" as any).delete().eq("truck_id", primaryId);
    const toInsert = Array.from(merged.values()).filter((row) => row.quantity > 0);
    if (toInsert.length > 0) {
      const { error: restoreError } = await supabase.from("truck_items" as any).insert(
        toInsert.map((row) => ({
          truck_id: primaryId,
          supplier_id: row.supplier_id,
          fish_id: row.fish_id,
          quantity: row.quantity,
        })) as any,
      );
      if (restoreError) return { success: false, error: restoreError.message };
    }
  }

  const secondaryIds = (secondaryTrucks ?? []).map((row: any) => row.id as string);
  if (secondaryIds.length > 0) {
    const { error: removeError } = await supabase.from("journey_trucks" as any).delete().in("id", secondaryIds);
    if (removeError) return { success: false, error: removeError.message };
  }

  const { data: legacyTransferTrucks } = await supabase
    .from("journey_trucks" as any)
    .select("id, created_at")
    .eq("journey_id", journeyId)
    .order("created_at", { ascending: true });

  const { remove: legacyRemove } = splitStartAndTransferTruckIds(
    (legacyTransferTrucks ?? []) as { id: string; created_at: string }[],
  );

  if (legacyRemove.length > 0) {
    const { error: legacyRemoveError } = await supabase
      .from("journey_trucks" as any)
      .delete()
      .in("id", legacyRemove);
    if (legacyRemoveError) return { success: false, error: legacyRemoveError.message };
  }

  const { error: statusError } = await supabase
    .from("journeys" as any)
    .update({ phase: JourneyPhase.Start, transfer_at: null } as any)
    .eq("id", journeyId);

  if (statusError) return { success: false, error: statusError.message };

  revalidatePath("/transfer");
  revalidatePath("/final");
  revalidatePath("/start");
  revalidatePath("/overview");
  invalidateJourneyCaches();
  return { success: true };
}
