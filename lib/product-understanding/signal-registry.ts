import { ProductType, ProductTypeSignal } from "./types";

/**
 * 8 weighted signals for product-type detection.
 * Uses same multi-signal fusion pattern as inferCondition().
 */
export const PRODUCT_SIGNAL_WEIGHTS: Record<ProductTypeSignal["signal"], number> = {
  patternMatch: 0.35,
  priceSignal: 0.15,
  categorySignal: 0.15,
  sourceSignal: 0.10,
  titleStructure: 0.10,
  sellerSignal: 0.05,
  descriptionSignal: 0.05,
  compatibleDeviceSignal: 0.05,
};

/**
 * Fusion algorithm — same pattern as inferCondition():
 * 1. Group non-zero signals by their chosen value
 * 2. Weighted average per group
 * 3. Gap ≥ 15 → clear winner
 * 4. Else → highest-confidence value wins with -10 penalty
 * 5. Else → primary_product with confidence 50
 */
export function fuseProductTypeSignals(
  signals: ProductTypeSignal[],
): { value: ProductType; confidence: number } {
  const active = signals.filter((s) => s.weight > 0 && s.confidence > 0);
  if (active.length === 0) {
    return { value: "primary_product", confidence: 50 };
  }

  // Group by value, compute weighted average
  const groups = new Map<ProductType, { totalWeight: number; weightedConfidence: number }>();
  for (const s of active) {
    const existing = groups.get(s.value) ?? {
      totalWeight: 0,
      weightedConfidence: 0,
    };
    existing.totalWeight += s.weight;
    existing.weightedConfidence += s.weight * s.confidence;
    groups.set(s.value, existing);
  }

  // Build sorted candidates
  const candidates = Array.from(groups.entries())
    .map(([value, g]) => ({
      value,
      confidence: g.weightedConfidence / g.totalWeight,
      totalWeight: g.totalWeight,
    }))
    .sort((a, b) => b.confidence - a.confidence);

  if (candidates.length === 0) {
    return { value: "primary_product", confidence: 50 };
  }

  // Single candidate
  if (candidates.length === 1) {
    return { value: candidates[0].value, confidence: Math.round(candidates[0].confidence) };
  }

  // Gap ≥ 15 → clear winner
  if (candidates[0].confidence - candidates[1].confidence >= 15) {
    return { value: candidates[0].value, confidence: Math.round(candidates[0].confidence) };
  }

  // Tie-break: highest-confidence individual signal wins with -10 penalty
  const bestSignal = active.sort((a, b) => b.confidence - a.confidence)[0];
  return {
    value: bestSignal.value,
    confidence: Math.max(50, Math.round(bestSignal.confidence - 10)),
  };
}
