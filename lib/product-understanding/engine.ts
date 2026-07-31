import { normalizeProductTitle } from "../normalization";
import { ProductUnderstandingInput, ProductUnderstandingResult, ProductType, ProductTypeSignal } from "./types";
import { PRODUCT_SIGNAL_WEIGHTS, fuseProductTypeSignals } from "./signal-registry";
import { ACCESSORY_PATTERNS, ACCESSORY_ONLY_BRANDS, ACCESSORY_PRICE_THRESHOLDS } from "./accessory-patterns";
import { SPARE_PART_PATTERNS } from "./spare-part-patterns";
import { extractCompatibleDevice } from "./compatible-device-extractor";
import { detectSellerType } from "./seller-type-detector";
import { detectWarranty } from "./warranty-detector";
import { detectProductCondition } from "./condition-orchestrator";

/**
 * Service keywords: titles that describe repair/maintenance services.
 * NOTE: ASCII equivalents of Turkish chars because normalizeProductTitle
 * converts Turkish characters before pattern matching runs.
 */
const SERVICE_PATTERNS = [
  /\b(?:tamir|onarim|repair|servis|hizmet|bakim)\b/i,
  /\b(?:teknik\s*servis|yetkili\s*servis)\b/i,
];

/**
 * Title structure patterns that suggest accessory rather than primary device.
 * Words like "için", "uyumlu" indicate the product is FOR another device.
 */
const ACCESSORY_TITLE_STRUCTURE = [
  /\bicin\b/i,
  /\buyumlu\b/i,
  /\bcompatible\b/i,
  /\bwith\b/i,
  /\bfits?\b/i,
];

/**
 * Run title structure check: does the title have "için"/"uyumlu" patterns?
 */
function checkTitleStructure(normalizedTitle: string): { isAccessory: boolean; patternCount: number } {
  let count = 0;
  for (const p of ACCESSORY_TITLE_STRUCTURE) {
    if (p.test(normalizedTitle)) count++;
  }
  return { isAccessory: count > 0, patternCount: count };
}

/**
 * Run accessory patterns against title, return best match.
 */
function matchAccessoryPatterns(
  normalizedTitle: string,
  price?: number,
  category?: string,
): ProductTypeSignal | null {
  let best: { type: ProductType; confidence: number } | null = null;

  for (const entry of ACCESSORY_PATTERNS) {
    for (const pattern of entry.patterns) {
      if (pattern.test(normalizedTitle)) {
        let confidence = entry.baseConfidence;

        // Price cross-signal: if price doesn't match expected priceSignal, adjust
        if (price !== undefined && entry.falsePositiveProtection) {
          const fp = entry.falsePositiveProtection;
          if (fp.maxPrice !== undefined && price > fp.maxPrice) {
            confidence -= 15; // Suspiciously expensive for this accessory type
          }
          if (fp.minPrice !== undefined && price < fp.minPrice) {
            confidence -= 10; // Suspiciously cheap
          }
        }

        // Category cross-signal: if category matches expected, boost
        if (category && entry.expectedCategory && category === entry.expectedCategory) {
          confidence += 5;
        } else if (category && entry.expectedCategory && category !== entry.expectedCategory) {
          confidence -= 5; // Category mismatch
        }

        if (!best || confidence > best.confidence) {
          best = { type: "accessory", confidence };
        }

        // Don't break — continue checking other patterns for higher confidence
      }
    }
  }

  if (!best) return null;

  return {
    signal: "patternMatch",
    value: "accessory",
    weight: PRODUCT_SIGNAL_WEIGHTS.patternMatch,
    confidence: best.confidence,
  };
}

/**
 * Run spare part patterns against title.
 */
function matchSparePartPatterns(
  normalizedTitle: string,
  category?: string,
): ProductTypeSignal | null {
  let bestConfidence = 0;

  for (const entry of SPARE_PART_PATTERNS) {
    for (const pattern of entry.patterns) {
      if (pattern.test(normalizedTitle)) {
        let confidence = entry.baseConfidence;

        // Category cross-signal
        if (entry.expectedCategory && category === entry.expectedCategory) {
          confidence += 5;
        } else if (category && category.toLowerCase().includes("yedek parça")) {
          confidence += 10;
        }

        if (confidence > bestConfidence) {
          bestConfidence = confidence;
        }
      }
    }
  }

  if (bestConfidence === 0) return null;

  return {
    signal: "patternMatch",
    value: "spare_part",
    weight: PRODUCT_SIGNAL_WEIGHTS.patternMatch,
    confidence: bestConfidence,
  };
}

/**
 * Service pattern match.
 */
function matchServicePatterns(normalizedTitle: string): ProductTypeSignal | null {
  for (const p of SERVICE_PATTERNS) {
    if (p.test(normalizedTitle)) {
      return {
        signal: "patternMatch",
        value: "service",
        weight: PRODUCT_SIGNAL_WEIGHTS.patternMatch,
        confidence: 85,
      };
    }
  }
  return null;
}

