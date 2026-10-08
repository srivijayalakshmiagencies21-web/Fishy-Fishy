import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  prepareOdometerImageForStorage,
  storagePathWithExtension,
} from "@/lib/odometer-image-compress.server";

export async function uploadOdometerImageStored(
  supabase: SupabaseClient,
  file: File,
  objectPath: string,
): Promise<string> {
  const prepared = await prepareOdometerImageForStorage(file);
  const path = storagePathWithExtension(objectPath, prepared.extension);
  const { data, error } = await supabase.storage.from("images").upload(path, prepared.body, {
    contentType: prepared.contentType,
    upsert: true,
  });
  if (error) {
    throw new Error(`Failed to upload odometer photo: ${error.message}`);
  }
  if (!data?.path) {
    throw new Error("Failed to upload odometer photo: empty storage response.");
  }
  return data.path;
}
