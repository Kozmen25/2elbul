import type { ICategoryResolver } from "@/lib/taxonomy/integration";
import type { ListingCondition } from "@/lib/listings";
import { CATEGORY_LABELS } from "@/lib/taxonomy/product-type-mapping";
export interface NormalizationOptions {
  lowercase?: boolean;
  trim?: boolean;
  removeEmoji?: boolean;
  removeHtmlEntities?: boolean;
  collapseWhitespace?: boolean;
  removePunctuation?: boolean;
  normalizeUnicode?: boolean;
  normalizeStorage?: boolean;
  normalizeSpacing?: boolean;
}

const DEFAULT_OPTIONS: NormalizationOptions = {
  lowercase: true,
  trim: true,
  removeEmoji: true,
  removeHtmlEntities: true,
  collapseWhitespace: true,
  removePunctuation: false,
  normalizeUnicode: true,
  normalizeStorage: true,
  normalizeSpacing: true,
};

const EMOJI_PATTERN = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff])/g;

const HTML_ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

const TURKISH_DIACRITICS: Record<string, string> = {
  'İ': 'i',
  'ı': 'i',
  'Ş': 's',
  'ş': 's',
  'Ğ': 'g',
  'ğ': 'g',
  'Ü': 'u',
  'ü': 'u',
  'Ö': 'o',
  'ö': 'o',
  'Ç': 'c',
  'ç': 'c',
};

const STORAGE_PATTERNS = [
  { pattern: /(\d+)\s*-?\s*gb/gi, suffix: 'gb' },
  { pattern: /(\d+)\s*-?\s*tb/gi, suffix: 'tb' },
  { pattern: /(\d+)\s*_\s*gb/gi, suffix: 'gb' },
  { pattern: /(\d+)\s*_\s*tb/gi, suffix: 'tb' },
];

const MODEL_VARIANTS: Record<string, string> = {
  'pro max': 'pro max',
  'promax': 'pro max',
  'pro-max': 'pro max',
  'pro_max': 'pro max',
  'galaxy ultra': 'ultra',
  'galaxyultra': 'ultra',
  'galaxy-ultra': 'ultra',
};

function removeEmoji(text: string): string {
  return text.replace(EMOJI_PATTERN, '');
}

function removeHtmlEntities(text: string): string {
  let result = text;
  Object.entries(HTML_ENTITIES).forEach(([entity, replacement]) => {
    result = result.replace(new RegExp(entity, 'g'), replacement);
  });
  return result;
}

function normalizeUnicode(text: string): string {
  let result = text;
  Object.entries(TURKISH_DIACRITICS).forEach(([from, to]) => {
    result = result.replace(new RegExp(from, 'g'), to);
  });
  return result;
}

function normalizeStorageSize(text: string): string {
  let result = text;
  STORAGE_PATTERNS.forEach(({ pattern, suffix }) => {
    result = result.replace(pattern, (match, number) => {
      return `${number}${suffix}`;
    });
  });
  return result;
}

function normalizeModelVariants(text: string): string {
  let result = text;
  result = result.replace(/\bapple\s+(?=iphone)\b/gi, "");
  result = result.replace(/\bgalaxy\s+(?=s\d|a\d|z\s*fold|z\s*flip)\b/gi, "samsung galaxy ");
  result = result.replace(/(\w)\+/g, "$1 plus");
  Object.entries(MODEL_VARIANTS).forEach(([pattern, replacement]) => {
    result = result.replace(
      new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
      replacement
    );
  });
  return result;
}

function normalizeSpacing(text: string): string {
  let result = text;
  result = result.replace(/\s+/g, ' ');
  result = result.replace(/\s+-\s+/g, '-');
  result = result.replace(/\s+_\s+/g, '_');
  return result;
}

function collapsWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ');
}

function trimText(text: string): string {
  return text.trim();
}

function lowercaseText(text: string): string {
  return text.toLowerCase();
}

