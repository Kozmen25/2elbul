import type {
  PlanPriceRange,
  ReferenceProduct,
  PlanPreferences,
  PlanSortKey,
  PlanCondition,
} from "./structured-search-plan";

/**
 * 2ELBUL AI — AKILLI ARAMA: Deterministic Turkish natural-language parsers.
 *
 * Pure functions, zero I/O, zero AI. They only read what the user typed and emit
 * `StructuredSearchPlan` fields for the existing pipeline to apply as REAL filters
 * over REAL listing prices. They NEVER decide product truth, category, or invent
 * market numbers — anything numeric here is a bound/center the pipeline applies,
 * nothing is fabricated output.
 */

export type PriceParseResult = {
  range: PlanPriceRange;
  /** Number of distinct numeric signals fused (0 = none). */
  signals: number;
};

/** Turkish → ASCII-lowercase so lookups don't trip on diacritics. */
const tl = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[ıiİ]/g, "i")
    .replace(/[şŞ]/g, "s")
    .replace(/[ğĞ]/g, "g")
    .replace(/[çÇ]/g, "c")
    .replace(/[öÖ]/g, "o")
    .replace(/[üÜ]/g, "u");

// Written-number words we understand, normalized under `tl`.
const WRITTEN = new Map<string, number>([
  ["sifir", 0],
  ["bir", 1],
  ["iki", 2],
  ["uc", 3],
  ["dort", 4],
  ["bes", 5],
  ["alti", 6],
  ["yedi", 7],
  ["sekiz", 8],
  ["dokuz", 9],
  ["on", 10],
  ["onbir", 11],
  ["yirmi", 20],
  ["otuz", 30],
  ["kirk", 40],
  ["elli", 50],
  ["altmis", 60],
  ["yetmis", 70],
  ["seksen", 80],
  ["doksan", 90],
  ["yuz", 100],
  ["bin", 1000],
  ["milyon", 1_000_000],
  ["milyar", 1_000_000_000],
]);

/** Unit words that multiply a preceding number, with their magnitude. */
const UNITS: Record<string, number> = {
  bin: 1000,
  milyon: 1_000_000,
  milyar: 1_000_000_000,
};

interface ParsedAmount {
  /** Final number in TRY, with unit multipliers applied. */
  value: number;
  /** Unit magnitude carried by the amount (1 = none), so a band like "10-15 bin"
   *  can inherit the shared trailing unit onto the leading number. */
  unit: number;
  /** Full matched span so bounds can be located reliably. */
  span: string;
}

/**
 * Pull every "amount + optional unit" out of a query, e.g. "10 bin", "15.000",
 * "3 milyon". Returns amounts in ascending position order.
 */
function parseAmounts(text: string): ParsedAmount[] {
  const amounts: ParsedAmount[] = [];
  const re = /(\d[\d.,\s]*)\s*(bin|milyon|milyar)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const rawDigits = m[1].replace(/[.,\s]/g, "");
    if (!/^\d+$/.test(rawDigits)) continue;
    const number = Number(rawDigits);
    if (!Number.isFinite(number)) continue;
    const unit = m[2] ? UNITS[tl(m[2])] : 1;
    amounts.push({ value: number * unit, unit, span: m[0] });
    // Avoid consuming the same unit twice (e.g. "10 bin TL bin" won't occur).
    if (m[2]) re.lastIndex = m.index + m[0].length;
  }
  return amounts;
}

/** Lower/upper-bound adverbs. */
type Bound = "below" | "above";

function detectBound(text: string, around: string): Bound | null {
  // "X'dan/den/tan/ten ucuz/alti/az" -> below; "..., ustu/uzeri/yukari" -> above.
  // We bound only within a short window after the amount.
  const tail = text.slice(text.indexOf(around) + around.length).slice(0, 40);
  const lc = tl(tail);
  if (/(alti|ucuz|az|asagi)/.test(lc)) return "below";
  if (/(ustu|u[sz]eri|yukar[iı]|fazla)/.test(lc)) return "above";
  // Comparative "daha ucuz" placed before the amount reads as below too.
  if (/(ucuz|pahali)/.test(lc)) return "below";
  return null;
}

