import {
  normalizeProductTitle,
  extractBrand,
  detectModel,
  formatBrandDisplayName,
} from "../normalization";
import { getAllAccessoryRemoveTerms } from "./accessory-patterns";
import { getAllSparePartRemoveTerms } from "./spare-part-patterns";

/**
 * Strip-and-extract algorithm:
 * 1. Normalize title
 * 2. Strip known accessory/spare-part terms
 * 3. Call extractBrand() + detectModel() on remaining text
 * 4. Return compatible device info with confidence
 *
 * NOTE: REMOVE_TERMS use ASCII equivalents of Turkish characters because
 * normalizeProductTitle converts Turkish chars before strip-and-extract runs.
 */

// Pre-computed set of terms to strip
const REMOVE_TERMS = new Set([
  ...getAllAccessoryRemoveTerms(),
  ...getAllSparePartRemoveTerms(),
  "icin", "uyumlu", "compatible", "with", "phone", "telefon",
  "model", "parca", "part", "replacement", "yedek",
  "orijinal", "original", "premium", "kaliteli",
  "fiyat", "en", "ucuz", "en ucuz",
  "satilik", "satilik",
]);

export function extractCompatibleDevice(
  title: string,
): {
  deviceName: string | null;
  brand: string | null;
  model: string | null;
  family: string | null;
  confidence: number;
} {
  const normalized = normalizeProductTitle(title);
  const tokens = normalized.split(/\s+/).filter(Boolean);

  // Strip remove terms
  const remaining = tokens.filter((t) => !REMOVE_TERMS.has(t)).join(" ");

  if (!remaining.trim()) {
    return { deviceName: null, brand: null, model: null, family: null, confidence: 0 };
  }

  // Extract brand from remaining text
  let brand = extractBrand(remaining);

  // Extract model from remaining text (calls internal detectModel)
  const remainingTokens = remaining.split(/\s+/).filter(Boolean);
  const model = detectModel(remaining, remainingTokens, brand);

  // Determine device name and family
  let deviceName: string | null = null;
  let family: string | null = null;

  if (brand && model) {
    const modelParts = model.split("-");
    family = modelParts[0];

    // Use display-friendly brand names based on detected model prefix
    // "iphone" prefix → "iPhone"; "galaxy" prefix → "Samsung"; else capitalize
    let displayBrand: string;
    if (modelParts[0] === "iphone") {
      displayBrand = "iPhone";
    } else if (modelParts[0] === "galaxy" || modelParts[0] === "ipad" || modelParts[0] === "macbook") {
      // detectModel returns "iphone-15-pro-max", "galaxy-s24-ultra", etc.
      // For galaxy models, use "Samsung" as the display brand
      const lowerBrand = brand.toLowerCase();
      if (lowerBrand === "samsung" || lowerBrand === "apple") {
        displayBrand = lowerBrand === "samsung" ? "Samsung" : "Apple";
      } else {
        displayBrand = formatBrandDisplayName(brand) ?? brand;
      }
    } else {
      displayBrand = formatBrandDisplayName(brand) ?? brand;
    }

    if (modelParts.length >= 2) {
      deviceName = `${displayBrand} ${modelParts.slice(1).join(" ")}`;
    } else {
      deviceName = `${displayBrand} ${model}`;
    }
  } else if (brand) {
    deviceName = formatBrandDisplayName(brand);
    family = brand;
  } else {
    // Try to detect iPhone/Samsung without brand — extract from original normalized
    const iphone = normalized.match(/\biphone\s*(1[1-6])/i);
    if (iphone) {
      deviceName = `iPhone ${iphone[1]}`;
      brand ??= "apple";
      family = "iphone";
    } else {
      const samsung = normalized.match(/\bgalaxy\s*(\w+)/i);
      if (samsung) {
        deviceName = `Samsung Galaxy ${samsung[1]}`;
        brand ??= "samsung";
        family = "galaxy";
      }
    }
  }

  // Confidence scoring
  let confidence = 0;
  if (brand || model) {
    confidence = 60;
    if (brand) confidence += 10;
    if (model) confidence += 15;
    if (deviceName && deviceName.length > 3) confidence += 15;
  }

  confidence = Math.min(100, confidence);

  return { deviceName, brand, model, family, confidence };
}
