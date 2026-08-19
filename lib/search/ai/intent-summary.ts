import { detectQueryIntent } from "@/lib/search/query-intent-detector";
import { extractPlanExtras } from "./turkish-nl-parser";
import type { PlanSortKey, PlanCondition } from "./structured-search-plan";

/**
 * 2ELBUL AI — AŞAMA 2: client-side intent summary.
 *
 * Pure. Echoes ONLY what the user's own query already said, by re-using the
 * SAME deterministic source functions the planner uses (`detectQueryIntent` +
 * `extractPlanExtras`). It assembles Turkish display labels from fields those
 * parsers already produced and NEVER invents product truth, a category, a
 * number, or a brand. `productType` is left null when `detectQueryIntent` says
 * null — PUE stays the sole authority on what a product actually is.
 */
export type IntentSummary = {
  /** Accessory / spare part / service intent the user exposed. Null otherwise. */
  productTypeLabel: string | null;
  /** Brand / model the user named (or the device family fallback). */
  deviceLabel: string | null;
  /** Price band/center the parser read, formatted for display. */
  priceLabel: string | null;
  /** Sort + condition + quality preference signals the user declared. */
  preferenceLabel: string | null;
};

const PRODUCT_TYPE_LABELS: Record<
  NonNullable<ReturnType<typeof detectQueryIntent>["productType"]>,
  string
> = {
  primary_product: "Ana ürün",
  accessory: "Aksesuar",
  spare_part: "Yedek parça",
  service: "Servis / tamir",
};

const SORT_LABELS: Record<PlanSortKey, string> = {
  "ai-recommended": "Önerilen",
  "best-opportunity": "Fiyat/fırsat önceliği",
  "most-reliable": "En güvenilir",
  "lowest-risk": "En düşük risk",
  newest: "En yeni",
  "price-asc": "En düşük fiyat",
  "most-listings": "En çok ilan",
  confidence: "Yüksek güven",
};

const CONDITION_LABELS: Record<PlanCondition, string> = {
  garantili: "Garantili",
  yenilenmis: "Yenilenmiş",
  sifir: "Sıfır",
};

/** Known display capitalization. Fallback only uppercases the first letter. */
const BRAND_CAP: Record<string, string> = {
  iphone: "iPhone",
  ipad: "iPad",
  macbook: "MacBook",
  samsung: "Samsung",
  galaxy: "Galaxy",
  playstation: "PlayStation",
  ps5: "PS5",
  ps4: "PS4",
  airpods: "AirPods",
  xiaomi: "Xiaomi",
  huawei: "Huawei",
  oppo: "OPPO",
  poco: "Poco",
};

function capFirst(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function displayToken(token: string): string {
  const known = BRAND_CAP[token.toLowerCase()];
  if (known) return known;
  // Handles hyphenated tokens e.g. "iphone-15" -> "iPhone-15" via per-segment caps.
  return token
    .split("-")
    .map((segment) => BRAND_CAP[segment.toLowerCase()] ?? capFirst(segment))
    .join("-");
}

function displayModel(model: string): string {
  return model
    .split(/\s+/)
    .map(displayToken)
    .filter(Boolean)
    .join(" ");
}

/** Format an integer TRY value with Turkish thousands separators ("10.000"). */
function formatTry(value: number): string {
  return Math.round(value).toLocaleString("tr-TR");
}

export function buildIntentSummary(rawQuery: string): IntentSummary {
  const query = (rawQuery ?? "").trim().replace(/\s+/g, " ");
  if (!query) {
    return {
      productTypeLabel: null,
      deviceLabel: null,
      priceLabel: null,
      preferenceLabel: null,
    };
  }

  const intent = detectQueryIntent(query);
  const extras = extractPlanExtras(query);

  let productTypeLabel: string | null = null;
  if (intent.productType && PRODUCT_TYPE_LABELS[intent.productType]) {
    productTypeLabel = PRODUCT_TYPE_LABELS[intent.productType];
  }

  let deviceLabel: string | null = null;
  const brand = intent.brand;
  const model = intent.model;
  if (brand) {
    const capped = displayToken(brand);
    if (model) {
      if (model.toLowerCase().includes(brand.toLowerCase())) {
        deviceLabel = displayModel(model);
      } else {
        deviceLabel = `${capped} ${displayModel(model)}`;
      }
    } else {
      deviceLabel = capped;
    }
  } else if (intent.deviceFamily) {
    deviceLabel = displayToken(intent.deviceFamily);
  }

  let priceLabel: string | null = null;
  const { min, max, target } = extras.priceRange;
  if (min != null && max != null) {
    priceLabel = `${formatTry(min)} – ${formatTry(max)} TL`;
  } else if (max != null) {
    priceLabel = `${formatTry(max)} TL altı`;
  } else if (min != null) {
    priceLabel = `${formatTry(min)} TL üzeri`;
  } else if (target != null) {
    priceLabel = `≈ ${formatTry(target)} TL`;
  }

  let preferenceLabel: string | null = null;
  const preferenceParts: string[] = [];
  if (extras.sort && SORT_LABELS[extras.sort]) {
    preferenceParts.push(SORT_LABELS[extras.sort]);
  }
  for (const cond of extras.conditions) {
    if (CONDITION_LABELS[cond]) preferenceParts.push(CONDITION_LABELS[cond]);
  }
  preferenceParts.push(...extras.preferences.qualities);
  const unique = Array.from(new Set(preferenceParts.filter((p): p is string => !!p)));
  if (unique.length > 0) {
    preferenceLabel = unique.slice(0, 3).join(" · ");
  }

  return { productTypeLabel, deviceLabel, priceLabel, preferenceLabel };
}
