import type { ConfidenceResult } from "@/lib/confidence-engine";
import { clampScore } from "@/lib/confidence-engine/scoring";
import type { ProductIntelligence } from "@/lib/intelligence-engine";
import type {
  MarketIntelligence,
  MarketIntelligenceInput,
  MarketIntelligenceJsonLd,
  MarketIntelligenceJsonLdProperty,
  MarketIntelligenceDecisionInsight,
} from "./types";
import { buildMarketPriceAnalysis } from "./price-analysis";
import { buildMarketSummary } from "./market-summary";
import { buildMarketOpportunity } from "./opportunity";
import {
  normalizeAnalysisTimestamp,
  toConfidenceLevel,
  roundDecimal,
} from "./helpers";

export function buildMarketIntelligence(
  input: MarketIntelligenceInput,
): MarketIntelligence {
  const analysisGeneratedAt = normalizeAnalysisTimestamp(input.analyzedAt);
  const priceAnalysis = buildMarketPriceAnalysis(input.listings);
  const marketSummary = buildMarketSummary({
    scope: input.scope,
    listings: input.listings,
    priceAnalysis,
    intelligence: input.intelligence ?? null,
    decisionInsight: input.decisionInsight ?? null,
    duplicateSummary: input.duplicateSummary ?? null,
  });
  const sourcesUsed = marketSummary.sourceBreakdown.map((entry) => entry.source);
  const confidence = buildMarketConfidence({
    intelligence: input.intelligence ?? null,
    decisionInsight: input.decisionInsight ?? null,
    priceAnalysis,
    sourcesUsed,
    duplicateDensity: marketSummary.duplicateDensity,
    sourceCount: marketSummary.sourceCount,
  });
  const opportunity = buildMarketOpportunity({
    priceAnalysis,
    intelligence: input.intelligence ?? null,
    decisionInsight: input.decisionInsight ?? null,
    confidenceScore: confidence.score,
  });
  const structuredData = buildMarketIntelligenceJsonLd({
    scope: input.scope,
    analysisGeneratedAt,
    priceAnalysis,
    marketSummary,
    confidence,
    sourcesUsed,
  });

  return {
    scope: input.scope,
    analysisGeneratedAt,
    sampleSize: priceAnalysis.sampleSize,
    confidenceScore: confidence.score,
    confidenceLevel: confidence.level,
    confidenceReasons: confidence.reasons,
    sourcesUsed,
    priceAnalysis,
    marketSummary,
    opportunity,
    structuredData,
  };
}

export function buildMarketIntelligenceJsonLd({
  scope,
  analysisGeneratedAt,
  priceAnalysis,
  marketSummary,
  confidence,
  sourcesUsed,
}: {
  scope: MarketIntelligenceInput["scope"];
  analysisGeneratedAt: string;
  priceAnalysis: MarketIntelligence["priceAnalysis"];
  marketSummary: MarketIntelligence["marketSummary"];
  confidence: ConfidenceResult;
  sourcesUsed: string[];
}): MarketIntelligenceJsonLd {
  const property = (
    name: string,
    value: string | number,
  ): MarketIntelligenceJsonLdProperty => ({
    "@type": "PropertyValue",
    name,
    value,
  });
  const additionalProperty = [
    property("Analysis generated at", analysisGeneratedAt),
    property("Sample size", priceAnalysis.sampleSize),
    property("Total listings", marketSummary.totalListingCount),
    property("Active listings", marketSummary.activeListingCount),
    property("Source count", marketSummary.sourceCount),
    property("Average price", priceAnalysis.averagePrice ?? 0),
    property("Median price", priceAnalysis.medianPrice ?? 0),
    property("Minimum price", priceAnalysis.minPrice ?? 0),
    property("Maximum price", priceAnalysis.maxPrice ?? 0),
    property("Price range", priceAnalysis.priceRange ?? 0),
    property("Price spread percent", priceAnalysis.priceSpreadPercent ?? 0),
    property("Confidence score", confidence.score),
    property("Confidence level", confidence.level),
    property("Duplicate density", roundDecimal(marketSummary.duplicateDensity * 100, 1)),
    property("Duplicate group count", marketSummary.duplicateGroupCount),
    property("Duplicate pair count", marketSummary.duplicatePairCount),
    property("Sources used", sourcesUsed.join(", ") || "—"),
  ];

  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `${scope.productName} market intelligence`,
    description: marketSummary.summary,
    url: scope.url,
    about: {
      "@type": "Product",
      name: scope.productName,
      category: scope.category ?? undefined,
      ...(scope.brand
        ? {
            brand: {
              "@type": "Brand",
              name: scope.brand,
            },
          }
        : {}),
    },
    additionalProperty,
  };
}

