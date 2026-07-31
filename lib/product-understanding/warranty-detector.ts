/**
 * Warranty detector.
 * Scans title (highest confidence), then description, then source signal.
 */

const GARANTILI_PATTERNS = [
  /\bgaranti(?:li|si)\b/i,
  /\bgarantili\b/i,
  /\bgaranti\s*ver(?:ili|ilir)\b/i,
  /\bresmi\s*garanti\b/i,
  /\b2\.?\s*yıl\s*garanti\b/i,
  /\b1\.?\s*yıl\s*garanti\b/i,
  /\bapple\s*(?:care|protection|garanti)/i,
];

const GARANTISIZ_PATTERNS = [
  /\bgaranti(?:siz|si\s*yok)\b/i,
  /\bgaranti\s*yok\b/i,
];

const SOURCE_WITH_WARRANTY = new Set([
  "Vatan",
  "MediaMarkt",
  "Teknosa",
  "Amazon",
  "Hepsiburada",
  "Trendyol",
]);

const SOURCE_WITHOUT_WARRANTY = new Set([
  "Sahibinden",
  "Letgo",
]);

export function detectWarranty(
  title: string,
  description?: string,
  source?: string,
): { value: boolean | null; confidence: number } {
  // Title scan (highest confidence)
  for (const pattern of GARANTILI_PATTERNS) {
    if (pattern.test(title)) {
      return { value: true, confidence: 90 };
    }
  }

  for (const pattern of GARANTISIZ_PATTERNS) {
    if (pattern.test(title)) {
      return { value: false, confidence: 85 };
    }
  }

  // Description scan (medium confidence)
  if (description) {
    for (const pattern of GARANTILI_PATTERNS) {
      if (pattern.test(description)) {
        return { value: true, confidence: 80 };
      }
    }

    for (const pattern of GARANTISIZ_PATTERNS) {
      if (pattern.test(description)) {
        return { value: false, confidence: 75 };
      }
    }
  }

  // Source signal (lowest confidence)
  if (source) {
    if (SOURCE_WITH_WARRANTY.has(source)) {
      return { value: true, confidence: 70 };
    }
    if (SOURCE_WITHOUT_WARRANTY.has(source)) {
      return { value: false, confidence: 60 };
    }
  }

  return { value: null, confidence: 0 };
}
