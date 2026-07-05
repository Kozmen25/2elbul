import type { MarketIntelligenceListing, MarketIntelligenceScope, MarketSummary } from "./types";
import type { DuplicateBatchSummary } from "@/lib/product-matcher";
import type { ProductIntelligence } from "@/lib/intelligence-engine";
import type { MarketIntelligenceDecisionInsight } from "./types";
import type { MarketPriceAnalysis } from "./types";
import { averageConfidenceScore, buildSourceBreakdown, formatCurrency, roundDecimal } from "./helpers";

type BuildMarketSummaryInput = {
  scope: MarketIntelligenceScope;
  listings: MarketIntelligenceListing[];
  priceAnalysis: MarketPriceAnalysis;
  intelligence?: ProductIntelligence | null;
  decisionInsight?: MarketIntelligenceDecisionInsight | null;
  duplicateSummary?: DuplicateBatchSummary | null;
};

export function buildMarketSummary({
  scope,
  listings,
  priceAnalysis,
  intelligence,
  decisionInsight,
  duplicateSummary,
}: BuildMarketSummaryInput): MarketSummary {
  const sourceBreakdown = buildSourceBreakdown(listings);
  const totalListingCount = priceAnalysis.listingCount;
  const activeListingCount = priceAnalysis.activeListingCount;
  const sourceCount = sourceBreakdown.length;
  const duplicateGroupCount = duplicateSummary?.groupCount ?? 0;
  const duplicatePairCount = duplicateSummary?.duplicatePairCount ?? 0;
  const duplicateItemCount = duplicateSummary?.duplicateItemCount ?? 0;
  const duplicateDensity =
    totalListingCount > 0
      ? roundDecimal(duplicateItemCount / totalListingCount, 3)
      : 0;
  const confidenceAverage = averageConfidenceScore([
    decisionInsight?.confidence?.score ?? null,
    ...listings.map((listing) => listing.confidenceScore ?? null),
  ]);

  if (!totalListingCount) {
    return {
      summary: `${scope.productName} için henüz yeterli ilan verisi bulunmuyor.`,
      highlights: [],
      warnings: ["Örneklem büyüklüğü yetersiz."],
      sourceBreakdown,
      totalListingCount,
      activeListingCount,
      sourceCount,
      duplicateGroupCount,
      duplicatePairCount,
      duplicateItemCount,
      duplicateDensity,
      confidenceAverage,
    };
  }

  const highlights = [
    priceAnalysis.averagePrice != null
      ? `Ortalama fiyat ${formatCurrency(priceAnalysis.averagePrice)}`
      : null,
    priceAnalysis.medianPrice != null
      ? `Medyan fiyat ${formatCurrency(priceAnalysis.medianPrice)}`
      : null,
    sourceCount > 0 ? `${sourceCount} farklı kaynak` : null,
    intelligence?.demand.demandLevel === "high"
      ? "Arama talebi yüksek"
      : intelligence?.demand.demandLevel === "medium"
        ? "Arama talebi dengeli"
        : null,
    intelligence?.trend.direction === "falling"
      ? "Fiyat trendi düşüyor"
      : intelligence?.trend.direction === "rising"
        ? "Fiyat trendi yükseliyor"
        : null,
    duplicateDensity > 0
      ? `Duplicate yoğunluğu %${roundDecimal(duplicateDensity * 100, 1)}`
      : null,
  ].filter((value): value is string => Boolean(value));

  const warnings = [
    totalListingCount < 3 ? "Örneklem küçük." : null,
    sourceCount <= 1 ? "Tek kaynak baskın görünüyor." : null,
    priceAnalysis.priceSpreadPercent != null && priceAnalysis.priceSpreadPercent >= 40
      ? "Fiyat bandı geniş."
      : null,
    duplicateDensity >= 0.25 ? "Duplicate yoğunluğu yüksek." : null,
    confidenceAverage != null && confidenceAverage < 70
      ? "Ortalama güven seviyesi düşük."
      : null,
    intelligence?.decisionSupport.volatilityLevel === "high"
      ? "Volatilite yüksek."
      : null,
  ].filter((value): value is string => Boolean(value));

  const summaryParts = [
    `${scope.productName} için ${totalListingCount} ilan`,
    sourceCount > 0 ? `${sourceCount} kaynak` : null,
    priceAnalysis.averagePrice != null
      ? `ortalama ${formatCurrency(priceAnalysis.averagePrice)}`
      : null,
  ].filter((value): value is string => Boolean(value));

  return {
    summary: `${summaryParts.join(", ")} ile piyasa resmi çıkarıldı.`,
    highlights,
    warnings,
    sourceBreakdown,
    totalListingCount,
    activeListingCount,
    sourceCount,
    duplicateGroupCount,
    duplicatePairCount,
    duplicateItemCount,
    duplicateDensity,
    confidenceAverage,
  };
}
