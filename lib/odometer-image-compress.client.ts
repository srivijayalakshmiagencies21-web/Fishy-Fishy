const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.82;
const MIN_BYTES_TO_COMPRESS = 200_000;

/** Client-side compress before upload (resizes phone photos from 10MB down to ~120KB in <100ms). */
export async function compressOdometerPhotoClient(file: File): Promise<File> {
  if (typeof document === "undefined") return file;
  if (!file.type.startsWith("image/")) return file;
  if (file.size < MIN_BYTES_TO_COMPRESS && (file.type === "image/jpeg" || file.type === "image/jpg")) {
    return file;
  }

  try {
    let width = 0;
    let height = 0;
    let source: ImageBitmap | HTMLImageElement | null = null;

    if (typeof createImageBitmap === "function") {
      try {
        const bitmap = await createImageBitmap(file);
        width = bitmap.width;
        height = bitmap.height;
        source = bitmap;
      } catch {
        source = null;
      }
    }

    if (!source) {
      source = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(url);
          resolve(img);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("Image decode failed"));
        };
        img.src = url;
      });
      width = source.naturalWidth || source.width;
      height = source.naturalHeight || source.height;
    }

    const longest = Math.max(width, height);
    const scale = longest > MAX_EDGE ? MAX_EDGE / longest : 1;
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      if ("close" in source && typeof source.close === "function") source.close();
      return file;
    }

    ctx.drawImage(source, 0, 0, targetW, targetH);
    if ("close" in source && typeof source.close === "function") source.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY);
    });

    if (!blob || blob.size >= file.size) return file;

    const stem = file.name.replace(/\.[^.]+$/, "") || "odometer";
    return new File([blob], `${stem}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}

export function formDataHasLargeImages(formData: FormData): boolean {
  for (const [, value] of formData.entries()) {
    if (value instanceof File && value.size > MIN_BYTES_TO_COMPRESS && value.type.startsWith("image/")) {
      return true;
    }
  }
  return false;
}

/** Pre-compress any large image files in FormData right before network submission. */
export async function compressFormDataImages(formData: FormData): Promise<void> {
  const tasks: Promise<void>[] = [];
  for (const [key, value] of formData.entries()) {
    if (value instanceof File && value.size > MIN_BYTES_TO_COMPRESS && value.type.startsWith("image/")) {
      tasks.push(
        compressOdometerPhotoClient(value).then((compressed) => {
          formData.set(key, compressed);
        }),
      );
    }
  }
  if (tasks.length > 0) {
    await Promise.all(tasks);
  }
}

