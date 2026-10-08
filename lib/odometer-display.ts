/** Client-safe helpers for showing stored odometer captures (no server imports). */

export function photoLabelFromStoragePath(path: string | null | undefined) {
  if (!path) return null;
  const name = path.split("/").pop();
  return name ?? "Saved photo";
}