/**
 * Price-based signal: if price is well below typical device price for this brand,
 * it's likely an accessory.
 */
function getPriceSignal(
  price: number | undefined,
  brand?: string,
): ProductTypeSignal | null {
  if (price === undefined || price <= 0) return null;

  // Determine threshold based on brand
  const brandKey = brand?.toLowerCase() ?? "default";
  const threshold = ACCESSORY_PRICE_THRESHOLDS[brandKey] ?? ACCESSORY_PRICE_THRESHOLDS.default;

  if (price < threshold) {
    return {
      signal: "priceSignal",
      value: "accessory",
      weight: PRODUCT_SIGNAL_WEIGHTS.priceSignal,
      confidence: Math.min(80, Math.round((threshold - price) / threshold * 50) + 30),
    };
  }

  return null;
}

/**
 * Category-based signal from marketplace/category field.
 */
function getCategorySignal(marketplaceCategory?: string): ProductTypeSignal | null {
  if (!marketplaceCategory) return null;

  const cat = marketplaceCategory.toLowerCase();

  if (cat === "aksesuar" || cat.includes("aksesuar") || cat.includes("accessory")) {
    return {
      signal: "categorySignal",
      value: "accessory",
      weight: PRODUCT_SIGNAL_WEIGHTS.categorySignal,
      confidence: 80,
    };
  }

  if (cat.includes("yedek parça") || cat.includes("spare part") || cat.includes("tamir")) {
    return {
      signal: "categorySignal",
      value: "spare_part",
      weight: PRODUCT_SIGNAL_WEIGHTS.categorySignal,
      confidence: 75,
    };
  }

  if (cat.includes("telefon") || cat.includes("tablet") || cat.includes("bilgisayar") || cat.includes("laptop")) {
    return {
      signal: "categorySignal",
      value: "primary_product",
      weight: PRODUCT_SIGNAL_WEIGHTS.categorySignal,
      confidence: 50,
    };
  }

  return null;
}

/**
 * Title structure signal: "için" / "uyumlu" patterns suggest accessory.
 */
function getTitleStructureSignal(normalizedTitle: string): ProductTypeSignal | null {
  const { isAccessory, patternCount } = checkTitleStructure(normalizedTitle);
  if (!isAccessory) return null;

  const confidence = 60 + patternCount * 10;
  return {
    signal: "titleStructure",
    value: "accessory",
    weight: PRODUCT_SIGNAL_WEIGHTS.titleStructure,
    confidence: Math.min(90, confidence),
  };
}

/**
 * Description signal: check if description contains accessory keywords.
 */
function getDescriptionSignal(description?: string): ProductTypeSignal | null {
  if (!description) return null;

  const desc = description.toLowerCase();
  const accessoryCount = ACCESSORY_PATTERNS.filter((entry) =>
    entry.patterns.some((p) => p.test(desc)),
  ).length;

  if (accessoryCount > 0) {
    return {
      signal: "descriptionSignal",
      value: "accessory",
      weight: PRODUCT_SIGNAL_WEIGHTS.descriptionSignal,
      confidence: 60 + accessoryCount * 5,
    };
  }

  return null;
}

/**
 * Source signal: certain sources are known for specific product types.
 */
function getSourceSignal(sourceId?: string): ProductTypeSignal | null {
  if (!sourceId) return null;

  const src = sourceId.toLowerCase();

  if (src.includes("sahibinden") || src.includes("letgo")) {
    return {
      signal: "sourceSignal",
      value: "primary_product",
      weight: PRODUCT_SIGNAL_WEIGHTS.sourceSignal,
      confidence: 30, // Weak signal — individuals sell everything
    };
  }

  return null;
}

/**
 * Product type detection via multi-signal fusion.
 * Priority: service > spare_part > accessory > primary_product
 */
