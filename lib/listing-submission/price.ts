// Turkish price input: "25.000", "25.000,50", "25000", "₺25.000 TL" → number.

export const MAX_LISTING_PRICE = 100_000_000;

/** Returns the price in TRY (at most 2 decimals), or null when it is not a usable price. */
export function parseTlPrice(input: string): number | null {
  const cleaned = input.replace(/[₺\s]|tl/gi, "");
  if (!cleaned || !/^[\d.,]+$/.test(cleaned)) return null;

  let normalized: string;
  if (cleaned.includes(",")) {
    // Comma is the decimal separator; dots are thousands separators.
    const parts = cleaned.split(",");
    if (parts.length !== 2 || parts[1].length > 2) return null;
    if (!/^\d{1,3}(\.\d{3})*$|^\d+$/.test(parts[0])) return null;
    normalized = `${parts[0].replace(/\./g, "")}.${parts[1] || "0"}`;
  } else if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    normalized = cleaned.replace(/\./g, ""); // 25.000 → 25000
  } else if (/^\d+\.\d{1,2}$/.test(cleaned)) {
    normalized = cleaned; // 25.5 → decimal
  } else if (/^\d+$/.test(cleaned)) {
    normalized = cleaned;
  } else {
    return null;
  }

  const value = Math.round(Number(normalized) * 100) / 100;
  return Number.isFinite(value) && value > 0 && value <= MAX_LISTING_PRICE ? value : null;
}

/**
 * Formats what the user is typing with thousands dots while keeping a decimal
 * comma: "25000" → "25.000", "1234,5" → "1.234,5". Anything that is not a
 * digit or the first comma is dropped.
 */
export function formatTlInput(raw: string): string {
  const commaIndex = raw.indexOf(",");
  const integerPart = (commaIndex === -1 ? raw : raw.slice(0, commaIndex)).replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (commaIndex === -1) return grouped;
  const decimals = raw.slice(commaIndex + 1).replace(/\D/g, "").slice(0, 2);
  return `${grouped || "0"},${decimals}`;
}
