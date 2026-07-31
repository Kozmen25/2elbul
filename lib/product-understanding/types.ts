export type ProductType = "primary_product" | "accessory" | "spare_part" | "service";

export type AccessoryType =
  | "screen_protector"
  | "case"
  | "charger"
  | "cable"
  | "powerbank"
  | "adapter"
  | "holder"
  | "lens"
  | "battery"
  | "hub"
  | "keyboard"
  | "mouse"
  | "headphone"
  | "watch"
  | "airpods"
  | "tripod"
  | "selfie_stick"
  | "stand"
  | "filter"
  | "cleaner";

export type SparePartType =
  | "battery"
  | "screen"
  | "charging_port"
  | "camera_module"
  | "speaker"
  | "button"
  | "connector_flex";

export type ServiceType =
  | "repair"
  | "maintenance"
  | "installation"
  | "diagnostic";

export interface ScoredValue<T> {
  value: T | null;
  confidence: number;
}

export interface ProductUnderstandingResult {
  productType: ScoredValue<ProductType>;
  accessoryType: ScoredValue<AccessoryType>;
  sparePartType: ScoredValue<SparePartType>;
  serviceType: ScoredValue<ServiceType>;
  compatibleDevice: ScoredValue<string>;
  compatibleBrand: ScoredValue<string>;
  compatibleFamily: ScoredValue<string>;
  compatibleModel: ScoredValue<string>;
  productCategory: ScoredValue<string>;
  condition: ScoredValue<string>;
  sellerType: ScoredValue<"Bireysel" | "Profesyonel">;
  warranty: ScoredValue<boolean>;
}

export interface ProductUnderstandingInput {
  title: string;
  description?: string;
  price?: number;
  sourceId?: string;
  marketplaceCategory?: string;
  brand?: string;
  seller?: string;
  conditionText?: string;
}

export interface ProductTypeSignal {
  signal:
    | "patternMatch"
    | "priceSignal"
    | "categorySignal"
    | "sourceSignal"
    | "titleStructure"
    | "sellerSignal"
    | "descriptionSignal"
    | "compatibleDeviceSignal";
  value: ProductType;
  weight: number;
  confidence: number;
}

export interface AccessoryPatternEntry {
  type: AccessoryType;
  patterns: RegExp[];
  baseConfidence: number;
  priceSignal: "low" | "medium" | "high";
  expectedCategory: string | null;
  falsePositiveProtection?: {
    requireBrandMatch?: boolean;
    minPrice?: number;
    maxPrice?: number;
  };
}

export interface SparePartPatternEntry {
  type: SparePartType;
  patterns: RegExp[];
  baseConfidence: number;
  expectedCategory: string | null;
}
