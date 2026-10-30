// Identifies an uploaded image by its magic bytes instead of trusting the
// browser-supplied file type or extension.

export type ImageType = "image/png" | "image/jpeg" | "image/webp";

const PNG = [137, 80, 78, 71, 13, 10, 26, 10];
const RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP = [0x57, 0x45, 0x42, 0x50];

export const IMAGE_EXTENSIONS: Record<ImageType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** PNG, JPEG (SOI + APP0/APP1) or WebP ("RIFF....WEBP"); null for anything else. */
export function detectImageType(bytes: Uint8Array): ImageType | null {
  if (bytes.length < 12) return null;
  if (PNG.every((byte, index) => bytes[index] === byte)) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff && (bytes[3] === 0xe0 || bytes[3] === 0xe1)) {
    return "image/jpeg";
  }
  if (RIFF.every((byte, index) => bytes[index] === byte) && WEBP.every((byte, index) => bytes[8 + index] === byte)) {
    return "image/webp";
  }
  return null;
}

export function isLikelyImage(bytes: Uint8Array): boolean {
  return detectImageType(bytes) !== null;
}
