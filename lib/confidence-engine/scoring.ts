import type {
  ConfidenceLevel,
  ConfidenceSignalName,
  ConfidenceSignalScores,
} from "./types";

export const CONFIDENCE_SIGNAL_WEIGHTS: Record<ConfidenceSignalName, number> = {
  normalizationScore: 0.1,
  taxonomyScore: 0.08,
  brandScore: 0.1,
  modelScore: 0.15,
  storageScore: 0.1,
  ramScore: 0.08,
  variantScore: 0.05,
  duplicateScore: 0.14,
  priceConsistency: 0.06,
  titleSimilarity: 0.05,
  sourceCount: 0.04,
  sourceReliability: 0.05,
};

export const CONFIDENCE_LEVEL_THRESHOLDS = {
  veryHigh: 95,
  high: 85,
  medium: 70,
  low: 50,
} as const;

export function calculateConfidenceScore(
  signals: ConfidenceSignalScores,
): number {
  let weightedScore = 0;
  let appliedWeight = 0;

  const confidenceSignalNames = Object.keys(CONFIDENCE_SIGNAL_WEIGHTS).filter(
    (key): key is ConfidenceSignalName => key in CONFIDENCE_SIGNAL_WEIGHTS,
  );

  for (const key of confidenceSignalNames) {
    const weight = CONFIDENCE_SIGNAL_WEIGHTS[key];
    const value = signals[key];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    weightedScore += clampScore(value) * weight;
    appliedWeight += weight;
  }

  if (appliedWeight === 0) return 0;
  return clampScore(Math.round(weightedScore / appliedWeight));
}

export function calculateConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= CONFIDENCE_LEVEL_THRESHOLDS.veryHigh) return "very-high";
  if (score >= CONFIDENCE_LEVEL_THRESHOLDS.high) return "high";
  if (score >= CONFIDENCE_LEVEL_THRESHOLDS.medium) return "medium";
  if (score >= CONFIDENCE_LEVEL_THRESHOLDS.low) return "low";
  return "very-low";
}

export function clampScore(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}
