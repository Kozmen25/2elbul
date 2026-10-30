// Browser-only: shrinks a photo before it is uploaded. Phone photos are 3–8 MB;
// the server accepts 1.5 MB, and a 1600 px JPEG is plenty for a listing card.

export const MAX_EDGE_PX = 1600;
const TARGET_BYTES = 900_000;
const START_QUALITY = 0.85;
const MIN_QUALITY = 0.5;
const QUALITY_STEP = 0.1;
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export class UnsupportedImageError extends Error {}

export async function shrinkImage(file: File): Promise<File> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new UnsupportedImageError("Fotoğraf JPEG, PNG ya da WebP olmalı.");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new UnsupportedImageError("Bu fotoğraf açılamadı. Başka bir fotoğraf deneyin.");
  }

  const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new UnsupportedImageError("Fotoğraf işlenemedi.");
  // JPEG has no transparency: paint white first so transparent PNGs do not turn black.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  let quality = START_QUALITY;
  let blob: Blob | null = null;
  while (quality >= MIN_QUALITY - 1e-9) {
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= TARGET_BYTES) break;
    quality -= QUALITY_STEP;
  }
  if (!blob) throw new UnsupportedImageError("Fotoğraf işlenemedi.");

  return new File([blob], "ilan-foto.jpg", { type: "image/jpeg" });
}
