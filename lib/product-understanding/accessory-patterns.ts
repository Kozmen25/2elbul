import { AccessoryPatternEntry } from "./types";

/**
 * Categorized accessory pattern registry.
 * Each entry carries patterns, baseConfidence, priceSignal, expectedCategory.
 * This is NOT a flat keyword list — patterns are grouped by type for
 * structured extraction and false-positive protection.
 *
 * NOTE: All patterns use ASCII equivalents of Turkish characters because
 * normalizeProductTitle() converts Turkish chars (ş→s, ı→i, ç→c, ü→u, ö→o, ğ→g)
 * before pattern matching runs.
 */
export const ACCESSORY_PATTERNS: AccessoryPatternEntry[] = [
  {
    type: "screen_protector",
    patterns: [
      /ekran\s*koruyucu/i,
      /temperli\s*cam/i,
      /screen\s*protector/i,
      /full\s*cover\s*(?:cam|glass)/i,
      /nano\s*film/i,
      /mat\s*ekran/i,
      /priv(?:acy)?\s*(?:cam|film)/i,
      /bubble\s*guard/i,
    ],
    baseConfidence: 90,
    priceSignal: "low",
    expectedCategory: "Aksesuar",
  },
  {
    type: "case",
    patterns: [
      /kilif/i,
      /(?:^|\s)case(?=\s|$)/i,
      /kapak/i,
      /silikon\s*kilif/i,
      /deri\s*kilif/i,
      /seffaf\s*kilif/i,
      /bumper/i,
      /koruyucu\s*kilif/i,
    ],
    baseConfidence: 85,
    priceSignal: "low",
    expectedCategory: "Aksesuar",
  },
  {
    type: "charger",
    patterns: [
      /sarj\s*a(?:leti|ti|t)/i,
      /sarj\s*cihazi/i,
      /\bcharger\b/i,
      /hizli\s*sarj/i,
      /duvar\s*sarj/i,
      /arac\s*sarj/i,
      /sarj\s*istasyonu/i,
    ],
    baseConfidence: 80,
    priceSignal: "medium",
    expectedCategory: "Aksesuar",
    falsePositiveProtection: {
      maxPrice: 3000,
    },
  },
  {
    type: "cable",
    patterns: [
      /\bkablo\b/i,
      /\bcable\b/i,
      /data\s*\bkablo\b/i,
      /usb\s*\bkablo\b/i,
      /sarj\s*kablosu/i,
      /lightning\s*(?:\bkablo\b|kablosu)/i,
      /type[-\s]?c\s*(?:\bkablo\b|kablosu)/i,
      /otg\s*(?:\bkablo\b|kablosu)/i,
    ],
    baseConfidence: 80,
    priceSignal: "low",
    expectedCategory: "Aksesuar",
  },
  {
    type: "adapter",
    patterns: [
      /adapt(?:or|oru|er)/i,
      /donusturucu/i,
      /\bconverter\b/i,
      /priz\s*(?:adapt(?:or|oru))?/i,
      /fis\s*(?:adapt(?:or|oru))?/i,
      /usb\s*(?:adapt(?:or|oru)?)/i,
    ],
    baseConfidence: 75,
    priceSignal: "low",
    expectedCategory: "Aksesuar",
  },
  {
    type: "powerbank",
    patterns: [
      /powerbank/i,
      /power\s*bank/i,
      /tasinabilir\s*sarj/i,
      /portatif\s*sarj/i,
      /batarya\s*destegi/i,
    ],
    baseConfidence: 85,
    priceSignal: "medium",
    expectedCategory: "Aksesuar",
  },
  {
    type: "headphone",
    patterns: [
      /kulaklik/i,
      /\bheadphone\b/i,
      /\bheadset\b/i,
      /\bearbuds?\b/i,
      /bluetooth\s*kulaklik/i,
      /kulak[-\s]?(?:ici|ustu)/i,
    ],
    baseConfidence: 75,
    priceSignal: "medium",
    expectedCategory: "Aksesuar",
    falsePositiveProtection: {
      minPrice: 50,
      maxPrice: 15000,
    },
  },
  {
    type: "hub",
    patterns: [
      /\bhub\b/i,
      /coklayici/i,
      /multiport/i,
      /dock\s*(?:station|ing)?/i,
      /port\s*coklayici/i,
    ],
    baseConfidence: 75,
    priceSignal: "medium",
    expectedCategory: "Aksesuar",
  },
  {
    type: "holder",
    patterns: [
      /tutucu/i,
      /\bholder\b/i,
      /\bmount\b/i,
      /arac\s*tutucu/i,
      /telefon\s*tutucu/i,
      /tablet\s*tutucu/i,
    ],
    baseConfidence: 75,
    priceSignal: "low",
    expectedCategory: "Aksesuar",
    falsePositiveProtection: {
      maxPrice: 2000,
    },
  },
  {
    type: "lens",
    patterns: [
      /\blens\b/i,
      /mercek/i,
      /genis\s*aci\s*(?:lens)?/i,
      /telephoto/i,
      /macro\s*lens/i,
      /wide\s*angle/i,
    ],
    baseConfidence: 75,
    priceSignal: "medium",
    expectedCategory: "Aksesuar",
    falsePositiveProtection: {
      maxPrice: 15000,
    },
  },
  {
    type: "battery",
    patterns: [
      /harici\s*batarya/i,
      /external\s*battery/i,
      /kamera\s*batarya/i,
      /battery\s*pack/i,
      /sarj\s*edilebilir\s*batarya/i,
      /rezerv\s*batarya/i,
    ],
    baseConfidence: 70,
    priceSignal: "medium",
    expectedCategory: "Aksesuar",
  },
  {
    type: "keyboard",
    patterns: [
      /klavye/i,
      /\bkeyboard\b/i,
    ],
    baseConfidence: 80,
    priceSignal: "medium",
    expectedCategory: "Aksesuar",
    falsePositiveProtection: {
      maxPrice: 5000,
    },
  },
  {
    type: "mouse",
    patterns: [
      /\bfare\b/i,
      /\bmouse\b/i,
    ],
    baseConfidence: 80,
    priceSignal: "medium",
    expectedCategory: "Aksesuar",
    falsePositiveProtection: {
      maxPrice: 3000,
    },
  },
  {
    type: "watch",
    patterns: [
      /akilli\s*saat/i,
      /\bwatch\b/i,
      /smartwatch/i,
      /kol\s*saati/i,
      /bileklik/i,
    ],
    baseConfidence: 75,
    priceSignal: "medium",
    expectedCategory: "Aksesuar",
    falsePositiveProtection: {
      maxPrice: 20000,
    },
  },
  {
    type: "airpods",
    patterns: [
      /airpod/i,
      /airpods/i,
      /air\s*pods/i,
    ],
    baseConfidence: 80,
    priceSignal: "medium",
    expectedCategory: "Aksesuar",
    falsePositiveProtection: {
      maxPrice: 8000,
    },
  },
  {
    type: "tripod",
    patterns: [
      /\btripod\b/i,
      /\btripot\b/i,
    ],
    baseConfidence: 80,
    priceSignal: "medium",
    expectedCategory: "Aksesuar",
    falsePositiveProtection: {
      maxPrice: 3000,
    },
  },
  {
    type: "selfie_stick",
    patterns: [
      /selfie\s*(?:stick|cubugu|cubuk)/i,
      /selfi\s*(?:stick|cubugu|cubuk)/i,
    ],
    baseConfidence: 85,
    priceSignal: "low",
    expectedCategory: "Aksesuar",
  },
  {
    type: "stand",
    patterns: [
      /telefon\s*(?:sehpa|stand|ayagi)/i,
      /tablet\s*(?:sehpa|stand|ayagi)/i,
      /monitor\s*stand/i,
      /laptop\s*stand/i,
      /telefon\s*sehpa/i,
    ],
    baseConfidence: 70,
    priceSignal: "low",
    expectedCategory: "Aksesuar",
    falsePositiveProtection: {
      maxPrice: 2000,
    },
  },
  {
    type: "filter",
    patterns: [
      /kamera\s*filtre/i,
      /lens\s*filter/i,
      /uv\s*filtre/i,
      /nd\s*filtre/i,
      /polarize\s*filtre/i,
    ],
    baseConfidence: 75,
    priceSignal: "low",
    expectedCategory: "Aksesuar",
    falsePositiveProtection: {
      maxPrice: 2000,
    },
  },
  {
    type: "cleaner",
    patterns: [
      /temizleyici/i,
      /temizleme\s*(?:seti|kiti|spreyi)/i,
      /ekran\s*temizleyici/i,
      /\bcleaner\b/i,
      /cleaning\s*kit/i,
    ],
    baseConfidence: 75,
    priceSignal: "low",
    expectedCategory: "Aksesuar",
    falsePositiveProtection: {
      maxPrice: 1000,
    },
  },
];