export function normalizeProductTitle(
  input: string,
  options: Partial<NormalizationOptions> = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let result = input || '';

  if (!result) return '';

  if (opts.removeEmoji) result = removeEmoji(result);
  if (opts.removeHtmlEntities) result = removeHtmlEntities(result);
  if (opts.normalizeUnicode) result = normalizeUnicode(result);
  if (opts.normalizeStorage) result = normalizeStorageSize(result);
  if (opts.normalizeSpacing) {
    result = normalizeModelVariants(result);
    result = normalizeSpacing(result);
  }
  if (opts.collapseWhitespace) result = collapsWhitespace(result);
  if (opts.trim) result = trimText(result);
  if (opts.lowercase) result = lowercaseText(result);

  return result;
}

export function normalizeSearchText(input: string): string {
  return normalizeProductTitle(input, {
    lowercase: true,
    trim: true,
    removeEmoji: true,
    removeHtmlEntities: true,
    collapseWhitespace: true,
    normalizeUnicode: true,
    normalizeStorage: true,
    normalizeSpacing: true,
  });
}

export function normalizeCategoryText(input: string): string {
  return normalizeProductTitle(input, {
    lowercase: true,
    trim: true,
    removeEmoji: true,
    removeHtmlEntities: false,
    collapseWhitespace: true,
    normalizeUnicode: true,
    normalizeStorage: false,
    normalizeSpacing: true,
  });
}

export function normalizeListingTitle(input: string): string {
  return normalizeProductTitle(input);
}

export function normalizeQuery(input: string): string {
  return normalizeSearchText(input);
}

export function normalizeSlug(input: string): string {
  let result = normalizeProductTitle(input, {
    lowercase: true,
    trim: true,
    removeEmoji: true,
    removeHtmlEntities: true,
    collapseWhitespace: true,
    normalizeUnicode: true,
    normalizeStorage: false,
    normalizeSpacing: true,
  });

  result = result.replace(/[^\w\s-]/g, '');
  result = result.replace(/\s+/g, '-');
  result = result.replace(/-+/g, '-');
  result = result.replace(/^-+|-+$/g, '');

  return result;
}

export function normalizeKeyword(input: string): string {
  const normalized = normalizeSearchText(input);
  return normalized.split(/\s+/).filter(Boolean).join(' ');
}

export function extractStorageSize(input: string): string | null {
  const normalized = normalizeStorageSize(input.toLowerCase());
  const match = normalized.match(/(\d+(?:gb|tb))/);
  return match ? match[1] : null;
}

export function isBareIphoneModel(input: string): boolean {
  const normalized = normalizeProductTitle(input);
  return /\b1[1-6]\s*(pro\s*max|pro|plus|mini)\b/.test(normalized);
}

export function isBareSamsungModel(input: string): boolean {
  const normalized = normalizeProductTitle(input);
  return /\b(?:s|a|m)\d{2}\s*(?:ultra|plus|fe)?\b/.test(normalized);
}

