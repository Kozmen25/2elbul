import { calculateConfidence } from "./engine";
import type { ConfidenceResult } from "./types";
import { scoreSourceCount } from "./helpers";

type ProductUnderstandingConfidenceInput = {
  decisionConfidence: ConfidenceResult | null;
  productUnderstandingScore: number | null;
  sourceCount: number;
  sourcesUsed: string[];
};

/**
 * Thin wrapper that bridges market-intelligence data into the real ConfidenceEngine.
 * Uses PUE's productUnderstandingScore (weight 0.18) as the primary signal,
 * passes through decision insight signals, and computes a proper weighted score.
 */
export function calculateProductUnderstandingConfidence(
  input: ProductUnderstandingConfidenceInput,
): ConfidenceResult {
  const baseSignals = input.decisionConfidence?.signals ?? {};

  return calculateConfidence({
    signals: {
      ...baseSignals,
      sourceCount: scoreSourceCount(input.sourceCount),
      productUnderstandingScore:
        typeof input.productUnderstandingScore === "number" &&
        Number.isFinite(input.productUnderstandingScore)
          ? input.productUnderstandingScore
          : (baseSignals.productUnderstandingScore ?? null),
    },
    context: {
      sourceNames: input.sourcesUsed.length > 0 ? input.sourcesUsed : undefined,
    },
  });
}
