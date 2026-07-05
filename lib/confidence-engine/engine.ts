import type { ConfidenceInput, ConfidenceResult } from "./types";
import { calculateConfidenceLevel, calculateConfidenceScore } from "./scoring";
import { buildConfidenceReasons } from "./helpers";

export function calculateConfidence(input: ConfidenceInput): ConfidenceResult {
  const resolvedSignals = { ...input.signals };
  const score = calculateConfidenceScore(resolvedSignals);
  const level = calculateConfidenceLevel(score);
  const provisional: ConfidenceResult = {
    score,
    level,
    reasons: [],
    signals: resolvedSignals,
  };
  const reasons = buildConfidenceReasons(provisional, input.context);

  return {
    ...provisional,
    reasons,
  };
}

