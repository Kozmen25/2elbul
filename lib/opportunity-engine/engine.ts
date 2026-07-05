import type { ConfidenceLevel } from "@/lib/confidence-engine";
import type { MarketIntelligence } from "@/lib/market-intelligence";
import {
  calculatePriceAdvantagePercent,
  calculateSourceConcentration,
  normalizeOpportunityTimestamp,
  resolveOpportunityDataFreshness,
  OPPORTUNITY_SCORE_VERSION,
} from "./helpers";
import {
  calculateOpportunityScore,
  toOpportunityLevel,
  toRiskLevel,
} from "./scoring";
import { calculateOpportunityRiskScore } from "./risk";
import {
  buildOpportunityReasons,
  buildPositiveSignals,
  buildWarningSignals,
} from "./reasons";
import type {
  OpportunityAnalysis,
  OpportunityEngineInput,
  OpportunitySignalContext,
  OpportunityRecommendation,
} from "./types";

export function buildOpportunityAnalysis({
  marketIntelligence,
  intelligence,
  duplicateSummary,
  analyzedAt,
  latestListingAt,
}: OpportunityEngineInput): OpportunityAnalysis {
  const scoreGeneratedAt = normalizeOpportunityTimestamp(
    analyzedAt ?? marketIntelligence.analysisGeneratedAt,
  );
  const { dataFreshness, latestListingAgeDays } = resolveOpportunityDataFreshness(
    latestListingAt,
    scoreGeneratedAt,
  );
  const sourceCount = marketIntelligence.marketSummary.sourceCount;
  const duplicateDensity = normalizeDuplicateDensity(
    duplicateSummary?.duplicateItemCount,
    duplicateSummary?.itemCount,
    marketIntelligence.marketSummary.duplicateDensity,
  );
  const priceAdvantagePercent = calculatePriceAdvantagePercent(
    marketIntelligence.priceAnalysis.averagePrice,
    marketIntelligence.priceAnalysis.minPrice,
  );
  const sourceConcentration = calculateSourceConcentration(
    marketIntelligence.marketSummary.sourceBreakdown,
  );
  const confidenceScore = marketIntelligence.confidenceScore;
  const confidenceLevel = marketIntelligence.confidenceLevel;
  const sampleSize = marketIntelligence.sampleSize;

  const context: OpportunitySignalContext = {
    sampleSize,
    confidenceScore,
    confidenceLevel,
    sourceCount,
    duplicateDensity,
    priceSpreadPercent: marketIntelligence.priceAnalysis.priceSpreadPercent,
    priceAdvantagePercent,
    buyScore: intelligence?.decisionSupport.buyScore ?? null,
    waitScore: intelligence?.decisionSupport.waitScore ?? null,
    opportunityScoreFromIntelligence: intelligence?.opportunity.score ?? null,
    trendDirection: intelligence?.trend.direction ?? "unknown",
    trendChangePercent: intelligence?.trend.changePercent ?? null,
    demandLevel: intelligence?.demand.demandLevel ?? "unknown",
    dataFreshness,
    latestListingAgeDays,
    sourceConcentration,
  };

  const opportunityScore = calculateOpportunityScore(context);
  const riskScore = calculateOpportunityRiskScore(context, opportunityScore);
  const positiveSignals = buildPositiveSignals(context);
  const warningSignals = buildWarningSignals(context);
  const reasons = buildOpportunityReasons(
    opportunityScore,
    riskScore,
    positiveSignals,
    warningSignals,
  );

  return {
    opportunityScore,
    opportunityLevel: toOpportunityLevel(opportunityScore),
    riskLevel: toRiskLevel(riskScore),
    recommendation: buildOpportunityRecommendation({
      opportunityScore,
      riskScore,
      sampleSize,
      confidenceLevel,
      dataFreshness,
    }),
    reasons,
    warningSignals,
    positiveSignals,
    scoreGeneratedAt,
    scoreVersion: OPPORTUNITY_SCORE_VERSION,
    dataFreshness,
    sampleSize,
    confidenceLevel,
  };
}

function buildOpportunityRecommendation({
  opportunityScore,
  riskScore,
  sampleSize,
  confidenceLevel,
  dataFreshness,
}: {
  opportunityScore: number;
  riskScore: number;
  sampleSize: number;
  confidenceLevel: ConfidenceLevel;
  dataFreshness: OpportunityAnalysis["dataFreshness"];
}): OpportunityRecommendation {
  if (
    sampleSize < 3 ||
    confidenceLevel === "very-low" ||
    (sampleSize < 5 && confidenceLevel === "low")
  ) {
    return {
      action: "insufficient_data",
      label: "Veri yetersiz",
      description:
        dataFreshness === "stale"
          ? "Veri eski ve örneklem küçük. Sağlıklı bir alım kararı için daha güncel ilanlar beklenmeli."
          : "Bu ürün için güvenli bir alım kararı üretmek adına daha fazla ilan gerekiyor.",
    };
  }

  if (opportunityScore >= 85 && riskScore < 35) {
    return {
      action: "buy_now",
      label: "Şimdi al",
      description:
        "Fiyat avantajı güçlü, güven yüksek ve risk düşük. Şu an almak mantıklı görünüyor.",
    };
  }

  if (opportunityScore >= 70 && riskScore < 55) {
    return {
      action: "watch",
      label: "Takip et",
      description:
        "Sinyaller olumlu ama karar vermeden önce birkaç gün daha izlemek mantıklı olabilir.",
    };
  }

  if (opportunityScore >= 55 && riskScore < 75) {
    return {
      action: "wait",
      label: "Bekle",
      description:
        "Şu an fırsat var ama risk de hissediliyor. Daha net fiyat sinyali beklemek daha dengeli olabilir.",
    };
  }

  return {
    action: "avoid",
    label: "Uzak dur",
    description:
      "Risk sinyalleri ağır basıyor. Daha iyi fiyat, daha güçlü güven veya daha temiz veri beklemek daha doğru.",
  };
}

function normalizeDuplicateDensity(
  duplicateItemCount: number | undefined,
  itemCount: number | undefined,
  fallback: number,
) {
  if (
    typeof duplicateItemCount !== "number" ||
    !Number.isFinite(duplicateItemCount) ||
    typeof itemCount !== "number" ||
    !Number.isFinite(itemCount) ||
    itemCount <= 0
  ) {
    return fallback;
  }

  return Math.max(0, Math.min(1, duplicateItemCount / itemCount));
}
