export { analyzeProduct } from "./engine";
export type { ProductUnderstandingResult, ProductUnderstandingInput } from "./types";
export type {
  ProductType,
  AccessoryType,
  SparePartType,
  ServiceType,
  ProductTypeSignal,
  ScoredValue,
} from "./types";
export { fuseProductTypeSignals, PRODUCT_SIGNAL_WEIGHTS } from "./signal-registry";
export { ACCESSORY_PATTERNS, ACCESSORY_ONLY_BRANDS, ACCESSORY_PRICE_THRESHOLDS } from "./accessory-patterns";
export { SPARE_PART_PATTERNS } from "./spare-part-patterns";
export { extractCompatibleDevice } from "./compatible-device-extractor";
export { detectSellerType } from "./seller-type-detector";
export { detectWarranty } from "./warranty-detector";
export { detectProductCondition } from "./condition-orchestrator";
