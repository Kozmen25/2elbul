import type { OpportunitySignalContext } from "./types";
import { dedupeOpportunityStrings } from "./helpers";

export function buildPositiveSignals(context: OpportunitySignalContext) {
  const signals: string[] = [];

  if (context.priceAdvantagePercent != null && context.priceAdvantagePercent >= 20) {
    signals.push(`Piyasanın %${formatPercent(context.priceAdvantagePercent)} altında`);
  } else if (context.priceAdvantagePercent != null && context.priceAdvantagePercent >= 10) {
    signals.push(`Piyasanın %${formatPercent(context.priceAdvantagePercent)} altında`);
  } else if (context.priceAdvantagePercent != null && context.priceAdvantagePercent > 0) {
    signals.push("Fiyat ortalamanın altında");
  }

  if (context.confidenceLevel === "very-high") {
    signals.push("Confidence çok yüksek");
  } else if (context.confidenceLevel === "high") {
    signals.push("Confidence yüksek");
  }

  if (context.sampleSize >= 50) {
    signals.push(`${context.sampleSize} ilan analiz edildi`);
  } else if (context.sampleSize >= 20) {
    signals.push(`${context.sampleSize} ilan analiz edildi`);
  } else if (context.sampleSize >= 10) {
    signals.push(`${context.sampleSize} ilan analiz edildi`);
  }

  if (context.sourceCount >= 3) {
    signals.push(`${context.sourceCount} farklı kaynak doğruladı`);
  }

  if (context.duplicateDensity < 0.1) {
    signals.push("Duplicate yoğunluğu düşük");
  }

  if (context.priceSpreadPercent != null && context.priceSpreadPercent <= 15) {
    signals.push("Fiyat bandı dengeli");
  }

  if (context.dataFreshness === "fresh") {
    signals.push("Veri çok güncel");
  } else if (context.dataFreshness === "recent") {
    signals.push("Veri güncel");
  }

  if (context.buyScore != null && context.waitScore != null && context.buyScore >= context.waitScore) {
    signals.push("Buy score, wait score'un üstünde");
  }

  if (context.trendDirection === "falling") {
    signals.push("Trend düşüyor");
  }

  return dedupeOpportunityStrings(signals);
}

export function buildWarningSignals(context: OpportunitySignalContext) {
  const signals: string[] = [];

  if (context.sampleSize < 3) {
    signals.push("Örneklem küçük");
  }

  if (context.confidenceLevel === "low" || context.confidenceLevel === "very-low") {
    signals.push("Confidence düşük");
  }

  if (context.sourceCount <= 1) {
    signals.push("Tek kaynak");
  }

  if (context.duplicateDensity >= 0.2) {
    signals.push("Duplicate yoğunluğu yüksek");
  }

  if (context.priceSpreadPercent != null && context.priceSpreadPercent >= 35) {
    signals.push("Fiyat bandı geniş");
  }

  if (context.dataFreshness === "stale") {
    signals.push("Veri eski");
  }

  if (context.priceAdvantagePercent != null && context.priceAdvantagePercent < 0) {
    signals.push("İlan ortalamanın üstünde");
  }

  if (context.buyScore != null && context.waitScore != null && context.waitScore > context.buyScore) {
    signals.push("Bekleme sinyali güçlü");
  }

  if (context.trendDirection === "rising") {
    signals.push("Trend yükseliyor");
  }

  if (context.demandLevel === "low") {
    signals.push("Talep zayıf");
  }

  return dedupeOpportunityStrings(signals);
}

export function buildOpportunityReasons(
  opportunityScore: number,
  riskScore: number,
  positiveSignals: string[],
  warningSignals: string[],
) {
  const ordered =
    opportunityScore >= riskScore
      ? [...positiveSignals, ...warningSignals]
      : [...warningSignals, ...positiveSignals];

  return dedupeOpportunityStrings(ordered).slice(0, 5);
}

function formatPercent(value: number) {
  return Math.abs(Math.round(value));
}
