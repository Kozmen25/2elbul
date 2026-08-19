import { detectQueryIntent } from "@/lib/search/query-intent-detector";
import { getExpandedSearchTerms, isBroadCategoryQuery } from "@/lib/category-taxonomy";
import { extractPlanExtras } from "./turkish-nl-parser";
import {
  isPlanValid,
  type PlanPriceRange,
  type ReferenceProduct,
  type PlanSortKey,
  type PlanCondition,
  type AiSearchMode,
  type PlanConfidence,
  type StructuredSearchPlan,
} from "./structured-search-plan";

/**
 * 2ELBUL AI — AKILLI ARAMA: planner.
 *
 * Pure, read-only. Composes the three existing sources of truth into a
 * validated `StructuredSearchPlan`:
 *   - `detectQueryIntent`  -> product type / brand / model / device family (live intent)
 *   - taxonomy expansion   -> broad-category awareness + expanded terms
 *   - `extractPlanExtras`  -> price band / reference product / sort / conditions
 *
 * Routing is hybrid (§13): a simple keyword query with no structured-NL signal
 * short-circuits to `mode: "fast_search"` with ZERO new cost — the existing
 * pipeline runs untouched. Only queries carrying a price phrase, comparator, or
 * preference word enter `mode: "ai_search"`.
 *
 * Guarantee: the planner NEVER authors product truth. If `detectQueryIntent`
 * leaves `productType` null, this planner leaves it null too. Callers re-derive
 * product type from PUE at listing time via `extractProductTypeFromAttributes`.
 */

const FAST_SEARCH_RESULT_LIMIT = 24;
const AI_SEARCH_RESULT_LIMIT = 48;

export type BuildPlanResult = {
  plan: StructuredSearchPlan;
  /**
   * Taxonomy-expanded terms to run through the existing pipeline. Redundant as
   * `plan` for callers that prefer the object, but kept explicit so the route
   * doesn't re-derive what the planner already expanded.
   */
  expandedTerms: string[];
  isBroadCategory: boolean;
};

function emptyPriceRange(): PlanPriceRange {
  return { min: null, max: null, target: null, tolerance: null };
}

export function buildSearchPlan(rawQuery: string): BuildPlanResult {
  const query = (rawQuery ?? "").trim().replace(/\s+/g, " ");
  const intent = detectQueryIntent(query);
  const expandedTerms = getExpandedSearchTerms(query);
  const isBroadCategory = isBroadCategoryQuery(query);
  const extras = extractPlanExtras(query);

  // Single source for what the NL layer actually found.
  const hasStructuredSignal =
    extras.confidence > 0 ||
    extras.conditions.length > 0 ||
    extras.exclusions.length > 0 ||
    extras.preferences.qualities.length > 0 ||
    extras.referenceProduct !== null ||
    extras.sort !== null;

  let mode: AiSearchMode;
  let fallbackReason: string | null;
  let confidence: PlanConfidence;
  let priceRange: PlanPriceRange = extras.priceRange;
  let referenceProduct: ReferenceProduct | null = extras.referenceProduct;
  let sort: PlanSortKey | null = extras.sort;
  let conditions: PlanCondition[] = extras.conditions;

  if (!hasStructuredSignal) {
    mode = "fast_search";
    fallbackReason =
      "Mode-fast_search: sorguda fiyat/karşılaştırma/tercih sinyali yok; mevcut deterministik arama boru hattı olduğu gibi çalıştırıldı.";
    confidence = 0;
    priceRange = emptyPriceRange();
    referenceProduct = null;
    sort = null;
    conditions = [];
  } else {
    mode = "ai_search";
    fallbackReason = null;
    confidence = Math.max(0, Math.min(1, extras.confidence));
  }

  const plan: StructuredSearchPlan = {
    mode,
    // Product truth is ALWAYS the live intent's output — never overwritten.
    intent,
    query,
    priceRange,
    referenceProduct,
    preferences: {
      conditions,
      qualities: extras.preferences.qualities,
    },
    sort,
    conditions,
    exclusions: extras.exclusions,
    confidence,
    fallbackReason,
    resultLimit: mode === "ai_search" ? AI_SEARCH_RESULT_LIMIT : FAST_SEARCH_RESULT_LIMIT,
  };

  if (!isPlanValid(plan)) {
    // A malformed plan is never consumed — downgrade loudly to the safe path.
    return {
      plan: {
        mode: "fast_search",
        intent,
        query,
        priceRange: emptyPriceRange(),
        referenceProduct: null,
        preferences: { conditions: [], qualities: [] },
        sort: null,
        conditions: [],
        exclusions: [],
        confidence: 0,
        fallbackReason: "Plan doğrulaması başarısız oldu; güvenli deterministik arama boru hattına düşüldü.",
        resultLimit: FAST_SEARCH_RESULT_LIMIT,
      },
      expandedTerms,
      isBroadCategory,
    };
  }

  return { plan, expandedTerms, isBroadCategory };
}
