import type { StructuredSearchPlan } from "./structured-search-plan";
import type { ProductDecisionInsight } from "@/lib/product-detail";
import type {
  MarketSummary,
  MarketOpportunity,
  MarketPriceAnalysis,
} from "@/lib/market-intelligence/types";

/**
 * 2ELBUL AI — AKILLI ARAMA: grounded Turkish explanation assembler.
 *
 * HARD RULE: this module NEVER computes, invents, or paraphrases a number. The
 * only affine operations allowed here are string concatenation and copying. All
 * numeric/semantic content is lifted VERBATIM from subsystems that already own
 * the truth — `buildProductDecisionInsight`, `buildMarketIntelligence`, and
 * friends. If a grounding field is absent, we simply say that field's truth is
 * not yet available; we never fill the blank with a guess.
 *
 * The one quote we may repeat is the user's own query — that is their words, not
 * a fabricated result.
 */

export type GroundedProductSummary = {
  /** Display name. Used only as a section heading; never as data. */
  name: string;
  slug: string;
  /** Existing decision insight output (real prose). Null when not available. */
  decisionInsight?: ProductDecisionInsight | null;
  /** Existing market summary output (real prose). Null when not available. */
  marketSummary?: MarketSummary | null;
  /** Existing opportunity output (real prose). Null when not available. */
  opportunity?: MarketOpportunity | null;
  /** Existing price-analysis output (real values). Null when not available. */
  priceAnalysis?: MarketPriceAnalysis | null;
};

export type ExplanationInput = {
  /** The validated plan; used only to echo the caller's own intent. */
  plan: StructuredSearchPlan;
  /**
   * The products whose real, already-computed outputs we assemble from. The
   * route orders these by ranking; the assembler reflects the top ones.
   */
  products: GroundedProductSummary[];
};

function headingFor(name: string, index: number): string {
  return `\n\n${index + 1}. ${name}`;
}

/** Reflects the user's own intent back in natural Turkish (their words). */
function echoIntent(plan: StructuredSearchPlan): string {
  const parts: string[] = [];
  if (plan.referenceProduct) {
    parts.push(
      plan.referenceProduct.relation === "cheaper_than"
        ? "referans ürün olarak verilen üründen ucuza aranıyor"
        : "referans ürün olarak verilen üründen pahalıya aranıyor",
    );
  }
  if (plan.priceRange) {
    const { min, max, target } = plan.priceRange;
    if (min != null && max != null) parts.push("belirtilen fiyat aralığında");
    else if (min != null) parts.push("belirtilen alt fiyat sınırının üzerinde");
    else if (max != null) parts.push("belirtilen üst fiyat sınırının altında");
    else if (target != null) parts.push("belirtilen fiyat civarında");
  }
  if (plan.sort) parts.push("seçilen sıralama tercihine göre");
  if (plan.preferences.qualities.length > 0) {
    parts.push("bildirilen özellik tercihleri dikkate alınarak");
  }
  const tail =
    parts.length > 0 ? `${parts.join(", ")}; sonuçlara yansıtılmıştır.` : "";
  return `Aramanızı ("${plan.query}") okudum; ${tail}`;
}

function decisionSentence(g: GroundedProductSummary): string | null {
  const summary = g.decisionInsight?.smartPrice?.summary;
  if (summary && summary.trim()) return summary.trim();
  return null;
}

function marketSentence(g: GroundedProductSummary): string | null {
  const summary = g.marketSummary?.summary;
  if (summary && summary.trim()) return summary.trim();
  return null;
}

function opportunitySentence(g: GroundedProductSummary): string | null {
  const explanation = g.opportunity?.explanation;
  if (explanation && explanation.trim()) return explanation.trim();
  return null;
}

function confidenceSentence(g: GroundedProductSummary): string | null {
  const description = g.decisionInsight?.confidence?.description;
  if (description && description.trim()) return description.trim();
  return null;
}

/** Single real "voice" for a product; prefers the richest existing prose. */
function paragraphFor(g: GroundedProductSummary): string {
  const sentences: string[] = [];
  const pushed = (
    value: string | null,
    fallback: string | null = null,
  ): boolean => {
    const v = value ?? fallback;
    if (v && !sentences.includes(v)) {
      sentences.push(v);
      return true;
    }
    return false;
  };

  const primary = decisionSentence(g) ?? marketSentence(g);
  const hadPrimary = pushed(primary);
  // Only add the opportunity/confidence voices when the primary was present,
  // so we never light a section with nothing but our own glue.
  if (hadPrimary) {
    const hadOpp = pushed(opportunitySentence(g));
    const hadConf = pushed(confidenceSentence(g));
    // If the main prose was missing but confidence exists, still surface it.
    if (!hadOpp && !hadConf) pushed(confidenceSentence(g));
  }

  if (sentences.length === 0) {
    return "Bu ürün için henüz yeterli fiyat yorumu oluşmadı; yeni ilanlar geldikçe piyasa görünümü otomatik güncellenecek.";
  }
  return sentences.join(" ");
}

/**
 * Assemble the full Turkish AI explanation. Pure; every concrete claim it emits
 * came from an existing subsystem output carried in `GroundedProductSummary`,
 * or is the user's own query echoed back. Never computes a figure.
 */
export function buildSearchExplanation(input: ExplanationInput): string {
  const { plan, products } = input;
  const intro = echoIntent(plan);

  if (!products || products.length === 0) {
    return `${intro}\n\nEşleşen ürün bulunamadı; arama teriminizi genişleterek tekrar deneyebilirsiniz.`;
  }

  const sections = products.slice(0, 3).flatMap((g, i) => {
    const heading = headingFor(g.name, i);
    return [heading, paragraphFor(g)];
  });

  return [intro, ...sections].join("");
}
