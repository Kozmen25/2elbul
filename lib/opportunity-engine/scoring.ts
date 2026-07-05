import { clampScore } from "@/lib/confidence-engine/scoring";
import type { OpportunityLevel, OpportunitySignalContext } from "./types";

export const OPPORTUNITY_LEVEL_THRESHOLDS = {
  veryHigh: 90,
  high: 75,
  medium: 60,
  low: 40,
} as const;

export function clampOpportunityScore(value: number) {
  return clampScore(value);
}

export function scoreOpportunityPriceAdvantage(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value >= 25) return 98;
  if (value >= 15) return 90;
  if (value >= 10) return 82;
  if (value >= 5) return 70;
  if (value >= 0) return 58;
  if (value >= -5) return 46;
  if (value >= -10) return 32;
  return 18;
}

export function scoreOpportunityConfidence(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value >= 95) return 98;
  if (value >= 85) return 90;
  if (value >= 70) return 78;
  if (value >= 50) return 62;
  if (value > 0) return 42;
  return 24;
}

export function scoreOpportunitySampleSize(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 50) return 98;
  if (value >= 20) return 94;
  if (value >= 10) return 84;
  if (value >= 5) return 70;
  if (value >= 4) return 58;
  if (value >= 3) return 46;
  if (value >= 2) return 30;
  return 16;
}

export function scoreOpportunitySourceCount(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 5) return 96;
  if (value >= 4) return 90;
  if (value >= 3) return 78;
  if (value >= 2) return 54;
  return 18;
}

export function scoreOpportunityDuplicateDensity(value: number) {
  if (!Number.isFinite(value)) return 50;
  if (value <= 0.02) return 96;
  if (value <= 0.05) return 92;
  if (value <= 0.1) return 84;
  if (value <= 0.2) return 66;
  if (value <= 0.35) return 44;
  return 18;
}

export function scoreOpportunityPriceSpread(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value <= 10) return 92;
  if (value <= 15) return 84;
  if (value <= 25) return 70;
  if (value <= 35) return 52;
  if (value <= 50) return 34;
  return 18;
}

export function scoreOpportunityDecisionEdge(
  buyScore: number | null | undefined,
  waitScore: number | null | undefined,
) {
  if (
    typeof buyScore !== "number" ||
    !Number.isFinite(buyScore) ||
    typeof waitScore !== "number" ||
    !Number.isFinite(waitScore)
  ) {
    return null;
  }

  const edge = buyScore - waitScore;
  if (edge >= 30) return 98;
  if (edge >= 20) return 88;
  if (edge >= 10) return 78;
  if (edge >= 0) return 62;
  if (edge >= -10) return 42;
  if (edge >= -20) return 26;
  return 14;
}

export function scoreOpportunityFreshness(value: OpportunitySignalContext["dataFreshness"]) {
  if (value === "fresh") return 94;
  if (value === "recent") return 78;
  if (value === "stale") return 42;
  return 50;
}

export function scoreOpportunityIntelligenceOpportunity(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value >= 90) return 95;
  if (value >= 75) return 84;
  if (value >= 60) return 70;
  if (value >= 45) return 56;
  if (value >= 30) return 40;
  return 24;
}

export function calculateOpportunityScore(context: OpportunitySignalContext): number {
  if (context.sampleSize <= 0) return 0;

  const weightedSignals: Array<[number | null, number]> = [
    [scoreOpportunityPriceAdvantage(context.priceAdvantagePercent), 0.22],
    [scoreOpportunityDecisionEdge(context.buyScore, context.waitScore), 0.18],
    [scoreOpportunityIntelligenceOpportunity(context.opportunityScoreFromIntelligence), 0.12],
    [scoreOpportunityConfidence(context.confidenceScore), 0.15],
    [scoreOpportunitySampleSize(context.sampleSize), 0.11],
    [scoreOpportunitySourceCount(context.sourceCount), 0.08],
    [scoreOpportunityDuplicateDensity(context.duplicateDensity), 0.08],
    [scoreOpportunityPriceSpread(context.priceSpreadPercent), 0.04],
    [scoreOpportunityFreshness(context.dataFreshness), 0.02],
  ];

  let weightedScore = 0;
  let appliedWeight = 0;

  for (const [value, weight] of weightedSignals) {
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    weightedScore += clampOpportunityScore(value) * weight;
    appliedWeight += weight;
  }

  if (appliedWeight === 0) return 0;
  return clampOpportunityScore(Math.round(weightedScore / appliedWeight));
}

export function toOpportunityLevel(score: number): OpportunityLevel {
  if (score >= OPPORTUNITY_LEVEL_THRESHOLDS.veryHigh) return "very-high";
  if (score >= OPPORTUNITY_LEVEL_THRESHOLDS.high) return "high";
  if (score >= OPPORTUNITY_LEVEL_THRESHOLDS.medium) return "medium";
  if (score >= OPPORTUNITY_LEVEL_THRESHOLDS.low) return "low";
  return "very-low";
}

export function toRiskLevel(score: number): OpportunityLevel {
  if (score >= OPPORTUNITY_LEVEL_THRESHOLDS.veryHigh) return "very-high";
  if (score >= OPPORTUNITY_LEVEL_THRESHOLDS.high) return "high";
  if (score >= OPPORTUNITY_LEVEL_THRESHOLDS.medium) return "medium";
  if (score >= OPPORTUNITY_LEVEL_THRESHOLDS.low) return "low";
  return "very-low";
}
