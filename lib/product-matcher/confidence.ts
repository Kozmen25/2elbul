import type { ConfidenceMetadata } from "@/lib/confidence-engine";
import {
  buildProductMatcherConfidenceInput,
  calculateConfidence,
  toConfidenceMetadata,
} from "@/lib/confidence-engine";
import type { ProductSignals } from "./types";

export function buildProductConfidenceMetadata(
  signals: ProductSignals,
  input: {
    normalizedTitle: string;
    canonicalTitle: string;
    source?: string | null;
    category?: string | null;
  },
): ConfidenceMetadata {
  const confidence = calculateConfidence(
    buildProductMatcherConfidenceInput({
      signals,
      normalizedTitle: input.normalizedTitle,
      canonicalTitle: input.canonicalTitle,
      sourceName: input.source ?? null,
      categoryConfidence: input.category ? "medium" : null,
    }),
  );

  return toConfidenceMetadata(confidence);
}
