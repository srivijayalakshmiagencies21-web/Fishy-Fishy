export function isFinalPointOdometerPath(path?: string | null) {
  return Boolean(path && /\/FP\//.test(path));
}

export type FinalOdometerFields = {
  odometer_reading: number | "";
  photoName: string | null;
  existingOdometerImagePath?: string | null;
};

export function emptyFinalOdometerFields(): FinalOdometerFields {
  return { odometer_reading: "", photoName: null, existingOdometerImagePath: null };
}

export function photoLabelFromOdometerPath(path: string | null | undefined) {
  if (!path) return null;
  const name = path.split("/").pop();
  return name ?? "Saved photo";
}

/** Keep draft odometer only for final-point captures (or a fresh local photo pick). */
export function finalOdometerFieldsFromDraft(unload: FinalOdometerFields): FinalOdometerFields {
  const path = unload.existingOdometerImagePath;
  if (path && isFinalPointOdometerPath(path)) {
    return {
      odometer_reading: unload.odometer_reading,
      photoName: unload.photoName,
      existingOdometerImagePath: path,
    };
  }
  if (unload.photoName && !path) {
    return {
      odometer_reading: unload.odometer_reading,
      photoName: unload.photoName,
      existingOdometerImagePath: null,
    };
  }
  return emptyFinalOdometerFields();
}

export function finalOdometerFieldsFromTruck(truck: {
  final_odometer_reading?: unknown;
  final_odometer_image_path?: string | null;
  odometer_reading?: unknown;
  odometer_image_path?: string | null;
}): FinalOdometerFields {
  const path =
    truck.final_odometer_image_path ??
    (isFinalPointOdometerPath(truck.odometer_image_path) ? truck.odometer_image_path : null);
  const reading =
    truck.final_odometer_reading ??
    (isFinalPointOdometerPath(truck.odometer_image_path) ? truck.odometer_reading : null);

  if (!path && (reading === null || reading === undefined || reading === "")) {
    return emptyFinalOdometerFields();
  }

  return {
    odometer_reading:
      reading === null || reading === undefined || reading === "" ? "" : Number(reading),
    photoName: photoLabelFromOdometerPath(path),
    existingOdometerImagePath: path ?? null,
  };
}
