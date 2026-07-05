import { clampScore } from "@/lib/confidence-engine/scoring";
import type { OpportunitySignalContext } from "./types";
import {
  scoreOpportunityConfidence,
  scoreOpportunityDuplicateDensity,
  scoreOpportunityFreshness,
  scoreOpportunityPriceSpread,
  scoreOpportunitySampleSize,
  scoreOpportunitySourceCount,
} from "./scoring";

export function calculateOpportunityRiskScore(
  context: OpportunitySignalContext,
  opportunityScore: number,
): number {
  if (context.sampleSize <= 0) return 100;

  const sampleRisk = 100 - scoreOpportunitySampleSize(context.sampleSize);
  const confidenceRisk =
    100 - (scoreOpportunityConfidence(context.confidenceScore) ?? 50);
  const sourceRisk = 100 - scoreOpportunitySourceCount(context.sourceCount);
  const duplicateRisk = 100 - scoreOpportunityDuplicateDensity(context.duplicateDensity);
  const spreadRisk = 100 - (scoreOpportunityPriceSpread(context.priceSpreadPercent) ?? 50);
  const freshnessRisk = 100 - scoreOpportunityFreshness(context.dataFreshness);
  const baseRisk = 100 - opportunityScore;

  return clampScore(
    Math.round(
      baseRisk * 0.55 +
        sampleRisk * 0.16 +
        confidenceRisk * 0.1 +
        duplicateRisk * 0.08 +
        sourceRisk * 0.06 +
        spreadRisk * 0.03 +
        freshnessRisk * 0.02,
    ),
  );
}