function buildMarketConfidence({
  intelligence,
  decisionInsight,
  priceAnalysis,
  sourcesUsed,
  duplicateDensity,
  sourceCount,
}: {
  intelligence: ProductIntelligence | null;
  decisionInsight: MarketIntelligenceDecisionInsight | null;
  priceAnalysis: ReturnType<typeof buildMarketPriceAnalysis>;
  sourcesUsed: string[];
  duplicateDensity: number;
  sourceCount: number;
}): ConfidenceResult {
  const decisionConfidence = decisionInsight?.confidence ?? null;
  const baseScore =
    decisionConfidence?.score ??
    (priceAnalysis.sampleSize > 0 ? 52 : 0);
  const sourceBonus =
    sourceCount >= 3 ? 8 : sourceCount === 2 ? 4 : sourceCount === 1 ? 2 : 0;
  const sampleBonus =
    priceAnalysis.sampleSize >= 10
      ? 8
      : priceAnalysis.sampleSize >= 5
        ? 4
        : priceAnalysis.sampleSize >= 3
          ? 2
          : 0;
  const duplicatePenalty =
    duplicateDensity >= 0.25 ? 14 : duplicateDensity >= 0.1 ? 8 : 0;
  const spreadPenalty =
    priceAnalysis.priceSpreadPercent == null
      ? 0
      : priceAnalysis.priceSpreadPercent >= 50
        ? 10
        : priceAnalysis.priceSpreadPercent >= 30
          ? 5
          : 0;
  const demandBonus =
    intelligence?.demand.demandLevel === "high"
      ? 3
      : intelligence?.demand.demandLevel === "medium"
        ? 1
        : 0;

  const score = clampScore(
    baseScore + sourceBonus + sampleBonus + demandBonus - duplicatePenalty - spreadPenalty,
  );

  const reasons = [
    ...(decisionConfidence?.reasons ?? []),
    priceAnalysis.sampleSize >= 10
      ? "Örneklem güçlü"
      : priceAnalysis.sampleSize >= 3
        ? "Örneklem yeterli"
        : "Örneklem sınırlı",
    sourceCount >= 3
      ? `${sourceCount} farklı kaynak doğruladı`
      : sourceCount === 2
        ? "İki kaynak doğruladı"
        : sourceCount === 1
          ? "Tek kaynak"
          : "Kaynak bilgisi yok",
    duplicateDensity > 0
      ? `Duplicate yoğunluğu %${roundDecimal(duplicateDensity * 100, 1)}`
      : "Duplicate yoğunluğu düşük",
    priceAnalysis.priceSpreadPercent != null && priceAnalysis.priceSpreadPercent <= 15
      ? "Fiyat bandı dengeli"
      : priceAnalysis.priceSpreadPercent != null && priceAnalysis.priceSpreadPercent >= 40
        ? "Fiyat bandı geniş"
        : "Fiyat bandı normal",
    ...(
      sourcesUsed.length > 0 && sourceCount >= 3
        ? ["Kaynak çeşitliliği yüksek"]
        : []
    ),
  ].filter(Boolean);

  return {
    score,
    level: toConfidenceLevel(score),
    reasons: [...new Set(reasons)].slice(0, 5),
    signals: decisionConfidence?.signals ?? {},
  };
}
