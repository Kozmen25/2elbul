/**
 * Canonical mapping from PUE ProductType to taxonomy category strings.
 * Single source of truth — every file that currently hardcodes
 * "Aksesuar", "Yedek Parça", "Servis" etc. should import from here.
 */

/**
 * CATEGORY_LABELS — all canonical category string constants in one place.
 * Every consumer in the codebase should reference these instead of
 * hardcoding Turkish strings.
 */
export const CATEGORY_LABELS = {
  PHONE: "Telefon",
  TABLET: "Tablet",
  LAPTOP: "Laptop",
  CONSOLE: "Oyun Konsolu",
  COMPUTER: "Bilgisayar",
  ACCESSORY: "Aksesuar",
  SPARE_PART: "Yedek Parça",
  SERVICE: "Servis",
  TV_AUDIO: "TV / Ses",
  VEHICLE: "Araç",
  REAL_ESTATE: "Emlak",
  HOME_LIVING: "Ev / Yaşam",
} as const;

/**
 * Canonical mapping from PUE ProductType (stored in
 * attributes.productUnderstanding.productType.value) to category labels.
 *
 * "primary_product" has no fixed category — it's resolved dynamically
 * via deviceFamily (see resolvePrimaryProductCategory).
 */
export const PRODUCT_TYPE_TO_CATEGORY: Record<string, string | null> = {
  primary_product: null,
  accessory: CATEGORY_LABELS.ACCESSORY,
  spare_part: CATEGORY_LABELS.SPARE_PART,
  service: CATEGORY_LABELS.SERVICE,
};

/**
 * Look up the canonical category for a PUE productType string.
 * Returns null for unknown types or primary_product (which needs
 * device-family resolution).
 */
export function getCategoryForProductType(
  productType: string | null | undefined,
): string | null {
  if (!productType) return null;
  return PRODUCT_TYPE_TO_CATEGORY[productType] ?? null;
}

/**
 * Resolve the effective category for a product.
 *
 * Priority:
 * 1. PUE productType override (accessory → "Aksesuar", spare_part → "Yedek Parça")
 * 2. Fallback to the provided category string
 *
 * This replaces patterns like:
 *   if (pueProductType === "accessory") category = "Aksesuar";
 */
export function resolveProductCategory(
  productType: string | null | undefined,
  category: string | null | undefined,
): string | null {
  const mapped = getCategoryForProductType(productType);
  if (mapped) return mapped;
  return category ?? null;
}

/**
 * Resolve category for primary_product type products based on deviceFamily.
 * Used when PRODUCT_TYPE_TO_CATEGORY returns null for "primary_product".
 */
export function resolvePrimaryProductCategory(
  deviceFamily: string | null | undefined,
): string | null {
  if (!deviceFamily) return null;
  const df = deviceFamily.toLowerCase();

  if (df.includes("telefon") || df.includes("phone")) return CATEGORY_LABELS.PHONE;
  if (df.includes("tablet") || df.includes("ipad")) return CATEGORY_LABELS.TABLET;
  if (
    df.includes("laptop") ||
    df.includes("notebook") ||
    df.includes("macbook")
  )
    return CATEGORY_LABELS.LAPTOP;
  if (
    df.includes("konsol") ||
    df.includes("playstation") ||
    df.includes("xbox")
  )
    return CATEGORY_LABELS.CONSOLE;
  if (
    df.includes("bilgisayar") ||
    df.includes("pc") ||
    df.includes("desktop")
  )
    return CATEGORY_LABELS.COMPUTER;

  return null;
}
