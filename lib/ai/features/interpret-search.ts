// Search understanding: turns a natural-language query into the extra fields
// the deterministic planner could not read (price band, sort, exclusions,
// alternative keywords). It never decides product truth — the plan's `intent`
// stays whatever detectQueryIntent produced.

import { unstable_cache } from "next/cache";
import {
  MIN_WORDS_FOR_AI_SEARCH,
  SEARCH_INTERPRETATION_CACHE_SECONDS,
} from "@/lib/ai/config";
import { clipInput, runAiTask, type AiTaskResult } from "@/lib/ai/gateway";
import {
  isPlanValid,
  type PlanSortKey,
  type StructuredSearchPlan,
} from "@/lib/search/ai/structured-search-plan";

export const INTERPRETABLE_SORTS = ["price-asc", "newest", "best-opportunity", "most-reliable"] as const satisfies readonly PlanSortKey[];

export type SearchInterpretation = {
  isShoppingQuery: boolean;
  priceMin: number | null;
  priceMax: number | null;
  sort: (typeof INTERPRETABLE_SORTS)[number] | null;
  exclusions: string[];
  keywords: string[];
  confidence: number;
};

export type InterpretOutcome =
  | { status: "ok"; interpretation: SearchInterpretation }
  | { status: "skipped"; reason: string }
  | { status: "error"; error: string };

const MAX_KEYWORDS = 5;
const MAX_EXCLUSIONS = 5;
const MIN_TERM_LENGTH = 2;
const MAX_TERM_LENGTH = 40;
/** Upper sanity bound for a TRY price coming from the model. */
const MAX_PRICE_TRY = 10_000_000;

const SYSTEM_INSTRUCTION = [
  "Sen Türkiye ikinci el pazarında arama yapan kullanıcıların cümlelerini yapılandırılmış aramaya çeviren bir asistansın.",
  "Yalnızca JSON döndür. Sorguda olmayan bilgiyi uydurma; belirtilmeyen alanlar için null veya boş liste yaz.",
  "isShoppingQuery: sorgu bir ürün arama niyeti taşıyorsa true.",
  "priceMin / priceMax: TL cinsinden. \"10 bin altı\" => priceMax 10000. \"15-20 bin arası\" => min 15000, max 20000.",
  "sort: ucuzdan pahalıya istenmişse price-asc, en yeni istenmişse newest, fırsat/en avantajlı istenmişse best-opportunity, güvenilir istenmişse most-reliable; yoksa null.",
  "exclusions: kullanıcının istemediği terimler (ör. \"kasasız\", \"yedek parça\"), küçük harf.",
  "keywords: aramada kullanılabilecek en fazla 5 kısa ürün adı/anahtar kelime (marka+model, eş anlamlılar). Fiyat ve sıfat kelimelerini ekleme.",
  "confidence: yorumuna ne kadar güvendiğin (0-1).",
].join("\n");

const SCHEMA = {
  type: "OBJECT",
  properties: {
    isShoppingQuery: { type: "BOOLEAN" },
    priceMin: { type: "NUMBER", nullable: true },
    priceMax: { type: "NUMBER", nullable: true },
    sort: { type: "STRING", nullable: true, enum: [...INTERPRETABLE_SORTS] },
    exclusions: { type: "ARRAY", items: { type: "STRING" } },
    keywords: { type: "ARRAY", items: { type: "STRING" } },
    confidence: { type: "NUMBER" },
  },
  required: ["isShoppingQuery", "priceMin", "priceMax", "sort", "exclusions", "keywords", "confidence"],
};

function cleanTerms(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  const terms = value
    .filter((term): term is string => typeof term === "string")
    .map((term) => term.toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim())
    .filter((term) => term.length >= MIN_TERM_LENGTH && term.length <= MAX_TERM_LENGTH);
  return [...new Set(terms)].slice(0, limit);
}

function cleanPrice(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= MAX_PRICE_TRY
    ? Math.round(value)
    : null;
}