const BRAND_RULES: Array<{ brand: string; matches: (normalized: string) => boolean }> = [
  {
    brand: 'apple',
    matches: (normalized) =>
      normalized.includes('apple') ||
      normalized.includes('iphone') ||
      normalized.includes('ipad') ||
      normalized.includes('macbook') ||
      normalized.includes('airpods') ||
      normalized.includes('apple watch') ||
      isBareIphoneModel(normalized),
  },
  {
    brand: 'samsung',
    matches: (normalized) =>
      normalized.includes('samsung') ||
      normalized.includes('galaxy') ||
      isBareSamsungModel(normalized),
  },
  {
    brand: 'google',
    matches: (normalized) => normalized.includes('google'),
  },
  {
    brand: 'xiaomi',
    matches: (normalized) =>
      normalized.includes('xiaomi') ||
      normalized.includes('redmi') ||
      normalized.includes('poco'),
  },
  {
    brand: 'huawei',
    matches: (normalized) => normalized.includes('huawei'),
  },
  {
    brand: 'realme',
    matches: (normalized) => normalized.includes('realme'),
  },
  {
    brand: 'oneplus',
    matches: (normalized) => normalized.includes('oneplus'),
  },
  {
    brand: 'oppo',
    matches: (normalized) => normalized.includes('oppo'),
  },
  {
    brand: 'vivo',
    matches: (normalized) => normalized.includes('vivo'),
  },
  {
    brand: 'motorola',
    matches: (normalized) => normalized.includes('motorola'),
  },
  {
    brand: 'nokia',
    matches: (normalized) => normalized.includes('nokia'),
  },
  {
    brand: 'sony',
    matches: (normalized) =>
      normalized.includes('sony') ||
      normalized.includes('playstation') ||
      normalized.includes('ps5') ||
      normalized.includes('ps4') ||
      normalized.includes('xperia'),
  },
  {
    brand: 'nvidia',
    matches: (normalized) =>
      normalized.includes('nvidia') ||
      normalized.includes('rtx') ||
      normalized.includes('geforce'),
  },
  {
    brand: 'lg',
    matches: (normalized) => /\blg\b/.test(normalized),
  },
  {
    brand: 'lenovo',
    matches: (normalized) => normalized.includes('lenovo'),
  },
  {
    brand: 'hp',
    matches: (normalized) => /\bhp\b/.test(normalized),
  },
  {
    brand: 'dell',
    matches: (normalized) => normalized.includes('dell'),
  },
  {
    brand: 'asus',
    matches: (normalized) => normalized.includes('asus'),
  },
  {
    brand: 'razer',
    matches: (normalized) => normalized.includes('razer'),
  },
  {
    brand: 'blackberry',
    matches: (normalized) => normalized.includes('blackberry'),
  },
  {
    brand: 'htc',
    matches: (normalized) => normalized.includes('htc'),
  },
  {
    brand: 'honor',
    matches: (normalized) => normalized.includes('honor'),
  },
  {
    brand: 'msi',
    matches: (normalized) => normalized.includes('msi') || normalized.includes('msı'),
  },
  {
    brand: 'nothing',
    matches: (normalized) => normalized.includes('nothing'),
  },
  {
    brand: 'omix',
    matches: (normalized) => normalized.includes('omix'),
  },
];

export function extractBrand(input: string): string | null {
  const normalized = normalizeProductTitle(input);
  for (const rule of BRAND_RULES) {
    if (rule.matches(normalized)) {
      return rule.brand;
    }
  }

  return null;
}

export function formatBrandDisplayName(brand: string | null): string | null {
  if (!brand) return null;

  const specialCases: Record<string, string> = {
    hp: "HP",
    lg: "LG",
    nvidia: "NVIDIA",
    msi: "MSI",
    oneplus: "OnePlus",
  };

  return (
    specialCases[brand] ??
    brand.charAt(0).toLocaleUpperCase("en-US") + brand.slice(1)
  );
}

export function getTokens(input: string): string[] {
  const normalized = normalizeSearchText(input);
  return normalized.split(/\s+/).filter(Boolean);
}

export function createSearchFingerprint(input: string): string {
  const tokens = getTokens(input);
  const uniqueTokens = Array.from(new Set(tokens));
  return uniqueTokens.sort().join('|');
}

