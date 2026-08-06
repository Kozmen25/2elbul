import type { ProductRecord } from "@/lib/product-detail";

export type CompatibilityMatchType =
  | "exact_device"
  | "family"
  | "brand"
  | "model";

export type CompatibleProduct = {
  product: ProductRecord;
  matchType: CompatibilityMatchType;
  matchStrength: number;
  matchedValue: string;
};

function extractCompatibilityField(
  attributes: unknown,
  field: "compatibleDevice" | "compatibleFamily" | "compatibleBrand" | "compatibleModel",
): string | null {
  if (!attributes || typeof attributes !== "object") return null;
  const record = attributes as Record<string, unknown>;
  const pu = record.productUnderstanding as Record<string, unknown> | undefined;
  if (!pu || typeof pu !== "object") return null;
  const fieldVal = pu[field] as { value?: unknown } | undefined;
  if (!fieldVal || typeof fieldVal !== "object") return null;
  if (typeof fieldVal.value === "string" && fieldVal.value.length > 0) return fieldVal.value;
  return null;
}

/**
 * Find products compatible with the given product using PUE compatibility fields.
 *
 * Reads `compatibleDevice`, `compatibleFamily`, `compatibleBrand`, `compatibleModel`
 * from `attributes.productUnderstanding` on both the source product and each candidate.
 * Returns candidates sorted by match strength:
 *   exact_device (40) > family (30) > brand (20) > model (10)
 *
 * Graceful degradation: returns empty array when no compatibility data is available
 * on the source product, or when no candidates match.
 */
export function getCompatibleProducts(
  product: ProductRecord,
  allProducts: ProductRecord[],
): CompatibleProduct[] {
  const compatibleDevice = extractCompatibilityField(product.attributes, "compatibleDevice");
  const compatibleFamily = extractCompatibilityField(product.attributes, "compatibleFamily");
  const compatibleBrand = extractCompatibilityField(product.attributes, "compatibleBrand");
  const compatibleModel = extractCompatibilityField(product.attributes, "compatibleModel");

  if (!compatibleDevice && !compatibleFamily && !compatibleBrand && !compatibleModel) {
    return [];
  }

  const results: CompatibleProduct[] = [];

  for (const candidate of allProducts) {
    if (candidate.id === product.id) continue;

    const candidateDevice = extractCompatibilityField(candidate.attributes, "compatibleDevice");
    const candidateFamily = extractCompatibilityField(candidate.attributes, "compatibleFamily");
    const candidateBrand = extractCompatibilityField(candidate.attributes, "compatibleBrand");
    const candidateModel = extractCompatibilityField(candidate.attributes, "compatibleModel");

    if (compatibleDevice && compatibleDevice === candidateDevice) {
      results.push({
        product: candidate,
        matchType: "exact_device",
        matchStrength: 40,
        matchedValue: compatibleDevice,
      });
    } else if (compatibleFamily && compatibleFamily === candidateFamily) {
      results.push({
        product: candidate,
        matchType: "family",
        matchStrength: 30,
        matchedValue: compatibleFamily,
      });
    } else if (compatibleBrand && compatibleBrand === candidateBrand) {
      results.push({
        product: candidate,
        matchType: "brand",
        matchStrength: 20,
        matchedValue: compatibleBrand,
      });
    } else if (compatibleModel && compatibleModel === candidateModel) {
      results.push({
        product: candidate,
        matchType: "model",
        matchStrength: 10,
        matchedValue: compatibleModel,
      });
    }
  }

  return results.sort((a, b) => b.matchStrength - a.matchStrength);
}
