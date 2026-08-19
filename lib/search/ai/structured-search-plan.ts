import type { SearchQueryIntent } from "@/lib/search/query-intent-detector";

/**
 * 2ELBUL AI — AKILLI ARAMA: Structured Search Plan.
 *
 * This is the additive, validated contract produced by the intent layer and
 * consumed by the existing search pipeline. It DELIBERATELY composes the live
 * `SearchQueryIntent` (productType / brand / model / deviceFamily / etc. all
 * come from `detectQueryIntent`) and adds ONLY the fields the deterministic
 * pipeline cannot derive — price bands, reference product, sort/preference,
 * conditions, and which search mode to run.
 *
 * Guarantees:
 *  - No duplicate intent schema: the product-type fields ARE `SearchQueryIntent`.
 *  - No AI authority over product truth: the planner must never set `productType`
 *    when `SearchQueryIntent` leaves it null. Callers re-derive product type from
 *    PUE (`extractProductTypeFromAttributes`) at listing time.
 *  - LLM-substitutable: every field has a decision-relevant, serializable shape,
 *    so a future provider can fill the same plan behind the same interface.
 */

export type AiSearchMode = "fast_search" | "ai_search";

/**
 * Which existing sort key the intent maps to. Reuse-only — these ARE the client
 * sort options in `search-results-client.tsx`.
 */
export type PlanSortKey =
  | "ai-recommended"
  | "best-opportunity"
  | "most-reliable"
  | "lowest-risk"
  | "newest"
  | "price-asc"
  | "most-listings"
  | "confidence";

/**
 * Declared listing condition preferences. Stored raw (Turkish) and mapped to the
 * source values at application time; never fabricated by the parser.
 */
export type PlanCondition = string;

/** A price target expressed as a band, a center point, or nothing. */
export type PlanPriceRange = {
  /** Hard lower bound in TRY (null = unbounded). */
  min: number | null;
  /** Hard upper bound in TRY (null = unbounded). */
  max: number | null;
  /** Soft center the user asked "around" (null = none). Renders as a band. */
  target: number | null;
  /** Fraction multiplier tolerated around `target`, e.g. 0.1 = ±10%. */
  tolerance: number | null;
};

export type ReferenceProduct = {
  /** Normalized product label from the comparison, e.g. "iphone 15 pro". */
  name: string;
  /**
   * Comparison direction. "ucuz" = priced lower than the reference;
   * "pahali" = priced higher than the reference. Never fabricates a price.
   */
  relation: "cheaper_than" | "pricier_than";
  /** Human query phrase that carried the comparison, e.g. "iphone 15 pro'dan ucuz". */
  rawPhrase: string;
};

export type PlanPreferences = {
  /** "garantili" / "sifir" / "yenilenmis" style declared intents. */
  conditions: PlanCondition[];
  /** Declared quality/feature desires, e.g. "iyi kamera". Descriptive only. */
  qualities: string[];
};

/** 0..1 — the deterministic parser's estimate of how reliably it read the query. */
export type PlanConfidence = number;

export type StructuredSearchPlan = {
  /** Routing decision. "fast_search" short-circuits AI work on simple queries. */
  mode: AiSearchMode;
  /** The live intent system — product truth never authored here. */
  intent: SearchQueryIntent;
  /** Cast query used for logging / demand recording; mirrors intent.rawQuery. */
  query: string;

  /** Extracted or null. */
  priceRange: PlanPriceRange;
  /** Non-null when the user compared to a reference product. */
  referenceProduct: ReferenceProduct | null;

  /** Normalized preference signals. */
  preferences: PlanPreferences;

  /** Which existing sort key to apply, when a declared ordering was found. */
  sort: PlanSortKey | null;

  /** Conditions to force-apply (e.g. guaranteed), mapped downstream. */
  conditions: PlanCondition[];
  /** Terms to exclude from result set (e.g. "kasa", "hafiza"), lowercased. */
  exclusions: string[];

  /** Deterministic parse confidence. */
  confidence: PlanConfidence;

  /** Why this query was routed the way it was (surface for logs + fallback). */
  fallbackReason: string | null;

  /**
   * Optional count of results the caller should bound the run to. Kept small by
   * design so the AI path never over-fetches.
   */
  resultLimit: number;
};

/**
 * Validate a plan for the guarantees the pipeline depends on. Returns a list of
 * problems; an empty array means the plan is safe to consume. This is what lets
 * a future LLM- or deterministically-produced plan both be caught if malformed.
 */
export function validatePlan(plan: StructuredSearchPlan): string[] {
  const problems: string[] = [];

  if (plan.mode !== "fast_search" && plan.mode !== "ai_search") {
    problems.push(`mode must be "fast_search" or "ai_search", got ${plan.mode}`);
  }

  if (!plan.query || !plan.query.trim()) {
    problems.push("query must be a non-empty string");
  }

  if (!plan.intent || !plan.intent.rawQuery) {
    problems.push("intent.rawQuery is required");
  }

  const { min, max, target, tolerance } = plan.priceRange;
  if (min != null && !Number.isFinite(min)) {
    problems.push("priceRange.min must be a finite number or null");
  }
  if (max != null && !Number.isFinite(max)) {
    problems.push("priceRange.max must be a finite number or null");
  }
  if (min != null && max != null && min > max) {
    problems.push("priceRange.min must not exceed priceRange.max");
  }
  if (target != null && !Number.isFinite(target)) {
    problems.push("priceRange.target must be a finite number or null");
  }
  if (
    target != null &&
    min != null &&
    target < min
  ) {
    problems.push("priceRange.target must not be below priceRange.min");
  }
  if (
    target != null &&
    tolerance != null &&
    (!Number.isFinite(tolerance) || tolerance <= 0)
  ) {
    problems.push("priceRange.tolerance must be a positive finite number or null");
  }

  if (plan.referenceProduct) {
    if (!plan.referenceProduct.name.trim()) {
      problems.push("referenceProduct.name must be a non-empty string");
    }
    if (
      plan.referenceProduct.relation !== "cheaper_than" &&
      plan.referenceProduct.relation !== "pricier_than"
    ) {
      problems.push(`invalid referenceProduct.relation: ${plan.referenceProduct.relation}`);
    }
  }

  if (plan.sort !== null) {
    const validSorts: PlanSortKey[] = [
      "ai-recommended",
      "best-opportunity",
      "most-reliable",
      "lowest-risk",
      "newest",
      "price-asc",
      "most-listings",
      "confidence",
    ];
    if (!validSorts.includes(plan.sort)) {
      problems.push(`invalid sort key: ${plan.sort}`);
    }
  }

  if (Number.isFinite(plan.confidence)) {
    if (plan.confidence < 0 || plan.confidence > 1) {
      problems.push("confidence must be between 0 and 1");
    }
  } else {
    problems.push("confidence must be a finite number");
  }

  if (!Number.isFinite(plan.resultLimit) || plan.resultLimit < 1) {
    problems.push("resultLimit must be a positive finite number");
  }

  return problems;
}

export function isPlanValid(plan: StructuredSearchPlan): boolean {
  return validatePlan(plan).length === 0;
}
