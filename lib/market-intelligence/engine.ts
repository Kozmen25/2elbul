import type { ConfidenceResult } from "@/lib/confidence-engine";
import { calculateProductUnderstandingConfidence } from "@/lib/confidence-engine/product-understanding-confidence";
import type {
  MarketIntelligence,
  MarketIntelligenceInput,
  MarketIntelligenceJsonLd,
  MarketIntelligenceJsonLdProperty,
  MarketOpportunity,
} from "./types";
import { buildMarketPriceAnalysis } from "./price-analysis";
import { buildMarketSummary } from "./market-summary";
import {
  normalizeAnalysisTimestamp,
  roundDecimal,
  filterListingsByProductType,
} from "./helpers";
import { buildOpportunityAnalysis } from "@/lib/opportunity-engine";

export function buildMarketIntelligence(
  input: MarketIntelligenceInput,
): MarketIntelligence {
  const analysisGeneratedAt = normalizeAnalysisTimestamp(input.analyzedAt);

  // Centralized productType partition — every aggregation downstream sees only
  // listings matching the expected productType. This prevents cross-type
  // contamination (e.g. phone accessories polluting phone market averages).
  // Requires a productLookup to resolve productType from PUE attributes;
  // when unavailable (legacy callers, tests), all listings pass through.
  const filteredListings = input.productLookup
    ? filterListingsByProductType(
        input.listings,
        input.expectedProductType ?? input.scope.productType ?? null,
        input.productLookup,
      )
    : input.listings;

  const priceAnalysis = buildMarketPriceAnalysis(filteredListings);
  const marketSummary = buildMarketSummary({
    scope: input.scope,
    listings: filteredListings,
    priceAnalysis,
    intelligence: input.intelligence ?? null,
    decisionInsight: input.decisionInsight ?? null,
    duplicateSummary: input.duplicateSummary ?? null,
  });
  const sourcesUsed = marketSummary.sourceBreakdown.map((entry) => entry.source);

  // Extract PUE confidence score from attributes when available
  const attrs = input.attributes as Record<string, unknown> | null;
  const pu = attrs?.productUnderstanding as Record<string, unknown> | null;
  const puTypeConfidence = pu?.productType as { confidence?: number } | null;
  const productUnderstandingScore =
    typeof puTypeConfidence?.confidence === "number" && Number.isFinite(puTypeConfidence.confidence)
      ? puTypeConfidence.confidence / 100
      : null;

  const confidence = calculateProductUnderstandingConfidence({
    decisionConfidence: input.decisionInsight?.confidence ?? null,
    productUnderstandingScore,
    sourceCount: marketSummary.sourceCount,
    sourcesUsed,
  });

  // Wire opportunity engine when sufficient data exists
  const sampleSize = priceAnalysis.sampleSize;
  const confidenceScore = confidence.score;
  let opportunity: MarketOpportunity;
  if (sampleSize >= 3 && confidenceScore > 0) {
    const opportunityAnalysis = buildOpportunityAnalysis({
      marketIntelligence: {
        scope: input.scope,
        analysisGeneratedAt,
        sampleSize,
        confidenceScore,
        confidenceLevel: confidence.level,
        confidenceReasons: confidence.reasons,
        sourcesUsed,
        priceAnalysis,
        marketSummary,
        opportunity: {
          score: 0,
          label: "Veri yetersiz",
          explanation: "Opportunity Engine üzerinden hesaplanıyor",
          action: "wait",
          discountPercent: null,
        },
        structuredData: {} as MarketIntelligenceJsonLd,
      },
      intelligence: input.intelligence ?? null,
      duplicateSummary: input.duplicateSummary ?? null,
      analyzedAt: input.analyzedAt,
      latestListingAt: null,
    });
    opportunity = {
      score: opportunityAnalysis.opportunityScore,
      label: opportunityAnalysis.recommendation.action === "buy_now"
        ? "Güçlü fırsat" as const
        : opportunityAnalysis.recommendation.action === "watch"
          ? "Takip etmeye değer" as const
          : opportunityAnalysis.recommendation.action === "avoid"
            ? "Dikkatli incele" as const
            : opportunityAnalysis.recommendation.action === "insufficient_data"
              ? "Veri yetersiz" as const
              : "Normal piyasa" as const,
      explanation: opportunityAnalysis.recommendation.description,
      action: opportunityAnalysis.recommendation.action === "avoid"
        ? "wait" as const
        : opportunityAnalysis.recommendation.action,
      discountPercent: null,
    };
  } else {
    opportunity = {
      score: 0,
      label: "Veri yetersiz",
      explanation: "Opportunity Engine üzerinden hesaplanıyor",
      action: "wait",
      discountPercent: null,
    };
  }

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
    sampleSize,
    confidenceScore,
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
