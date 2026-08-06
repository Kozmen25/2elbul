import {
  extractProductTypeFromAttributes,
  extractPueField,
} from "../market-intelligence/helpers";
import type { SearchQueryIntent } from "./query-intent-detector";

function extractCompatibleFamily(attributes: unknown): string | null {
  return extractPueField(attributes, "compatibleFamily");
}

function extractDeviceFamily(attributes: unknown): string | null {
  return extractPueField(attributes, "deviceFamily");
}

function extractDeviceModel(attributes: unknown): string | null {
  return extractPueField(attributes, "deviceModel");
}

function extractCompatibleDevice(attributes: unknown): string | null {
  return extractPueField(attributes, "compatibleDevice");
}

/**
 * Check whether a product's PUE data exists at all.
 */
function hasPueData(attributes: unknown): boolean {
  return extractProductTypeFromAttributes(attributes) !== null;
}

// ─── Tier Scores ───

const TIER_1_EXACT_PRODUCT_TYPE = 1000;
const TIER_2_DEVICE_FAMILY = 800;
const TIER_3_COMPATIBILITY = 600;
const TIER_4_VARIANT = 400;
const TIER_5_HAS_PUE = 200;
const TIER_6_NO_PUE = 0;

const PENALTY_TYPE_MISMATCH = -300;

// ─── Scoring ───

/**
 * Score a single product's attributes against the detected query intent.
 * Returns a numeric score using the 6-tier hierarchy.
 *
 * @param intent   The detected query intent (from detectQueryIntent)
 * @param productAttributes  The product's attributes JSONB (raw)
 * @returns        Numeric score (higher = better match)
 */
export function scoreProductByPue(
  intent: SearchQueryIntent,
  productAttributes: unknown,
): number {
  let score = 0;

  // When no specific product type was detected in the query, default to
  // primary_product — the user searching "iPhone 14" wants the device, not accessories.
  const effectiveIntentType: "primary_product" | "accessory" | "spare_part" | "service" =
    intent.productType ?? "primary_product";

  // Read PUE data
  const productType = extractProductTypeFromAttributes(productAttributes);
  const deviceFamily = extractDeviceFamily(productAttributes);
  const compatibleFamily = extractCompatibleFamily(productAttributes);
  const compatibleDevice = extractCompatibleDevice(productAttributes);
  const deviceModel = extractDeviceModel(productAttributes);

  // Tier 1: Product Type match
  if (productType && effectiveIntentType === productType) {
    score += TIER_1_EXACT_PRODUCT_TYPE;
  }

  // Tier 2: Device Family match
  // For primary products, match against deviceFamily.
  // For accessories, match against compatibleFamily (the device it's FOR).
  const effectiveFamily = productType === "accessory" ? compatibleFamily : deviceFamily;
  if (intent.deviceFamily && effectiveFamily && intent.deviceFamily === effectiveFamily) {
    score += TIER_2_DEVICE_FAMILY;
  }

  // Tier 3: Compatibility match
  // When the query specifies a device AND the product is compatible with it.
  if (intent.deviceFamily && compatibleFamily && intent.deviceFamily === compatibleFamily) {
    // Only if Tier 2 didn't already add this (avoid double-counting)
    if (!(intent.deviceFamily === effectiveFamily)) {
      score += TIER_3_COMPATIBILITY;
    }
  }

  // Also check compatibleDevice for broader text match
  if (intent.deviceFamily && compatibleDevice) {
    const deviceLower = compatibleDevice.toLocaleLowerCase("tr-TR");
    const intentDeviceLower = intent.deviceFamily.toLocaleLowerCase("tr-TR");
    if (deviceLower.includes(intentDeviceLower) || intentDeviceLower.includes(deviceLower)) {
      if (!(intent.deviceFamily === effectiveFamily) && !(intent.deviceFamily === compatibleFamily)) {
        score += TIER_3_COMPATIBILITY;
      }
    }
  }

  // Tier 4: Variant / Model match
  if (intent.model && deviceModel && intent.model === deviceModel) {
    score += TIER_4_VARIANT;
  }

  // Tier 5: Has PUE data (even if no specific match)
  const hasData = hasPueData(productAttributes);
  if (hasData) {
    score += TIER_5_HAS_PUE;
  }

  // Penalty: Type mismatch
  if (productType && effectiveIntentType !== productType) {
    // Only penalize when the mismatch is semantically meaningful:
    // - User wants accessory → product is primary_device (or vice versa)
    const intentIsAccessory = effectiveIntentType === "accessory" || effectiveIntentType === "spare_part";
    const productIsAccessory = productType === "accessory" || productType === "spare_part";
    if (intentIsAccessory !== productIsAccessory) {
      score += PENALTY_TYPE_MISMATCH;
    }
  }

  return score;
}

// ─── Batch Ranking ───

/**
 * Rank a list of listings by their PUE score against the query intent.
 * Listings are sorted by score descending, then price ascending for ties.
 *
 * @param intent       The detected query intent
 * @param listings     The listings to rank (must have productId)
 * @param productLookup  Map<productId-string, { attributes?: unknown }>
 * @returns            The same listings sorted by score, with pueScore attached
 */
export function rankListingsByPue<T extends { productId: string; price: number }>(
  intent: SearchQueryIntent,
  listings: T[],
  productLookup: Map<string, { attributes?: unknown }>,
): (T & { pueScore: number })[] {
  return listings
    .map((listing) => {
      const product = productLookup.get(String(listing.productId));
      const pueScore = product
        ? scoreProductByPue(intent, product.attributes)
        : TIER_6_NO_PUE;
      return { ...listing, pueScore };
    })
    .sort((a, b) => {
      if (b.pueScore !== a.pueScore) return b.pueScore - a.pueScore;
      return a.price - b.price;
    });
}

/**
 * Get the PUE score for a single listing. Convenience wrapper for callers
 * that need per-item scores without the full batch sort.
 */
export function attachPueScore(
  intent: SearchQueryIntent,
  productId: string,
  productLookup: Map<string, { attributes?: unknown }>,
): number {
  const product = productLookup.get(String(productId));
  return product
    ? scoreProductByPue(intent, product.attributes)
    : TIER_6_NO_PUE;
}