export function parseInterpretation(json: unknown): SearchInterpretation | null {
  if (!json || typeof json !== "object") return null;
  const raw = json as Record<string, unknown>;

  let priceMin = cleanPrice(raw.priceMin);
  let priceMax = cleanPrice(raw.priceMax);
  if (priceMin !== null && priceMax !== null && priceMin > priceMax) [priceMin, priceMax] = [priceMax, priceMin];

  return {
    isShoppingQuery: raw.isShoppingQuery === true,
    priceMin,
    priceMax,
    sort: INTERPRETABLE_SORTS.find((sort) => sort === raw.sort) ?? null,
    exclusions: cleanTerms(raw.exclusions, MAX_EXCLUSIONS),
    keywords: cleanTerms(raw.keywords, MAX_KEYWORDS),
    confidence: typeof raw.confidence === "number" && Number.isFinite(raw.confidence)
      ? Math.min(1, Math.max(0, raw.confidence))
      : 0,
  };
}

export async function interpretSearchWithAi(
  query: string,
  run: (input: Parameters<typeof runAiTask>[0]) => Promise<AiTaskResult> = runAiTask,
): Promise<InterpretOutcome> {
  const result = await run({
    feature: "search",
    systemInstruction: SYSTEM_INSTRUCTION,
    userText: `Sorgu: ${clipInput(query)}`,
    responseSchema: SCHEMA,
  });
  if (result.status === "skipped") return { status: "skipped", reason: result.reason };
  if (result.status === "error") return { status: "error", error: result.error };

  const interpretation = parseInterpretation(result.json);
  return interpretation
    ? { status: "ok", interpretation }
    : { status: "error", error: "Yanıt beklenen biçimde değildi." };
}

/** Same words → same answer: reused for a day instead of paying for it again. */
const interpretCached = unstable_cache(
  async (normalizedQuery: string): Promise<SearchInterpretation> => {
    const outcome = await interpretSearchWithAi(normalizedQuery);
    // Throwing keeps skipped/failed outcomes (budget, outage) out of the cache.
    if (outcome.status !== "ok") throw new Error(outcome.status);
    return outcome.interpretation;
  },
  ["ai:search-interpretation"],
  { revalidate: SEARCH_INTERPRETATION_CACHE_SECONDS },
);

export function normalizeQueryForAi(query: string): string {
  return query.toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();
}

/** Null whenever AI is off, over budget, failed or unsure: the caller keeps its own plan. */
export async function getSearchInterpretation(query: string): Promise<SearchInterpretation | null> {
  try {
    return await interpretCached(normalizeQueryForAi(query));
  } catch {
    return null;
  }
}

/** Cost guard: only multi-word queries the deterministic parser barely understood. */
export function shouldInterpretWithAi(plan: StructuredSearchPlan, query: string): boolean {
  const words = query.trim().split(/\s+/).filter(Boolean).length;
  return words >= MIN_WORDS_FOR_AI_SEARCH && plan.confidence < 0.5;
}

export type EnhancedPlan = {
  plan: StructuredSearchPlan;
  /** Extra terms to run through the existing search pipeline. */
  extraTerms: string[];
  applied: boolean;
};

/**
 * Merges an interpretation into the deterministic plan. Deterministic values
 * always win; the model only fills what the parser left empty. `intent`
 * (product truth) is never touched.
 */
export function applyInterpretation(
  plan: StructuredSearchPlan,
  interpretation: SearchInterpretation,
  minConfidence: number,
): EnhancedPlan {
  const unchanged: EnhancedPlan = { plan, extraTerms: [], applied: false };
  if (!interpretation.isShoppingQuery || interpretation.confidence < minConfidence) return unchanged;

  const hasPrice = plan.priceRange.min !== null || plan.priceRange.max !== null || plan.priceRange.target !== null;
  const priceRange = hasPrice
    ? plan.priceRange
    : { ...plan.priceRange, min: interpretation.priceMin, max: interpretation.priceMax };
  const sort = plan.sort ?? interpretation.sort;
  const exclusions = [...new Set([...plan.exclusions, ...interpretation.exclusions])];

  // Keywords alone would only widen the term list of a plan that still runs
  // the plain pipeline, so the model must have found real structure.
  const addsStructure =
    (priceRange !== plan.priceRange && (priceRange.min !== null || priceRange.max !== null)) ||
    sort !== plan.sort ||
    exclusions.length !== plan.exclusions.length;
  if (!addsStructure) return unchanged;

  const merged: StructuredSearchPlan = {
    ...plan,
    mode: "ai_search",
    priceRange,
    sort,
    exclusions,
    confidence: Math.max(plan.confidence, interpretation.confidence),
    fallbackReason: null,
  };

  if (!isPlanValid(merged)) return unchanged;
  return { plan: merged, extraTerms: interpretation.keywords, applied: true };
}