function isAroundPhrase(text: string, span: string): boolean {
  const s = span;
  const before = text.slice(Math.max(0, text.indexOf(s) - 30), text.indexOf(s));
  const after = text.slice(text.indexOf(s) + s.length, text.indexOf(s) + s.length + 30);
  const lc = tl(before + " " + after);
  return /civari|civarı|yaklasik|asagi yukari|bandi|bandinda|arasi|arasindak/.test(lc);
}

function isAffordabilityHint(text: string): boolean {
  return /(uygun fiyatli|en ucuz|ucuza|hepsinden ucuz|fiyat performans|f[\/p]|kamu fiyatli)/.test(
    tl(text),
  );
}

/**
 * Extract a TRY band / center from a written phrase.
 *
 * Supported shapes:
 *   - "10 bin alti | 3 bin uzeri"        -> single bound
 *   - "10-15 bin | 10 ile 15 arasi"      -> explicit band
 *   - "10 bin civari | yaklasik 10 bin"  -> center + tolerance
 *   - "uygun fiyatli | en ucuz"          -> affordability signal, no numbers
 *   - bare "10.000"                      -> center at default tolerance
 */
export function parsePriceIntent(rawQuery: string): PriceParseResult {
  const text = rawQuery.trim();
  if (!text) return { range: emptyRange(), signals: 0 };
  const amounts = parseAmounts(text);

  // No numeric signal: maybe an affordability hint propagates a sort intent.
  if (amounts.length === 0) {
    if (isAffordabilityHint(text)) {
      return { range: emptyRange(), signals: 1 };
    }
    return { range: emptyRange(), signals: 0 };
  }

  // One amount -> either a bound, a center, or (fallback) a center.
  if (amounts.length === 1) {
    const a = amounts[0];
    const bound = detectBound(text, a.span);
    if (bound === "below") {
      return { range: { min: null, max: a.value, target: null, tolerance: null }, signals: 1 };
    }
    if (bound === "above") {
      return { range: { min: a.value, max: null, target: null, tolerance: null }, signals: 1 };
    }
    const tolerance = isAroundPhrase(text, a.span) ? 0.1 : 0.1;
    return { range: { min: null, max: null, target: a.value, tolerance }, signals: 1 };
  }

  // Two amounts that read as a band: "10 - 15 bin", "10 ile 15 arasi".
  const [low, high] = amounts.slice(0, 2).sort((x, y) => x.value - y.value);
  const gapText = text.slice(
    text.indexOf(low.span) + low.span.length,
    text.indexOf(high.span),
  );
  const lcGap = tl(gapText);
  const looksLikeBand =
    /[-–—]|ile|to|arasi|arasindak/.test(lcGap) || high.value > low.value;
  if (looksLikeBand) {
    // "10-15 bin": the trailing unit ("bin") belongs to the whole band — inherit
    // it onto the leading amount when the high end already carries it. Harmless
    // when both already carry the same unit ("10 bin - 15 bin").
    let min = low.value;
    if (high.unit > low.unit) min = low.value * high.unit;
    return { range: { min, max: high.value, target: null, tolerance: null }, signals: 2 };
  }

  // Otherwise treat the leading amount as the significant one.
  const a = amounts[0];
  return { range: { min: null, max: null, target: a.value, tolerance: 0.1 }, signals: 1 };
}

function emptyRange(): PlanPriceRange {
  return { min: null, max: null, target: null, tolerance: null };
}

// --- Reference-product comparatives ------------------------------------------------

/** Product families whose name we can recognize inside a comparison. */
const COMPARABLE = [
  "iphone 15 pro",
  "iphone 15",
  "iphone",
  "galaxy s24",
  "galaxy s23",
  "galaxy",
  "samsung",
  "xiaomi",
  "poco",
  "ps5",
  "playstation 5",
  "asus rog",
  "macbook",
  "airpods",
];

/**
 * Extract a comparison: "iphone 15 pro'dan ucuz", "galaxy s24'ten pahali".
 * Only the DIRECTION and the raw reference label are captured — never a price.
 */
