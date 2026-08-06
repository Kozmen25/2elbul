import { normalizeProductTitle } from "../normalization";
import { ACCESSORY_PATTERNS } from "../product-understanding/accessory-patterns";
import { SPARE_PART_PATTERNS } from "../product-understanding/spare-part-patterns";
import { extractCompatibleDevice } from "../product-understanding/compatible-device-extractor";
import type { AccessoryType, SparePartType, ServiceType } from "../product-understanding/types";

/**
 * Result of detecting the user's intent from a raw search query.
 */
export type SearchQueryIntent = {
  productType: "primary_product" | "accessory" | "spare_part" | "service" | null;
  accessoryType: AccessoryType | null;
  sparePartType: SparePartType | null;
  serviceType: ServiceType | null;
  deviceFamily: string | null;
  brand: string | null;
  model: string | null;
  isAccessorySearch: boolean;
  hasSpecificModel: boolean;
  rawQuery: string;
};

/**
 * Service keywords — same patterns used by the Product Understanding Engine.
 * Inlined here since the engine's SERVICE_PATTERNS is module-private.
 */
const SERVICE_PATTERNS = [
  /\b(?:tamir|onarim|repair|servis|hizmet|bakim)\b/i,
  /\b(?:teknik\s*servis|yetkili\s*servis)\b/i,
];

/**
 * Detect the user's intent from a raw search query by reusing PUE's
 * accessory/spare-part/service pattern infrastructure.
 *
 * Algorithm:
 * 1. Normalize the query
 * 2. Match against ACCESSORY_PATTERNS → productType = "accessory"
 * 3. Match against SPARE_PART_PATTERNS → productType = "spare_part"
 * 4. Match against SERVICE_PATTERNS → productType = "service"
 * 5. Strip matched terms from the query
 * 6. Run extractCompatibleDevice() on remaining text
 * 7. Return structured intent object
 */
export function detectQueryIntent(query: string): SearchQueryIntent {
  const normalized = normalizeProductTitle(query);
  const normalizedLower = normalized.toLocaleLowerCase("tr-TR");

  // Step 1: Match accessory patterns
  let accessoryType: AccessoryType | null = null;
  const matchedAccessoryTerms: string[] = [];

  for (const entry of ACCESSORY_PATTERNS) {
    for (const pattern of entry.patterns) {
      const match = pattern.exec(normalizedLower);
      if (match) {
        accessoryType = entry.type;
        matchedAccessoryTerms.push(match[0]);
        break;
      }
    }
    if (accessoryType) break;
  }

  // Step 2: Match spare part patterns
  let sparePartType: SparePartType | null = null;
  const matchedSparePartTerms: string[] = [];

  for (const entry of SPARE_PART_PATTERNS) {
    for (const pattern of entry.patterns) {
      const match = pattern.exec(normalizedLower);
      if (match) {
        sparePartType = entry.type;
        matchedSparePartTerms.push(match[0]);
        break;
      }
    }
    if (sparePartType) break;
  }

  // Step 3: Match service patterns
  let serviceType: ServiceType | null = null;
  let matchedService = false;

  for (const p of SERVICE_PATTERNS) {
    if (p.test(normalizedLower)) {
      matchedService = true;
      serviceType = "repair";
      break;
    }
  }

  // Step 4: Determine product type (priority: service > spare_part > accessory > primary_product)
  let productType: SearchQueryIntent["productType"] = null;
  if (matchedService) {
    productType = "service";
  } else if (sparePartType) {
    productType = "spare_part";
  } else if (accessoryType) {
    productType = "accessory";
  }

  // Step 5: Strip matched terms from the query for device extraction
  let stripped = normalizedLower;
  for (const term of [...matchedAccessoryTerms, ...matchedSparePartTerms]) {
    stripped = stripped.replace(term, "");
  }
  stripped = stripped.replace(/\s+/g, " ").trim();

  // Step 6: Extract compatible device from remaining text
  const device = extractCompatibleDevice(stripped || query);

  const hasSpecificModel = device.model !== null && device.family !== null;
  const isAccessorySearch = productType === "accessory";

  // Step 7: Determine device family fallback — if extractCompatibleDevice returned
  // nothing but we know query mentions a known brand/family, try to extract it
  let deviceFamily = device.family;
  let brand = device.brand;
  let model = device.model;

  // Fallback: if no device extracted and query has a known device prefix, detect directly
  if (!deviceFamily) {
    const knownPrefixes = [
      { prefix: "iphone", family: "iphone" },
      { prefix: "galaxy", family: "galaxy" },
      { prefix: "samsung", family: "galaxy" },
      { prefix: "macbook", family: "macbook" },
      { prefix: "ipad", family: "ipad" },
      { prefix: "playstation", family: "playstation" },
      { prefix: "ps5", family: "playstation" },
      { prefix: "ps4", family: "playstation" },
      { prefix: "airpods", family: "airpods" },
      { prefix: "xiaomi", family: "xiaomi" },
      { prefix: "huawei", family: "huawei" },
      { prefix: "oppo", family: "oppo" },
    ];

    for (const kp of knownPrefixes) {
      if (normalizedLower.includes(kp.prefix)) {
        deviceFamily = kp.family;
        brand = kp.prefix;
        break;
      }
    }
  }

  return {
    productType,
    accessoryType,
    sparePartType,
    serviceType,
    deviceFamily,
    brand,
    model,
    isAccessorySearch,
    hasSpecificModel,
    rawQuery: query,
  };
}
