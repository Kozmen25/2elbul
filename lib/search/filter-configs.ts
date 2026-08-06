import type { SearchQueryIntent } from "./query-intent-detector";
import type { AttributeType } from "../taxonomy/types";

/**
 * Configuration for a single adaptive filter control.
 *
 * `attributeType` maps to the taxonomy `AttributeType` for type safety.
 * `label` is the human-readable Turkish label shown in the UI.
 * `values` (optional) provides known values for a dropdown/checkbox UI.
 * `unit` adds a unit suffix (e.g. "GB", "inç") where applicable.
 */
export type FilterConfig = {
  attributeType: AttributeType;
  label: string;
  values?: string[];
  unit?: string;
  placeholder?: string;
};

// ─── Device-family-specific filter configurations ─────────────────────────

const PHONE_FILTERS: FilterConfig[] = [
  { attributeType: "storage", label: "Depolama", values: ["64GB", "128GB", "256GB", "512GB", "1TB"] },
  { attributeType: "ram", label: "RAM", values: ["4GB", "6GB", "8GB", "12GB", "16GB"] },
  { attributeType: "color", label: "Renk" },
  { attributeType: "network", label: "Ağ Teknolojisi", values: ["4G", "5G", "LTE"] },
  { attributeType: "condition", label: "Durum", values: ["Yeni", "Sıfır", "Çok İyi", "İyi", "Orta"] },
];

const LAPTOP_FILTERS: FilterConfig[] = [
  { attributeType: "storage", label: "Depolama", values: ["256GB", "512GB", "1TB", "2TB"] },
  { attributeType: "ram", label: "RAM", values: ["8GB", "16GB", "32GB", "64GB"] },
  { attributeType: "processor", label: "İşlemci" },
  { attributeType: "os", label: "İşletim Sistemi", values: ["Windows", "macOS"] },
  { attributeType: "screen-size", label: "Ekran Boyutu", values: ['13"', '14"', '15"', '16"', '17"'] },
];

const TABLET_FILTERS: FilterConfig[] = [
  { attributeType: "storage", label: "Depolama", values: ["64GB", "128GB", "256GB", "512GB", "1TB"] },
  { attributeType: "color", label: "Renk" },
  { attributeType: "network", label: "Ağ Teknolojisi", values: ["WiFi", "4G", "5G"] },
  { attributeType: "screen-size", label: "Ekran Boyutu", values: ['8"', '9"', '10"', '11"', '12"', '13"'] },
];

const CONSOLE_FILTERS: FilterConfig[] = [
  { attributeType: "storage", label: "Depolama", values: ["128GB", "256GB", "512GB", "1TB", "2TB"] },
  { attributeType: "condition", label: "Durum", values: ["Yeni", "Sıfır", "Çok İyi", "İyi"] },
];

// ─── Accessory-type-specific filter configurations ────────────────────────

const SCREEN_PROTECTOR_FILTERS: FilterConfig[] = [
  { attributeType: "material", label: "Malzeme", values: ["Cam", "Plastik", "Film"] },
  { attributeType: "size", label: "Boyut" },
];

const CHARGER_FILTERS: FilterConfig[] = [
  { attributeType: "battery", label: "Güç", values: ["20W", "30W", "45W", "65W", "100W", "120W"] },
  { attributeType: "material", label: "Malzeme", values: ["Plastik", "Metal"] },
];

const CASE_FILTERS: FilterConfig[] = [
  { attributeType: "material", label: "Malzeme", values: ["Silikon", "Plastik", "Deri", "Metal"] },
  { attributeType: "color", label: "Renk" },
  { attributeType: "size", label: "Boyut" },
];

const CABLE_FILTERS: FilterConfig[] = [
  { attributeType: "material", label: "Malzeme" },
  { attributeType: "size", label: "Uzunluk", values: ["0.5m", "1m", "2m", "3m"] },
];

const HEADPHONE_FILTERS: FilterConfig[] = [
  { attributeType: "color", label: "Renk" },
];

const POWERBANK_FILTERS: FilterConfig[] = [
  { attributeType: "battery", label: "Kapasite", values: ["5000mAh", "10000mAh", "20000mAh", "30000mAh"] },
  { attributeType: "material", label: "Malzeme" },
];

