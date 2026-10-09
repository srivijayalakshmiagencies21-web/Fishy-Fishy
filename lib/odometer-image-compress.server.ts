import sharp from "sharp";

const MAX_EDGE = 1280;
const JPEG_QUALITY = 82;
/** Skip re-encoding tiny JPEGs. */
const MIN_BYTES_TO_COMPRESS = 220_000;

export type PreparedOdometerImage = {
  body: Buffer;
  contentType: string;
  extension: string;
};

function extensionFromMime(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

/** Resize + JPEG encode before storage (odometer photos from phones are often 3–8 MB). */
export async function prepareOdometerImageForStorage(file: File): Promise<PreparedOdometerImage> {
  const input = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "image/jpeg";

  if (input.length < MIN_BYTES_TO_COMPRESS && (mime === "image/jpeg" || mime === "image/jpg")) {
    return { body: input, contentType: "image/jpeg", extension: "jpg" };
  }

  try {
    const compressed = await sharp(input)
      .rotate()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();

    if (compressed.length < input.length) {
      return { body: compressed, contentType: "image/jpeg", extension: "jpg" };
    }

    return { body: input, contentType: mime, extension: extensionFromMime(mime) };
  } catch {
    return { body: input, contentType: mime, extension: extensionFromMime(mime) };
  }
}

export function storagePathWithExtension(objectPath: string, extension: string) {
  const base = objectPath.replace(/\.[^./]+$/, "");
  return `${base}.${extension.replace(/^\./, "")}`;
}
