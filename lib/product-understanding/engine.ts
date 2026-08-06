import { normalizeProductTitle } from "../normalization";
import { CATEGORY_LABELS } from "@/lib/taxonomy/product-type-mapping";
import { ProductUnderstandingInput, ProductUnderstandingResult, ProductType, ProductTypeSignal, ProductIntent, ScoredValue, AccessoryType, SparePartType, ServiceType } from "./types";
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
        } else if (category && category.toLowerCase().includes(CATEGORY_LABELS.SPARE_PART.toLowerCase())) {
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

  if (cat.includes(CATEGORY_LABELS.ACCESSORY.toLowerCase()) || cat.includes("accessory")) {
    return {
      signal: "categorySignal",
      value: "accessory",
      weight: PRODUCT_SIGNAL_WEIGHTS.categorySignal,
      confidence: 80,
    };
  }

  if (cat.includes(CATEGORY_LABELS.SPARE_PART.toLowerCase()) || cat.includes("spare part") || cat.includes("tamir")) {
    return {
      signal: "categorySignal",
      value: "spare_part",
      weight: PRODUCT_SIGNAL_WEIGHTS.categorySignal,
      confidence: 75,
    };
  }

  if (cat.includes(CATEGORY_LABELS.PHONE.toLowerCase()) || cat.includes(CATEGORY_LABELS.TABLET.toLowerCase()) || cat.includes(CATEGORY_LABELS.COMPUTER.toLowerCase()) || cat.includes(CATEGORY_LABELS.LAPTOP.toLowerCase())) {
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
  signals: ProductTypeSignal[];
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

  if (fused.value === "accessory" || fused.value === "primary_product" || fused.value === "spare_part") {
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
    signals,
  };
}

/**
 * Determine product intent from entity context.
 * Maps productType to the semantic ProductIntent enum.
 */
function determineProductIntent(
  productType: ProductType,
  accessoryType: AccessoryType | null,
  sparePartType: SparePartType | null,
  serviceType: ServiceType | null,
): ProductIntent {
  // Product intent is a direct mapping from the engine's classified type
  switch (productType) {
    case "accessory":
      return "Accessory";
    case "spare_part":
      return "Replacement Part";
    case "service":
      return "Repair Service";
    case "primary_product":
      return "Device";
    default:
      return "Unknown";
  }
}

/**
 * Determine device family — what the product IS, not what it's FOR.
 * For accessories/spare_parts, this is the accessory type (e.g. screen_protector → "Screen Protector").
 * For primary products/services, extracted from the product's entity context.
 */
function determineDeviceFamily(
  productType: ProductType,
  accessoryType: { value: AccessoryType | null; confidence: number },
  sparePartType: { value: SparePartType | null; confidence: number },
  serviceType: { value: ServiceType | null; confidence: number },
): ScoredValue<string> {
  if (productType === "accessory" && accessoryType.value) {
    // Map AccessoryType to human-readable device family
    const accessoryFamilyMap: Record<AccessoryType, string> = {
      screen_protector: "Screen Protector",
      case: "Case",
      charger: "Charger",
      cable: "Cable",
      adapter: "Adapter",
      powerbank: "Power Bank",
      headphone: "Headphone",
      hub: "Hub",
      holder: "Holder",
      lens: "Lens",
      battery: "Battery Pack",
      keyboard: "Keyboard",
      mouse: "Mouse",
      watch: "Watch",
      airpods: "AirPods",
      tripod: "Tripod",
      selfie_stick: "Selfie Stick",
      stand: "Stand",
      filter: "Filter",
      cleaner: "Cleaner",
    };
    return {
      value: accessoryFamilyMap[accessoryType.value] ?? "Accessory",
      confidence: accessoryType.confidence,
    };
  }

  if (productType === "spare_part" && sparePartType.value) {
    const sparePartFamilyMap: Record<SparePartType, string> = {
      screen: "Screen",
      battery: "Battery",
      charging_port: "Charging Port",
      camera_module: "Camera Module",
      speaker: "Speaker",
      button: "Button",
      connector_flex: "Connector Flex",
    };
    return {
      value: sparePartFamilyMap[sparePartType.value] ?? "Spare Part",
      confidence: sparePartType.confidence,
    };
  }

  if (productType === "service" && serviceType.value) {
    return {
      value: "Repair Service",
      confidence: 85,
    };
  }

  // For primary products, deviceFamily stays null — it's determined by brand+model context
  return { value: null, confidence: 0 };
}

/**
 * Determine device model — specific model number extracted from the title.
 * For accessories/spare_parts, this is null (the compatible device is tracked separately).
 * For primary products, extracted from the title.
 */
function determineDeviceModel(
  productType: ProductType,
  normalizedTitle: string,
): ScoredValue<string> {
  if (productType !== "primary_product") {
    return { value: null, confidence: 0 };
  }

  // Extract model patterns from the title for the primary product
  const modelPatterns = [
    /iphone\s*(\d+\s*(?:pro\s*max|pro|plus|mini|\d*)?)/i,
    /samsung\s*(?:galaxy\s*)?([a-z]\d+\w*)/i,
    /macbook\s*(?:air|pro)\s*(?:\d+\s*)?(?:m\d\s*)?(?:inch)?/i,
    /ipad\s*(?:pro|air|mini|\d+)/i,
    /xiaomi\s*([a-z0-9]+\s*[a-z0-9]*)/i,
    /huawei\s*([a-z0-9]+\s*[a-z0-9]*)/i,
    /playstation\s*(\d+)/i,
  ];

  for (const pattern of modelPatterns) {
    const match = normalizedTitle.match(pattern);
    if (match) {
      const model = match[0].trim();
      return { value: model, confidence: 75 };
    }
  }

  return { value: null, confidence: 0 };
}

/**
 * Price Reality Check — weighted signal only, NEVER binary.
 * If a product has an implausible price for its type, this signal
 * nudges the system toward the correct category. It never makes a
 * hard classification by itself.
 *
 * Example: 250 TL for iPhone 14 Pro → increases accessory probability
 * (does NOT classify as phone with 99% discount).
 */
function calculatePriceRealityCheck(
  price: number | undefined,
  productType: ScoredValue<ProductType>,
  brand?: string,
): ScoredValue<{ isReasonable: boolean; expectedPriceRange: [number, number] | null; signalDirection: "accessory" | "primary" | null }> {
  if (price === undefined || price <= 0) {
    return {
      value: { isReasonable: true, expectedPriceRange: null, signalDirection: null },
      confidence: 0,
    };
  }

  const brandKey = brand?.toLowerCase() ?? "default";
  const threshold = ACCESSORY_PRICE_THRESHOLDS[brandKey] ?? ACCESSORY_PRICE_THRESHOLDS.default;

  // Compute expected price range based on product type
  let expectedPriceRange: [number, number] | null = null;
  let signalDirection: "accessory" | "primary" | null = null;
  let isReasonable = true;

  if (productType.value === "primary_product") {
    // For a primary product, check if price is suspiciously low
    const brandMinPrice: Record<string, number> = {
      default: 1000,
      iphone: 5000,
      samsung: 2000,
      xiaomi: 1500,
      huawei: 2000,
    };
    const minPrice = brandMinPrice[brandKey] ?? brandMinPrice.default;

    if (price < threshold) {
      // Very low price for a "primary" device → signals accessory
      expectedPriceRange = [threshold, threshold * 20];
      isReasonable = false;
      signalDirection = "accessory";
    } else if (price < minPrice) {
      // Below typical device price but reasonable for low-end
      expectedPriceRange = [minPrice, minPrice * 15];
      isReasonable = true;
      signalDirection = null;
    } else {
      expectedPriceRange = [minPrice, minPrice * 15];
      isReasonable = true;
      signalDirection = "primary";
    }
  } else if (productType.value === "accessory") {
    // For an accessory, check if price is suspiciously high
    if (price > ACCESSORY_PRICE_THRESHOLDS.default * 20) {
      // Very high price for an accessory → weak signal that it might be primary
      expectedPriceRange = [50, ACCESSORY_PRICE_THRESHOLDS.default * 10];
      isReasonable = false;
      signalDirection = "primary";
    } else {
      expectedPriceRange = [10, ACCESSORY_PRICE_THRESHOLDS.default * 10];
      isReasonable = price > 10; // Reasonable if not zero
      signalDirection = "accessory";
    }
  } else if (productType.value === "spare_part") {
    expectedPriceRange = [10, 3000];
    isReasonable = price >= 10 && price <= 5000;
    signalDirection = null;
  } else {
    expectedPriceRange = null;
    isReasonable = true;
    signalDirection = null;
  }

  // Confidence: how confident are we in this reality check?
  const priceRatio = signalDirection === "accessory"
    ? threshold / price
    : (signalDirection === "primary" && expectedPriceRange
        ? price / expectedPriceRange[0]
        : 1);
  const confidence = Math.min(85, Math.round(50 + Math.min(priceRatio, 3) * 10));

  return {
    value: { isReasonable, expectedPriceRange, signalDirection },
    confidence,
  };
}

/**
 * Calculate overall confidence based on individual signal confidences.
 */
function calculateOverallConfidence(
  signals: ProductTypeSignal[],
  deviceFamily: ScoredValue<string>,
  compatibleDevice: ScoredValue<string>,
  priceRealityCheck: ScoredValue<{ isReasonable: boolean; expectedPriceRange: [number, number] | null; signalDirection: "accessory" | "primary" | null }>,
): number {
  if (signals.length === 0) return 0;

  // Average of all signal confidences weighted by signal weight
  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  if (totalWeight === 0) return 0;

  const weightedConf = signals.reduce((sum, s) => sum + (s.weight * s.confidence), 0) / totalWeight;

  // Adjust based on how well deviceFamily and compatibleDevice were resolved
  let adjustment = 0;
  if (deviceFamily.value) adjustment += 5;
  if (compatibleDevice.value) adjustment += 5;

  // Boost from price reality check if it's reasonable
  if (priceRealityCheck.value?.isReasonable) adjustment += 3;

  return Math.min(100, Math.round(weightedConf + adjustment));
}

/**
 * Main entry point for the Product Understanding Engine.
 * Analyzes a product listing and determines what is actually being sold.
 *
 * 7-step mandatory pipeline (product-first ordering):
 * 1. Identify Primary Product
 * 2. Determine Product Intent
 * 3. Determine Device Family
 * 4. Determine Compatible Device
 * 5. Determine Variant
 * 6. Run Price Reality Check (weighted signal only, NEVER binary)
 * 7. Calculate Confidence
 */
export function analyzeProduct(input: ProductUnderstandingInput): ProductUnderstandingResult {
  const normalizedTitle = normalizeProductTitle(input.title);

  // Step 1: Identify Primary Product — run multi-signal fusion first
  const {
    productType,
    accessoryType,
    sparePartType,
    serviceType,
    signals,
  } = detectProductType(input);

  // Step 2: Determine Product Intent — semantic mapping
  const productIntent: ScoredValue<ProductIntent> = {
    value: determineProductIntent(
      productType.value,
      accessoryType.value,
      sparePartType.value,
      serviceType.value,
    ),
    confidence: productType.confidence,
  };

  // Step 3: Determine Device Family — what the product IS, NOT what it's FOR
  const deviceFamily = determineDeviceFamily(
    productType.value,
    accessoryType,
    sparePartType,
    serviceType,
  );

  // Step 4: Determine Compatible Device (only for accessories and spare parts)
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

  // Step 5: Determine Variant — detect product condition as variant info
  const conditionResult = detectProductCondition(
    input.title,
    productType.value ?? undefined,
    input.sourceId,
    input.marketplaceCategory,
    input.description,
  );

  // Step 6: Run Price Reality Check (weighted signal only, NEVER binary)
  const priceRealityCheck = calculatePriceRealityCheck(
    input.price,
    productType,
    input.brand,
  );

  // Step 7: Calculate Confidence
  const confidence = calculateOverallConfidence(
    signals,
    deviceFamily,
    compatibleDevice,
    priceRealityCheck,
  );

  // Detect seller type and warranty (existing steps)
  const sellerTypeResult = detectSellerType(input.sourceId, input.seller);
  const warrantyResult = detectWarranty(input.title, input.description, input.sourceId);

  // Determine device model for primary products
  const deviceModel = determineDeviceModel(productType.value, normalizedTitle);

  // Determine product category
  const productCategory = {
    value: input.marketplaceCategory ?? null,
    confidence: input.marketplaceCategory ? 100 : 0,
  };

  return {
    productType: { ...productType, confidence },
    accessoryType,
    sparePartType,
    serviceType,
    productIntent,
    deviceFamily,
    deviceModel,
    compatibleDevice,
    compatibleBrand,
    compatibleFamily,
    compatibleModel,
    productCategory,
    condition: { value: conditionResult.value, confidence: conditionResult.confidence },
    sellerType: sellerTypeResult,
    warranty: warrantyResult,
    priceRealityCheck,
    // Store overall confidence on productType's confidence
  };
}