// ─── Fallback configurations ──────────────────────────────────────────────

const GENERAL_FILTERS: FilterConfig[] = [
  { attributeType: "condition", label: "Durum", values: ["Yeni", "Sıfır", "Çok İyi", "İyi", "Orta"] },
];

const ACCESSORY_FALLBACK_FILTERS: FilterConfig[] = [
  { attributeType: "material", label: "Malzeme" },
  { attributeType: "condition", label: "Durum", values: ["Yeni", "Sıfır", "Çok İyi", "İyi"] },
];

const SPARE_PART_FILTERS: FilterConfig[] = [
  { attributeType: "condition", label: "Durum", values: ["Yeni", "Orijinal", "Çıkma", "Yan Sanayi"] },
  { attributeType: "warranty", label: "Garanti" },
];

const SERVICE_FILTERS: FilterConfig[] = [
  { attributeType: "condition", label: "Hizmet Türü" },
];

// ─── Lookup tables ────────────────────────────────────────────────────────

type DeviceFamilyMap = Record<string, FilterConfig[]>;
const DEVICE_FAMILY_FILTERS: DeviceFamilyMap = {
  iphone: PHONE_FILTERS,
  galaxy: PHONE_FILTERS,
  samsung: PHONE_FILTERS,
  xiaomi: PHONE_FILTERS,
  huawei: PHONE_FILTERS,
  oppo: PHONE_FILTERS,
  macbook: LAPTOP_FILTERS,
  ipad: TABLET_FILTERS,
  playstation: CONSOLE_FILTERS,
};

type AccessoryFilterMap = Partial<Record<string, FilterConfig[]>>;
const ACCESSORY_FILTERS: AccessoryFilterMap = {
  screen_protector: SCREEN_PROTECTOR_FILTERS,
  charger: CHARGER_FILTERS,
  case: CASE_FILTERS,
  cable: CABLE_FILTERS,
  headphone: HEADPHONE_FILTERS,
  powerbank: POWERBANK_FILTERS,
  holder: GENERAL_FILTERS,
  adapter: CABLE_FILTERS,
  lens: GENERAL_FILTERS,
  battery: POWERBANK_FILTERS,
  hub: GENERAL_FILTERS,
  keyboard: GENERAL_FILTERS,
  mouse: GENERAL_FILTERS,
  watch: GENERAL_FILTERS,
  airpods: GENERAL_FILTERS,
  tripod: GENERAL_FILTERS,
  selfie_stick: GENERAL_FILTERS,
  stand: GENERAL_FILTERS,
  filter: GENERAL_FILTERS,
  cleaner: GENERAL_FILTERS,
};

/**
 * Return context-aware filter configurations based on the user's search query intent.
 *
 * The returned `FilterConfig[]` drives the adaptive filter UI, showing the most
 * relevant product-specific filters for each search context:
 * - Phone queries → Storage, RAM, Color, Network, Condition
 * - Laptop queries → Storage, RAM, Processor, OS, Screen Size
 * - Screen protector queries → Material, Size
 * - Charger queries → Power, Material
 * - General queries → Condition only
 *
 * Returns an empty array only when the query intent is completely unresolvable
 * (should not happen in practice — the fallback returns GENERAL_FILTERS).
 */
export function getFilterConfigForQuery(queryIntent: SearchQueryIntent): FilterConfig[] {
  // 1. Accessory search with a recognised accessory type
  if (queryIntent.productType === "accessory" && queryIntent.accessoryType) {
    const configs = ACCESSORY_FILTERS[queryIntent.accessoryType];
    if (configs) return configs;
    return ACCESSORY_FALLBACK_FILTERS;
  }

  // 2. Spare part search
  if (queryIntent.productType === "spare_part") {
    return SPARE_PART_FILTERS;
  }

  // 3. Service search
  if (queryIntent.productType === "service") {
    return SERVICE_FILTERS;
  }

  // 4. Primary product search — match by device family
  if (queryIntent.deviceFamily) {
    const family = queryIntent.deviceFamily.toLowerCase();
    const configs = DEVICE_FAMILY_FILTERS[family];
    if (configs) return configs;
  }

  // 5. Fallback: general filters
  return GENERAL_FILTERS;
}