/**
 * Brands that ONLY produce accessories.
 * If the detected brand is in this set, the product is almost certainly
 * an accessory, not a primary device.
 */
export const ACCESSORY_ONLY_BRANDS = new Set([
  "omix",
  "anker",
  "logitech",
  "jbl",
  "spigen",
  "capdase",
  "nillkin",
  "belkin",
  "tech21",
  "nato",
  "griffin",
  "mophie",
  "sylver",
  "lune",
  "avia",
  "urban",
  "pixel",
  "miom",
  "lifeproof",
  "otterbox",
  "rhinoshield",
  "torras",
  "esr",
  "baseus",
  "ugreen",
]);

/**
 * Price thresholds for price-based signal checks.
 * If a product's price is well below typical device price for its brand+model,
 * it's likely an accessory.
 */
export const ACCESSORY_PRICE_THRESHOLDS: Record<string, number> = {
  default: 500,  // Below 500 TL → likely accessory
  iphone: 2000,  // Below 2000 TL for iPhone → likely accessory
  samsung: 1000, // Below 1000 TL for Samsung → likely accessory
};

/**
 * All terms that should be stripped from titles when extracting
 * the compatible device name. Auto-generated from ACCESSORY_PATTERNS.
 * This powers the strip-and-extract algorithm.
 *
 * Returns ASCII-only terms (Turkish chars converted) matching the
 * output of normalizeProductTitle with normalizeUnicode: true.
 */
export function getAllAccessoryRemoveTerms(): string[] {
  const rawTerms = [
    "ekran koruyucu", "temperli cam", "kilif", "kapak", "silikon",
    "sarj aleti", "sarj", "kablo", "adaptor", "donusturucu",
    "powerbank", "kulaklik", "hub", "coklayici", "bumper",
    "koruyucu", "tasinabilir sarj", "portatif sarj", "usb",
    "lightning", "type c", "otg", "priz", "fis", "multiport",
    "dock", "bluetooth kulaklik", "headphone", "headset",
    "tutucu", "holder", "mount", "mercek", "lens",
    "harici batarya", "external battery", "klavye", "keyboard",
    "fare", "mouse", "akilli saat", "watch", "smartwatch",
    "kol saati", "bileklik", "airpods", "air pods",
    "tripod", "tripot", "selfie stick", "selfi stick",
    "sehpa", "stand", "kamera filtre", "lens filter",
    "uv filtre", "nd filtre", "temizleyici", "temizleme seti",
    "temizleme spreyi", "ekran temizleyici", "cleaner",
  ];
  return [...new Set(rawTerms)];
}