export function isSimilarAfterNormalization(
  text1: string,
  text2: string,
  threshold: number = 0.8
): boolean {
  const norm1 = normalizeSearchText(text1);
  const norm2 = normalizeSearchText(text2);

  if (norm1 === norm2) return true;

  const tokens1 = new Set(getTokens(norm1));
  const tokens2 = new Set(getTokens(norm2));

  const intersection = new Set([...tokens1].filter((x) => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);

  if (union.size === 0) return false;

  const similarity = intersection.size / union.size;
  return similarity >= threshold;
}

export type ProductSignals = {
  brand: string | null;
  model: string | null;
  storage: string | null;
  ram: string | null;
  color: string | null;
  category: string | null;
  normalizedKey: string;
};

const storageValues = ["64", "128", "256", "512", "1024", "1"];
const colors = [
  "siyah",
  "beyaz",
  "mavi",
  "kirmizi",
  "yesil",
  "mor",
  "pembe",
  "gri",
  "gumus",
  "altin",
  "gold",
  "black",
  "white",
  "blue",
  "red",
  "green",
  "purple",
  "pink",
  "gray",
  "grey",
  "silver",
];

function compactModelSuffix(value: string | undefined) {
  return value?.trim().replace(/\s+/g, "-") ?? "";
}

function normalizeCapacity(value: string) {
  const normalized = value.toLocaleLowerCase("en-US").replace(/\s+/g, "");
  return normalized === "1024gb" ? "1tb" : normalized;
}

export function extractProductSignals(
  title: string,
  resolver?: ICategoryResolver,
): ProductSignals {
  const normalized = normalizeProductTitle(title);
  const tokens = normalized.split(" ").filter(Boolean);
  const brand = extractBrand(normalized);
  const model = detectModel(normalized, tokens, brand);
  const storage = detectStorage(normalized, tokens);
  const ram = detectRam(normalized);
  const color = detectColor(tokens);
  const category = resolver
    ? resolver.resolveSync(title).categoryLabel
    : detectCategory(normalized, brand);
  const keyParts = [category, brand, model, storage, ram && category !== CATEGORY_LABELS.PHONE ? ram : null].filter(Boolean);
  const normalizedKey = keyParts.length
    ? keyParts.join("-").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    : normalized.replace(/\s+/g, "-");

  return {
    brand,
    model,
    storage,
    ram,
    color,
    category,
    normalizedKey,
  };
}

export function generateProductKey(title: string) {
  return extractProductSignals(title).normalizedKey;
}

const CONDITION_WORDS = new Set([
  "yenilenmis",
  "ikinci",
  "el",
  "sifir",
  "refurbished",
]);

export function detectModel(
  normalized: string,
  tokens: string[],
  brand: string | null,
) {
  const iphone = normalized.match(
    /\b(?:iphone\s*)?(1[1-6])\s*(pro\s*max|pro|plus|mini)?\b/,
  );
  if ((brand === "apple" || isBareIphoneModel(normalized)) && iphone) {
    return ["iphone", iphone[1], compactModelSuffix(iphone[2])]
      .filter(Boolean)
      .join("-");
  }

  const samsung = normalized.match(
    /\b(?:samsung\s*)?(?:galaxy\s*)?((?:s|a|m)\d{2}(?:\s*ultra|\s*plus|\s*fe)?|z\s*(?:fold|flip)\s*\d?)\b/,
  );
  if (
    (brand === "samsung" ||
      normalized.includes("galaxy") ||
      isBareSamsungModel(normalized)) &&
    samsung
  ) {
    return `galaxy-${samsung[1].replace(/\s+/g, "-")}`;
  }

  const ipad = normalized.match(/\bipad\s*(\d+|air|pro|mini)?(\.?\s*nesil)?\b/);
  if (ipad) {
    return ["ipad", ipad[1], ipad[2] && "nesil"]
      .filter(Boolean)
      .join("-");
  }

  const macbook = normalized.match(/\bmacbook\s*(air|pro)?\s*(m\d)?\b/);
  if (macbook) return ["macbook", macbook[1], macbook[2]].filter(Boolean).join("-");

  // Fallback: brand-aware slice when brand is known
  if (brand) {
    const brandVariants: Record<string, string[]> = { msi: ["msi"] };
    const variants = brandVariants[brand] || [brand];
    const brandIdx = tokens.findIndex((t) => variants.includes(t));
    if (brandIdx >= 0) {
      const afterBrand = tokens.slice(brandIdx + 1);
      const filtered = afterBrand.filter(
        (t) => !/^\d+(?:gb|tb)$/i.test(t) && t !== "ram" && !CONDITION_WORDS.has(t),
      );
      return filtered.slice(0, 4).join("-");
    }
  }
  return tokens.filter((t) => !CONDITION_WORDS.has(t)).slice(0, 4).join("-");
}

function detectStorage(normalized: string, tokens: string[]) {
  const storageRegex = /\b(\d{2,4}gb|\d+tb)\b/;

  // First look after "ram" keyword — RAM-before-storage pattern
  const ramIdx = normalized.search(/\bram\b/);
  if (ramIdx >= 0) {
    const afterRam = normalized.slice(ramIdx + 3);
    const afterRamMatch = afterRam.match(storageRegex);
    if (afterRamMatch) return normalizeCapacity(afterRamMatch[1]);
  }

  // Then try any match
  const explicit = normalized.match(storageRegex);
  if (explicit) return normalizeCapacity(explicit[1]);

  const bare = tokens.find((token) => storageValues.includes(token));
  return bare ? normalizeCapacity(`${bare}${bare === "1" ? "tb" : "gb"}`) : null;
}

function detectRam(normalized: string) {
  const match = normalized.match(/\b(\d{1,3})\s*(?:gb)?\s*ram\b/);
  return match ? `${match[1]}gb` : null;
}

function detectColor(tokens: string[]) {
  return tokens.find((token) => colors.includes(token)) ?? null;
}

function detectCategory(normalized: string, brand: string | null) {
  // Service check FIRST — highest priority
  const serviceKeywords = [
    "tamir", "onarim", "servis", "degisim", "yenileme",
    "bakim", "kurtarma", "sifirlama", "format",
    "ekran degisimi", "batarya degisimi", "sarj soketi degisimi",
    "hoparlor degisimi", "ana kart tamir", "kamera tamir",
    "ekran yenileme", "batarya yenileme",
  ];
  if (serviceKeywords.some((kw) => normalized.includes(kw))) {
    return CATEGORY_LABELS.SERVICE;
  }

  // GPU/Graphics Card ("ekran kartı") — NOT a spare part, must be checked before sparePartKeywords
  if (/ekran kart[ıi]/.test(normalized)) {
    return "Ekran Kartı";
  }

  // Spare part check — before accessory (battery is a spare part, not accessory)
  const sparePartKeywords = [
    "ekran", "batarya", "sarj soketi", "kamera modulu",
    "hoparlor", "ana kart", "ekran paneli", "dokunmatik",
    "kuvartz", "vibrator motoru", "yan tus", "home tus",
    "ariza", "arizali", "kirik", "cizik",
  ];
  if (sparePartKeywords.some((kw) => normalized.includes(kw))) {
    return CATEGORY_LABELS.SPARE_PART;
  }

  // Accessory check — catches "iphone 15 kilif" before it matches Telefon
  const accessoryKeywords = [
    "kilif", "sarj", "kablo", "powerbank", "ekran koruyucu",
    "adaptr", "tutucu", "kizak", "lens", "hub",
    "mause", "mouse", "klavye", "kulaklik", "saat",
    "airpods", "şarj aleti", "sarj aleti",
    "usb", "hdmi", "donusturucu", "aksesuar",
    "kep", "selfie", "monopod", "tripod", "cephe",
    "cam koruyucu", "koruyucu cam", "cam film", "ekran filmi",
    "temperli cam", "koruyucu film", "ekran koruma",
  ];
  if (accessoryKeywords.some((kw) => normalized.includes(kw))) {
    return CATEGORY_LABELS.ACCESSORY;
  }
  // Galaxy Buds / Buds+ / Buds2 / Buds Pro
  if (normalized.includes("buds")) return CATEGORY_LABELS.ACCESSORY;
  // Accessory brands — purely accessory makers, not phone brands
  const accessoryBrands = ["omix", "anker", "logitech", "jbl"];
  if (brand && accessoryBrands.includes(brand)) return CATEGORY_LABELS.ACCESSORY;

  // Device detection follows
  if (
    brand === "apple" &&
    (normalized.includes("iphone") || isBareIphoneModel(normalized))
  ) {
    return CATEGORY_LABELS.PHONE;
  }
  // Tablet check BEFORE Samsung galaxy check (prevents Tab misclassification)
  if (
    normalized.includes("tab") ||
    normalized.includes("ipad") ||
    normalized.includes("tablet")
  ) {
    return CATEGORY_LABELS.TABLET;
  }
  if (brand === "samsung" && /\b(galaxy|s\d{2}|a\d{2})\b/.test(normalized)) {
    return CATEGORY_LABELS.PHONE;
  }
  if (normalized.includes("macbook") || normalized.includes("laptop")) {
    return CATEGORY_LABELS.LAPTOP;
  }
  if (normalized.includes("playstation") || normalized.includes("ps5")) {
    return CATEGORY_LABELS.CONSOLE;
  }
  if (normalized.includes("rtx") || normalized.includes("ekran karti")) {
    return "Ekran Kartı";
  }
  return null;
}

// === Condition Inference ===

export type ConditionKeywordEntry = {
  value: ListingCondition;
  confidence: number;
};

export type ConditionSignal = {
  signal: "source" | "keyword" | "category" | "description";
  value: ListingCondition;
  weight: number;
  confidence: number;
};

export type InferConditionResult = {
  condition: ListingCondition;
  confidence: number;
  reason: string;
  signals: ConditionSignal[];
};

const REFURBISHED_SOURCES = new Set([
  "EasyCep", "Getmobil", "Yenilenmiş Market", "Teknosa Yenilenmiş",
  "Hepsiburada Yenilenmiş", "MediaMarkt Yenilenmiş",
]);

const CONDITION_KEYWORD_MAP: Array<{
  value: ListingCondition;
  confidence: number;
  patterns: string[];
}> = [
  {
    value: "Sıfır", confidence: 90,
    patterns: ["sifir", "acilmamis", "kutusu acilmamis"],
  },
  {
    value: "Yeni gibi", confidence: 85,
    patterns: ["yeni gibi", "sadece acildi", "az kullanilmis", "denemeli"],
  },
  {
    value: "Çok iyi", confidence: 80,
    patterns: ["cok iyi", "temiz", "hatasiz", "sorunsuz", "calisir durumda"],
  },
  {
    value: "İyi", confidence: 70,
    patterns: ["iyi", "saglam"],
  },
  {
    value: "İkinci El", confidence: 95,
    patterns: ["ikinci el", "2\\.el", "2 el", "2\\. el"],
  },
  {
    value: "Kullanılmış", confidence: 80,
    patterns: ["kullanilmis", "kullanilmis urun"],
  },
  {
    value: "Yenilenmiş", confidence: 90,
    patterns: ["yenilenmis", "refurbished"],
  },
];

function getSourceCondition(source: string): { value: ListingCondition; confidence: number } | null {
  const s = source?.trim();
  if (REFURBISHED_SOURCES.has(s)) {
    return { value: "Yenilenmiş" as ListingCondition, confidence: 85 };
  }
  return null;
}

function getCategoryModifier(category: string | undefined): number {
  if (!category) return 1.0;
  switch (category) {
    case CATEGORY_LABELS.PHONE: return 1.0;
    case CATEGORY_LABELS.TABLET: return 1.0;
    case CATEGORY_LABELS.LAPTOP: return 0.9;
    case CATEGORY_LABELS.CONSOLE: return 0.9;
    case "Ekran Kartı": return 0.85;
    case CATEGORY_LABELS.ACCESSORY: return 0.7;
    default: return 1.0;
  }
}

function detectConditionKeywords(text: string): Array<{ value: ListingCondition; confidence: number }> {
  if (!text) return [];
  const normalized = normalizeProductTitle(text);
  const matches: Array<{ value: ListingCondition; confidence: number }> = [];
  const seen = new Set<ListingCondition>();

  for (const entry of CONDITION_KEYWORD_MAP) {
    if (seen.has(entry.value)) continue;
    for (const raw of entry.patterns) {
      const regex = new RegExp(`(?:^|\\s)${raw}(?=\\s|$)`, "i");
      if (regex.test(normalized)) {
        matches.push({ value: entry.value, confidence: entry.confidence });
        seen.add(entry.value);
        break;
      }
    }
  }

  return matches;
}

export function inferCondition(
  title: string,
  source?: string,
  category?: string,
  description?: string,
): InferConditionResult {
  const signals: ConditionSignal[] = [];

  // 1. Source signal (weight: 0.40)
  const sourceCondition = getSourceCondition(source ?? "");
  if (sourceCondition) {
    signals.push({
      signal: "source",
      value: sourceCondition.value,
      weight: 0.40,
      confidence: sourceCondition.confidence,
    });
  }

  // 2. Keyword signal from title (weight: 0.35)
  const keywordMatches = detectConditionKeywords(title ?? "");
  const bestKeyword = keywordMatches.length > 0
    ? keywordMatches.reduce((a, b) => a.confidence >= b.confidence ? a : b)
    : null;
  if (bestKeyword) {
    signals.push({
      signal: "keyword",
      value: bestKeyword.value,
      weight: 0.35,
      confidence: bestKeyword.confidence,
    });
  }

  // 3. Category modifier (weight: 0.15) — modulates keyword confidence
  const categoryMod = getCategoryModifier(category);
  if (categoryMod !== 1.0 && bestKeyword) {
    signals.push({
      signal: "category",
      value: bestKeyword.value,
      weight: 0.15,
      confidence: Math.round(bestKeyword.confidence * categoryMod),
    });
  }

  // 4. Description signal (weight: 0.10)
  if (description) {
    const descMatches = detectConditionKeywords(description);
    const bestDesc = descMatches.length > 0
      ? descMatches.reduce((a, b) => a.confidence >= b.confidence ? a : b)
      : null;
    if (bestDesc) {
      signals.push({
        signal: "description",
        value: bestDesc.value,
        weight: 0.10,
        confidence: bestDesc.confidence,
      });
    }
  }

  // No signals at all → default
  if (signals.length === 0) {
    return {
      condition: "İkinci El",
      confidence: 50,
      reason: "Sinyal yok, varsayılan",
      signals: [],
    };
  }

  // Fusion: group by condition value, compute weighted average confidence
  const grouped = new Map<ListingCondition, { totalWeighted: number; totalWeight: number }>();
  for (const s of signals) {
    const g = grouped.get(s.value) ?? { totalWeighted: 0, totalWeight: 0 };
    g.totalWeighted += s.weight * s.confidence;
    g.totalWeight += s.weight;
    grouped.set(s.value, g);
  }

  const ranked = [...grouped.entries()]
    .map(([value, stats]) => ({
      value,
      avg: stats.totalWeight > 0 ? stats.totalWeighted / stats.totalWeight : 0,
      weight: stats.totalWeight,
    }))
    .sort((a, b) => b.avg - a.avg);

  const top = ranked[0];
  const runnerUp = ranked[1];
  const DISAGREEMENT = 15;

  // Clear winner
  if (!runnerUp || top.avg - runnerUp.avg >= DISAGREEMENT) {
    return {
      condition: top.value,
      confidence: Math.round(Math.min(100, top.avg)),
      reason: `${signals.length} sinyal birleşimi`,
      signals,
    };
  }

  // Disagreement: source signal wins with penalty
  const srcSig = signals.find((s) => s.signal === "source");
  if (srcSig) {
    return {
      condition: srcSig.value,
      confidence: Math.max(40, srcSig.confidence - 20),
      reason: `Kaynak öncelikli: ${srcSig.value}`,
      signals,
    };
  }

  // Disagreement: keyword wins if confident enough
  if (bestKeyword && bestKeyword.confidence >= 70) {
    return {
      condition: bestKeyword.value,
      confidence: bestKeyword.confidence,
      reason: `Anahtar kelime öncelikli: ${bestKeyword.value}`,
      signals,
    };
  }

  // Default fallback
  return {
    condition: "İkinci El",
    confidence: 50,
    reason: "Kararsız sinyaller, varsayılan",
    signals,
  };
}