export function parseReferenceProduct(rawQuery: string): ReferenceProduct | null {
  const text = rawQuery.trim();
  const lc = tl(text);
  const direction = /pahali|daha pahali|yuksek fiyatli|yarimi yuksek|pahallı/.test(lc);
  const comparatorWord = /(ucuz|pahali|daha ucuz|daha pahali|ndan ucuz|ten ucuz)/.test(lc)
    ? true
    : false;
  if (!comparatorWord) return null;

  // Find the nearest recognized product name before the comparator.
  let foundName: string | null = null;
  let foundIndex = -1;
  for (const name of COMPARABLE) {
    const idx = lc.indexOf(name);
    if (idx !== -1 && idx > foundIndex) {
      foundIndex = idx;
      foundName = name;
    }
  }
  if (!foundName) return null;
  return {
    name: foundName,
    relation: direction ? "pricier_than" : "cheaper_than",
    rawPhrase: text,
  };
}

// --- Sort / preference mapping ------------------------------------------------------

const SORT_WORDS: Record<string, PlanSortKey> = {
  "en ucuz": "price-asc",
  ucuza: "price-asc",
  "en uygun fiyat": "best-opportunity",
  "fiyat performans": "best-opportunity",
  "en iyi fiyat performans": "best-opportunity",
  "en iyi firsat": "best-opportunity",
  "en gunvenlir": "most-reliable",
  "en guncel": "newest",
  "en yeni": "newest",
  "en yuksek guven": "confidence",
};

const CONDITION_WORDS: Record<string, PlanCondition> = {
  garantili: "garantili",
  "garanti li": "garantili",
  "teknik garanti": "garantili",
  yenilenmis: "yenilenmis",
  "sifir ayarinda": "yenilenmis",
  "sifir": "sifir",
  "yeni kutu": "sifir",
};

/**
 * Map declared ordering / preference words onto the EXISTING client sort keys
 * and condition labels. Reuses the client vocabulary verbatim — no new enums.
 */
export function parseSortAndPreferences(rawQuery: string): {
  sort: PlanSortKey | null;
  conditions: PlanCondition[];
} {
  const text = tl(rawQuery);
  let sort: PlanSortKey | null = null;
  for (const [phrase, key] of Object.entries(SORT_WORDS)) {
    if (text.includes(phrase)) {
      sort = key;
      break;
    }
  }
  const conditions: PlanCondition[] = [];
  for (const [phrase, cond] of Object.entries(CONDITION_WORDS)) {
    if (text.includes(phrase) && !conditions.includes(cond)) conditions.push(cond);
  }
  return { sort, conditions };
}

/** Declared quality/feature desires (descriptive only, never used as data). */
export function parseQualityPreferences(rawQuery: string): string[] {
  const text = tl(rawQuery);
  const found: string[] = [];
  for (const q of [
    "kamera",
    "batarya",
    "ekran",
    "performans",
    "oyun",
    "kucuk",
    "buyuk",
  ]) {
    if (text.includes(q)) found.push(q);
  }
  return found;
}

/** Terms the user may add that clearly point at a part/service, not the product. */
const EXCLUSION_TERMS = ["kasa", "batarya", "ekran koruyucu", "tamir", "servis", "hafiza"];

export function parseExclusions(rawQuery: string): string[] {
  const text = tl(rawQuery);
  return EXCLUSION_TERMS.filter((term) => text.includes(term));
}

/** Conservative 0..1 estimate of how confidently the parsers read the query. */
export function estimateParseConfidence(
  price: PriceParseResult,
  reference: ReferenceProduct | null,
  sort: PlanSortKey | null,
): number {
  let score = 0;
  score += price.signals * 0.4;
  if (reference) score += 0.6;
  if (sort) score += 0.35;
  return Math.round(Math.min(1, score) * 10) / 10;
}

/**
 * Compose every parser into the plan's extra fields. Pure. `planner.ts` is
 * responsible for merging these with the live intent + mode routing.
 */
export function extractPlanExtras(rawQuery: string): {
  priceRange: PlanPriceRange;
  referenceProduct: ReferenceProduct | null;
  preferences: PlanPreferences;
  sort: PlanSortKey | null;
  conditions: PlanCondition[];
  exclusions: string[];
  confidence: number;
} {
  const price = parsePriceIntent(rawQuery);
  const reference = parseReferenceProduct(rawQuery);
  const { sort, conditions } = parseSortAndPreferences(rawQuery);
  const qualities = parseQualityPreferences(rawQuery);

  return {
    priceRange: price.range,
    referenceProduct: reference,
    preferences: { conditions, qualities },
    sort,
    conditions,
    exclusions: parseExclusions(rawQuery),
    confidence: estimateParseConfidence(price, reference, sort),
  };
}