function detectProductType(
  input: ProductUnderstandingInput,
): {
  productType: { value: ProductType; confidence: number };
  accessoryType: { value: import("./types").AccessoryType | null; confidence: number };
  sparePartType: { value: import("./types").SparePartType | null; confidence: number };
  serviceType: { value: import("./types").ServiceType | null; confidence: number };
} {
  const normalizedTitle = normalizeProductTitle(input.title);
  const signals: ProductTypeSignal[] = [];

  // Gather all signals
  const serviceMatch = matchServicePatterns(normalizedTitle);
  if (serviceMatch) signals.push(serviceMatch);

  const accessoryMatch = matchAccessoryPatterns(normalizedTitle, input.price, input.marketplaceCategory);
  if (accessoryMatch) signals.push(accessoryMatch);

  const sparePartMatch = matchSparePartPatterns(normalizedTitle, input.marketplaceCategory);
  if (sparePartMatch) signals.push(sparePartMatch);

  const priceSignal = getPriceSignal(input.price, input.brand);
  if (priceSignal) signals.push(priceSignal);

  const categorySignal = getCategorySignal(input.marketplaceCategory);
  if (categorySignal) signals.push(categorySignal);

  const titleSignal = getTitleStructureSignal(normalizedTitle);
  if (titleSignal) signals.push(titleSignal);

  const sourceSignal = getSourceSignal(input.sourceId);
  if (sourceSignal) signals.push(sourceSignal);

  const descSignal = getDescriptionSignal(input.description);
  if (descSignal) signals.push(descSignal);

  // Accessory-only brand shortcut (strong signal)
  if (input.brand && ACCESSORY_ONLY_BRANDS.has(input.brand.toLowerCase())) {
    signals.push({
      signal: "patternMatch",
      value: "accessory",
      weight: PRODUCT_SIGNAL_WEIGHTS.patternMatch,
      confidence: 85,
    });
  }

  // Apply multi-signal fusion
  const fused = fuseProductTypeSignals(signals);

  // Determine sub-types based on best-matching patterns
  let accessoryType: { value: import("./types").AccessoryType | null; confidence: number } = { value: null, confidence: 0 };
  let sparePartType: { value: import("./types").SparePartType | null; confidence: number } = { value: null, confidence: 0 };
  let serviceType: { value: import("./types").ServiceType | null; confidence: number } = { value: null, confidence: 0 };

  if (fused.value === "accessory" || fused.value === "primary_product") {
    // Find the best accessory pattern match
    for (const entry of ACCESSORY_PATTERNS) {
      for (const pattern of entry.patterns) {
        if (pattern.test(normalizedTitle)) {
          if (entry.baseConfidence > accessoryType.confidence) {
            accessoryType = { value: entry.type, confidence: entry.baseConfidence };
          }
        }
      }
    }
  }

  if (fused.value === "spare_part" || fused.value === "primary_product") {
    for (const entry of SPARE_PART_PATTERNS) {
      for (const pattern of entry.patterns) {
        if (pattern.test(normalizedTitle)) {
          if (entry.baseConfidence > sparePartType.confidence) {
            sparePartType = { value: entry.type, confidence: entry.baseConfidence };
          }
        }
      }
    }
  }

  if (fused.value === "service") {
    serviceType = { value: "repair", confidence: 85 };
  }

  return {
    productType: fused,
    accessoryType,
    sparePartType,
    serviceType,
  };
}

/**
 * Main entry point for the Product Understanding Engine.
 * Analyzes a product listing and determines what is actually being sold.
 */
export function analyzeProduct(input: ProductUnderstandingInput): ProductUnderstandingResult {
  // Step 1: Detect product type
  const {
    productType,
    accessoryType,
    sparePartType,
    serviceType,
  } = detectProductType(input);

  // Step 2: Extract compatible device (only for accessories and spare parts)
  let compatibleDevice: { value: string | null; confidence: number } = { value: null, confidence: 0 };
  let compatibleBrand: { value: string | null; confidence: number } = { value: null, confidence: 0 };
  let compatibleFamily: { value: string | null; confidence: number } = { value: null, confidence: 0 };
  let compatibleModel: { value: string | null; confidence: number } = { value: null, confidence: 0 };

  if (productType.value === "accessory" || productType.value === "spare_part") {
    const extracted = extractCompatibleDevice(input.title);
    compatibleDevice = { value: extracted.deviceName, confidence: extracted.confidence };
    compatibleBrand = { value: extracted.brand, confidence: extracted.brand ? extracted.confidence : 0 };
    compatibleFamily = { value: extracted.family, confidence: extracted.family ? extracted.confidence : 0 };
    compatibleModel = { value: extracted.model, confidence: extracted.model ? extracted.confidence : 0 };
  }

  // Step 3: Detect condition
  const conditionResult = detectProductCondition(
    input.title,
    productType.value ?? undefined,
    input.sourceId,
    input.marketplaceCategory,
    input.description,
  );

  // Step 4: Detect seller type
  const sellerTypeResult = detectSellerType(input.sourceId, input.seller);

  // Step 5: Detect warranty
  const warrantyResult = detectWarranty(input.title, input.description, input.sourceId);

  // Determine product category
  const productCategory = {
    value: input.marketplaceCategory ?? null,
    confidence: input.marketplaceCategory ? 100 : 0,
  };

  return {
    productType,
    accessoryType,
    sparePartType,
    serviceType,
    compatibleDevice,
    compatibleBrand,
    compatibleFamily,
    compatibleModel,
    productCategory,
    condition: { value: conditionResult.value, confidence: conditionResult.confidence },
    sellerType: sellerTypeResult,
    warranty: warrantyResult,
  };
}
