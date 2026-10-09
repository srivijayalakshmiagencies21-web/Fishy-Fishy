"use server";

import { formDataFile, odometerImageObjectPath, resolveJourneyNumber } from "@/lib/odometer-image";
import { uploadOdometerImageStored } from "@/lib/odometer-upload.server";
import { JourneyPhase, normalizeJourneyPhase } from "@/lib/journey-phase";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { invalidateJourneyCaches } from "@/lib/cache-tags.server";
import { isValidMobile } from "@/lib/phone";

export async function createJourney(state: unknown, formData: FormData) {
  try {
  const supabase = (await createClient()) as any;

  const payloadStr = formData.get("payload") as string;
  if (!payloadStr) return { success: false, error: "Invalid payload." };
  
  const payload = JSON.parse(payloadStr);
  const { route, trucks } = payload;
  const db_id = formData.get("db_id") as string | null;

  if ((trucks ?? []).some((truck: { driver_phone?: string }) => !isValidMobile(truck.driver_phone))) {
    return { success: false, error: "Driver mobile must be a 10-digit number." };
  }

  let journeyId = db_id;

  if (db_id) {
    const { data: journeyRow, error: journeyFetchError } = await supabase
      .from("journeys" as any)
      .select("phase")
      .eq("id", db_id)
      .maybeSingle();

    if (journeyFetchError) return { success: false, error: journeyFetchError.message };
    if (journeyRow?.phase && normalizeJourneyPhase(journeyRow.phase) !== JourneyPhase.Start) {
      return {
        success: false,
        error: "This journey can only be edited at starting point while it is still in progress there.",
      };
    }

    const { data: startTrucks, error: startTrucksError } = await supabase
      .from("journey_trucks" as any)
      .select("id")
      .eq("journey_id", db_id)
      .is("primary_truck_id", null);

    if (startTrucksError) return { success: false, error: startTrucksError.message };

    const startTruckIds = (startTrucks ?? []).map((row: any) => row.id as string);
    if (startTruckIds.length > 0) {
      const { error: removeItemsError } = await supabase
        .from("truck_items" as any)
        .delete()
        .in("truck_id", startTruckIds);
      if (removeItemsError) return { success: false, error: removeItemsError.message };

      const { error: removeTrucksError } = await supabase
        .from("journey_trucks" as any)
        .delete()
        .in("id", startTruckIds);
      if (removeTrucksError) return { success: false, error: removeTrucksError.message };
    }
  } else {
    const res = await supabase.from("journeys").insert({
       phase: JourneyPhase.Start,
    } as any).select("id").single();
    
    if (res.error) return { success: false, error: "Failed to create journey: " + res.error.message };
    journeyId = res.data.id;
  }

  const journeyNumber = await resolveJourneyNumber(supabase, journeyId!);

  const uploadedPaths = await Promise.all(
    trucks.map(async (truck: any, truckIndex: number) => {
      let odometer_image_path: string | null = truck.existingOdometerImagePath ?? null;
      const odometer_image = formDataFile(formData, `odometer_image_${truck.id}`);
      if (odometer_image) {
        const objectPath = odometerImageObjectPath({
          journeyNumber,
          truckSegment: `PT${truckIndex + 1}`,
          vehicleNumber: truck.vehicle_number,
          pointCode: "SP",
          odometerReading: truck.odometer_reading,
          file: odometer_image,
        });
        odometer_image_path = await uploadOdometerImageStored(supabase, odometer_image, objectPath);
      }
      return odometer_image_path;
    })
  );

  const truckSaveResults = await Promise.all(
    trucks.map(async (truck: any, truckIndex: number) => {
      const odometer_image_path = uploadedPaths[truckIndex];

      if (!odometer_image_path) {
        return { error: "Odometer capture is required for each truck." };
      }

      const resTruck = await supabase.from("journey_trucks" as any).insert({
        journey_id: journeyId,
        location_name: route.location_name,
        district_id: route.district_id,
        transporter_id: truck.transporter_id,
        vehicle_number: truck.vehicle_number,
        driver_name: truck.driver_name,
        driver_phone: truck.driver_phone,
        odometer_reading: truck.odometer_reading,
        start_odometer_reading: truck.odometer_reading,
        start_odometer_image_path: odometer_image_path,
        end_type: truck.end_type,
        odometer_image_path: odometer_image_path,
      } as any).select("id").single();

      if (resTruck.error) {
        return { error: "Failed to insert truck: " + resTruck.error.message };
      }

      const truckDbId = (resTruck.data as any).id;
      const items: any[] = [];
      truck.items.forEach((item: any) => {
        item.fishes.forEach((fish: any) => {
          items.push({
            truck_id: truckDbId,
            supplier_id: item.supplier_id,
            fish_id: fish.fish_id,
            quantity: fish.quantity,
          });
        });
      });

      if (items.length > 0) {
        const resItems = await supabase.from("truck_items" as any).insert(items as any);
        if (resItems.error) {
          return { error: "Failed to insert truck items: " + resItems.error.message };
        }
      }

      return { error: null };
    }),
  );

  const startSaveError = truckSaveResults.find((result) => result.error)?.error;
  if (startSaveError) {
    return { success: false, error: startSaveError };
  }

  revalidatePath("/transfer");
  revalidatePath("/start");
  revalidatePath("/overview");
  invalidateJourneyCaches();
  return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Save failed." };
  }
}

export async function deleteJourney(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("journeys").delete().eq("short_id", id);
  if (error) {
    console.error("Failed to delete journey:", error);
    return { success: false, error: error.message };
  }
  revalidatePath("/start");
  revalidatePath("/transfer");
  revalidatePath("/overview");
  invalidateJourneyCaches();
  return { success: true };
}
