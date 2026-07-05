import type { DuplicateMatch } from "@/lib/duplicate-engine/types";
import {
  createComparisonInput,
  compareListings,
  groupDuplicates as groupDuplicatesEngine,
} from "@/lib/duplicate-engine";
import type {
  ComparisonListing,
  GroupedListingDuplicates,
  ListingDuplicateDetectionResult,
} from "./types";

export function detectListingDuplicates(
  reference: ComparisonListing,
  candidates: ComparisonListing[],
  threshold: number = 70,
): ListingDuplicateDetectionResult {
  const refInput = createComparisonInput(reference.title, {
    price: reference.price,
    sourceId: 1,
    condition: reference.condition,
  });

  const matches: DuplicateMatch[] = [];

  for (const candidate of candidates) {
    const candInput = createComparisonInput(candidate.title, {
      price: candidate.price,
      sourceId: 2,
      condition: candidate.condition,
    });

    const result = compareListings(refInput, candInput);
    if (result.score >= threshold) {
      matches.push({
        listing1Id: reference.id,
        listing2Id: candidate.id,
        score: result.score,
        confidence: result.confidence,
        confidenceScore: result.confidenceScore,
        confidenceLevel: result.confidenceLevel,
        confidenceReasons: result.confidenceReasons,
      });
    }
  }

  const bestMatch = matches.reduce<DuplicateMatch | null>(
    (best, match) => {
      if (!best) return match;
      return match.score > best.score ? match : best;
    },
    null,
  );
  const maxScore = bestMatch?.score ?? 0;

  return {
    listing: reference,
    duplicates: matches,
    isDuplicate: maxScore >= threshold,
    confidenceScore: bestMatch?.confidenceScore ?? maxScore,
    suggestion: maxScore >= threshold ? "match" : maxScore >= 50 ? "review" : "none",
  };
}

export function groupListingDuplicates(
  listings: ComparisonListing[],
  threshold: number = 70,
): GroupedListingDuplicates {
  const inputs = listings.map((l) => ({
    ...createComparisonInput(l.title, {
      price: l.price,
      sourceId: 1,
      condition: l.condition,
    }),
    id: l.id,
  }));

  const groups = groupDuplicatesEngine(inputs, threshold);

  return {
    groups,
    count: groups.length,
    matchedCount: groups.filter((g) => g.duplicates.length > 0).length,
  };
}
