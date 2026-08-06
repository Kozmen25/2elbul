import type { ConfidenceLevel, ConfidenceResult } from "@/lib/confidence-engine";
import { formatCurrencyTRY } from "@/lib/formatters";
import { calculateConfidenceLevel, clampScore } from "@/lib/confidence-engine/scoring";
import type { MarketIntelligenceListing, MarketSourceBreakdown } from "./types";

export function normalizeAnalysisTimestamp(value?: string | Date | null): string {
  if (!value) return new Date().toISOString();

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

export function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => normalizeText(value)).filter(Boolean))];
}

export function normalizeText(value: string | null | undefined): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

export function toConfidenceLevel(score: number | null | undefined): ConfidenceLevel {
  if (typeof score !== "number" || !Number.isFinite(score)) return "very-low";
  return calculateConfidenceLevel(clampScore(score));
}

export function toConfidenceResult(
  score: number | null | undefined,
  reasons: string[],
): ConfidenceResult | null {
  if (typeof score !== "number" || !Number.isFinite(score)) return null;

  const normalized = clampScore(score);
  return {
    score: normalized,
    level: calculateConfidenceLevel(normalized),
    reasons,
    signals: {},
  };
}

export function calculateAverage(values: Array<number | null | undefined>): number | null {
  const normalized = values
    .map((value) => (typeof value === "number" && Number.isFinite(value) ? value : null))
    .filter((value): value is number => value !== null);

  if (!normalized.length) return null;

  return Math.round(
    normalized.reduce((sum, value) => sum + value, 0) / normalized.length,
  );
}

export function roundDecimal(value: number, digits = 1): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function formatCurrency(value: number | null | undefined): string {
  return formatCurrencyTRY(value);
}

export function getValidPrices(listings: MarketIntelligenceListing[]): number[] {
  return listings
    .map((listing) => Number(listing.price))
    .filter((price) => Number.isFinite(price) && price > 0);
}

export function getActiveListingCount(listings: MarketIntelligenceListing[]): number {
  return listings.filter((listing) => isActiveListing(listing)).length;
}

export function isActiveListing(listing: MarketIntelligenceListing): boolean {
  if (!listing.status) return true;

  const status = listing.status.toLocaleLowerCase("tr-TR");
  return status === "active" || status === "published";
}

export function buildSourceBreakdown(
  listings: MarketIntelligenceListing[],
): MarketSourceBreakdown[] {
  if (!listings.length) return [];

  const grouped = new Map<
    string,
    {
      count: number;
      prices: number[];
    }
  >();
  for (const listing of listings) {
    const source = normalizeText(listing.source) || "Bilinmeyen kaynak";
    const price = Number(listing.price);
    const current = grouped.get(source) ?? { count: 0, prices: [] };
    current.count += 1;
    if (Number.isFinite(price) && price > 0) {
      current.prices.push(price);
    }
    grouped.set(source, current);
  }

  const totalListingCount = listings.length;

  return [...grouped.entries()]
    .map(([source, entry]) => {
      const { count, prices } = entry;
      const averagePrice = calculateAverage(prices);
      const lowestPrice = prices.length ? Math.min(...prices) : null;
      const highestPrice = prices.length ? Math.max(...prices) : null;

      return {
        source,
        listingCount: count,
        share: roundDecimal(
          totalListingCount > 0 ? count / totalListingCount : 0,
          3,
        ),
        averagePrice,
        lowestPrice,
        highestPrice,
      };
    })
    .sort(
      (a, b) =>
        b.listingCount - a.listingCount ||
        a.source.localeCompare(b.source, "tr"),
    );
}

export function averageConfidenceScore(
  confidenceScores: Array<number | null | undefined>,
): number | null {
  const normalized = confidenceScores
    .map((value) => (typeof value === "number" && Number.isFinite(value) ? clampScore(value) : null))
    .filter((value): value is number => value !== null);

  if (!normalized.length) return null;

  return Math.round(
    normalized.reduce((sum, value) => sum + value, 0) / normalized.length,
  );
}

/**
 * Extract the product type from a product's attributes JSONB column.
 * Product Understanding stores the result at:
 *   attributes.productUnderstanding.productType.value
 */
export function extractProductTypeFromAttributes(
  attributes: unknown,
): string | null {
  if (!attributes || typeof attributes !== "object") return null;
  const record = attributes as Record<string, unknown>;
  const pu = record.productUnderstanding as Record<string, unknown> | undefined;
  if (!pu || typeof pu !== "object") return null;
  const pt = pu.productType as { value?: unknown } | undefined;
  if (!pt || typeof pt !== "object") return null;
  if (typeof pt.value === "string" && pt.value.length > 0) return pt.value;
  return null;
}

/**
 * Extract any ScoredValue<string> field from attributes.productUnderstanding.
 * Works for: compatibleFamily, deviceFamily, compatibleDevice, deviceModel, etc.
 * Returns the `value` string, or null if the field is missing/empty.
 */
export function extractPueField(
  attributes: unknown,
  field: string,
): string | null {
  if (!attributes || typeof attributes !== "object") return null;
  const record = attributes as Record<string, unknown>;
  const pu = record.productUnderstanding as Record<string, unknown> | undefined;
  if (!pu || typeof pu !== "object") return null;
  const f = pu[field] as { value?: unknown } | undefined;
  if (!f || typeof f !== "object") return null;
  if (typeof f.value === "string" && f.value.length > 0) return f.value;
  return null;
}

/**
 * Filter MarketIntelligenceListing[] to only include listings whose product
 * type matches the expected type. Uses Product Understanding data stored in
 * each product's attributes JSONB, accessed via a product lookup map.
 *
 * Also populates listing.productType from the product attributes for
 * downstream consumers.
 *
 * Graceful degradation: when expectedProductType is null/undefined, or when
 * product attributes are unavailable, returns all listings unchanged.
 */
export function filterListingsByProductType(
  listings: MarketIntelligenceListing[],
  expectedProductType: string | null | undefined,
  productLookup: Map<string, { attributes?: unknown }>,
): MarketIntelligenceListing[] {
  if (!expectedProductType || !listings.length) return listings;

  return listings
    .map((listing) => {
      const pid = listing.productId;
      if (pid == null) return null;

      const product = productLookup.get(String(pid));
      if (!product) return null;

      const actualType = extractProductTypeFromAttributes(product.attributes);
      if (!actualType) return null;

      if (actualType !== expectedProductType) return null;

      return { ...listing, productType: actualType };
    })
    .filter((l) => l !== null) as MarketIntelligenceListing[];
}

/**
 * Determine the most common product type across a set of products.
 * Returns null when no products have product type data.
 * Used by aggregate pages (city, category, brand) to determine the
 * dominant product type for market intelligence comparison gating.
 */
export function dominantProductType(
  products: Array<{ attributes?: unknown }>,
): string | null {
  const counts = new Map<string, number>();
  for (const product of products) {
    const pt = extractProductTypeFromAttributes(product.attributes);
    if (pt) {
      counts.set(pt, (counts.get(pt) ?? 0) + 1);
    }
  }
  if (!counts.size) return null;

  let maxCount = 0;
  let dominant: string | null = null;
  for (const [type, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      dominant = type;
    }
  }
  return dominant;
}
