import type { ProductIntelligence } from "@/lib/intelligence-engine";
import type { MarketIntelligenceDecisionInsight, MarketOpportunity } from "./types";
import type { MarketPriceAnalysis } from "./types";
import { clampScore } from "@/lib/confidence-engine/scoring";
import { formatCurrency, roundDecimal } from "./helpers";

type BuildMarketOpportunityInput = {
  priceAnalysis: MarketPriceAnalysis;
  intelligence?: ProductIntelligence | null;
  decisionInsight?: MarketIntelligenceDecisionInsight | null;
  confidenceScore: number | null;
};

export function buildMarketOpportunity({
  priceAnalysis,
  intelligence,
  decisionInsight,
  confidenceScore,
}: BuildMarketOpportunityInput): MarketOpportunity {
  const opportunity = intelligence?.opportunity ?? null;
  const recommendation = intelligence?.recommendation ?? null;
  const averagePrice = priceAnalysis.averagePrice ?? intelligence?.marketValue.averagePrice ?? null;
  const minPrice = priceAnalysis.minPrice ?? intelligence?.marketValue.minPrice ?? null;

  const discountPercent =
    averagePrice && minPrice && averagePrice > 0
      ? roundDecimal(((averagePrice - minPrice) / averagePrice) * 100, 1)
      : null;

  const score =
    opportunity?.score ??
    (confidenceScore != null
      ? clampScore(confidenceScore)
      : priceAnalysis.sampleSize > 0
        ? clampScore(Math.round((priceAnalysis.priceSpreadPercent ?? 0) / 2))
        : 0);

  return {
    score,
    label: opportunity?.label ?? "Veri yetersiz",
    explanation:
      decisionInsight?.smartPrice.summary ??
      opportunity?.explanation ??
      (averagePrice
        ? `${formatCurrency(averagePrice)} civarında bir fiyat bandı oluştu.`
        : "Bu ürün için yeterli analiz verisi bulunmuyor."),
    action: recommendation?.action ?? "insufficient_data",
    discountPercent,
  };
}
