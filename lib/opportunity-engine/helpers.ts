import type { MarketIntelligence, MarketPriceAnalysis } from "@/lib/market-intelligence";
import { roundDecimal } from "@/lib/market-intelligence/helpers";
import type {
  OpportunityAnalysis,
  OpportunityDataFreshness,
  OpportunityJsonLdProperty,
  OpportunityLevel,
  OpportunityRecommendationAction,
} from "./types";

export const OPPORTUNITY_SCORE_VERSION = "opportunity-score-v1";

export function normalizeOpportunityTimestamp(value?: string | Date | null): string {
  if (!value) return new Date().toISOString();

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

export function resolveOpportunityDataFreshness(
  latestListingAt?: string | Date | null,
  scoreGeneratedAt?: string | Date | null,
): {
  dataFreshness: OpportunityDataFreshness;
  latestListingAgeDays: number | null;
} {
  if (!latestListingAt) {
    return { dataFreshness: "unknown", latestListingAgeDays: null };
  }

  const latestDate = latestListingAt instanceof Date
    ? latestListingAt
    : new Date(latestListingAt);
  const scoreDate = scoreGeneratedAt
    ? scoreGeneratedAt instanceof Date
      ? scoreGeneratedAt
      : new Date(scoreGeneratedAt)
    : new Date();

  if (Number.isNaN(latestDate.getTime()) || Number.isNaN(scoreDate.getTime())) {
    return { dataFreshness: "unknown", latestListingAgeDays: null };
  }

  const latestListingAgeDays = Math.max(
    0,
    Math.round((scoreDate.getTime() - latestDate.getTime()) / 86_400_000),
  );

  if (latestListingAgeDays <= 1) {
    return { dataFreshness: "fresh", latestListingAgeDays };
  }

  if (latestListingAgeDays <= 7) {
    return { dataFreshness: "recent", latestListingAgeDays };
  }

  return { dataFreshness: "stale", latestListingAgeDays };
}

export function calculatePriceAdvantagePercent(
  averagePrice: number | null | undefined,
  minPrice: number | null | undefined,
): number | null {
  if (
    typeof averagePrice !== "number" ||
    !Number.isFinite(averagePrice) ||
    averagePrice <= 0 ||
    typeof minPrice !== "number" ||
    !Number.isFinite(minPrice) ||
    minPrice <= 0
  ) {
    return null;
  }

  return roundDecimal(((averagePrice - minPrice) / averagePrice) * 100, 1);
}

export function calculateSourceConcentration(
  sourceBreakdown: MarketIntelligence["marketSummary"]["sourceBreakdown"],
): number | null {
  if (!sourceBreakdown.length) return null;

  const dominant = sourceBreakdown[0]?.share;
  if (typeof dominant !== "number" || !Number.isFinite(dominant)) return null;
  return roundDecimal(dominant, 3);
}

export function formatOpportunityLevel(level: OpportunityLevel) {
  if (level === "very-high") return "Çok yüksek";
  if (level === "high") return "Yüksek";
  if (level === "medium") return "Orta";
  if (level === "low") return "Düşük";
  return "Çok düşük";
}

export function formatOpportunityRecommendation(action: OpportunityRecommendationAction) {
  if (action === "buy_now") return "Şimdi al";
  if (action === "watch") return "Takip et";
  if (action === "wait") return "Bekle";
  if (action === "avoid") return "Uzak dur";
  return "Veri yetersiz";
}

export function formatOpportunityFreshness(freshness: OpportunityDataFreshness) {
  if (freshness === "fresh") return "Çok güncel";
  if (freshness === "recent") return "Güncel";
  if (freshness === "stale") return "Eski";
  return "Bilinmiyor";
}

export function dedupeOpportunityStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => (typeof value === "string" ? value.trim() : "")).filter(Boolean))];
}

export function buildOpportunityJsonLdProperties(
  analysis: OpportunityAnalysis,
  marketIntelligence: MarketIntelligence,
): OpportunityJsonLdProperty[] {
  const priceAnalysis = marketIntelligence.priceAnalysis;
  const priceAdvantagePercent = calculatePriceAdvantagePercent(
    priceAnalysis.averagePrice,
    priceAnalysis.minPrice,
  );

  const properties: OpportunityJsonLdProperty[] = [
    { "@type": "PropertyValue", name: "Opportunity score", value: analysis.opportunityScore },
    { "@type": "PropertyValue", name: "Opportunity level", value: formatOpportunityLevel(analysis.opportunityLevel) },
    { "@type": "PropertyValue", name: "Risk level", value: formatOpportunityLevel(analysis.riskLevel) },
    { "@type": "PropertyValue", name: "Recommendation", value: formatOpportunityRecommendation(analysis.recommendation.action) },
    { "@type": "PropertyValue", name: "Score generated at", value: analysis.scoreGeneratedAt },
    { "@type": "PropertyValue", name: "Score version", value: analysis.scoreVersion },
    { "@type": "PropertyValue", name: "Data freshness", value: formatOpportunityFreshness(analysis.dataFreshness) },
    { "@type": "PropertyValue", name: "Sample size", value: analysis.sampleSize },
    { "@type": "PropertyValue", name: "Confidence level", value: formatOpportunityLevel(analysis.confidenceLevel) },
    { "@type": "PropertyValue", name: "Confidence score", value: marketIntelligence.confidenceScore },
    { "@type": "PropertyValue", name: "Source count", value: marketIntelligence.marketSummary.sourceCount },
    { "@type": "PropertyValue", name: "Duplicate density", value: roundDecimal(marketIntelligence.marketSummary.duplicateDensity * 100, 1) },
  ];

  if (priceAdvantagePercent != null) {
    properties.push({
      "@type": "PropertyValue",
      name: "Price advantage percent",
      value: priceAdvantagePercent,
    });
  }

  if (priceAnalysis.priceSpreadPercent != null) {
    properties.push({
      "@type": "PropertyValue",
      name: "Price spread percent",
      value: priceAnalysis.priceSpreadPercent,
    });
  }

  if (analysis.positiveSignals.length > 0) {
    properties.push({
      "@type": "PropertyValue",
      name: "Positive signals",
      value: analysis.positiveSignals.join(", "),
    });
  }

  if (analysis.warningSignals.length > 0) {
    properties.push({
      "@type": "PropertyValue",
      name: "Warning signals",
      value: analysis.warningSignals.join(", "),
    });
  }

  if (analysis.reasons.length > 0) {
    properties.push({
      "@type": "PropertyValue",
      name: "Reasons",
      value: analysis.reasons.join(", "),
    });
  }

  return properties;
}
