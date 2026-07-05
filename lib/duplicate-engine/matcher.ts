import {
  calculateDuplicateScoreForInputs,
  compareMultiple,
  findBestMatch,
} from './engine';
import type { ConfidenceMetadata } from '../confidence-engine';
import type {
  ComparisonInput,
  DuplicateMatch,
  DuplicateGroup,
  DuplicateResult,
} from './types';

export function compareListings(
  listing1: ComparisonInput,
  listing2: ComparisonInput
): DuplicateResult {
  return calculateDuplicateScoreForInputs(listing1, listing2);
}

export function findDuplicateMatches(
  listings: Array<ComparisonInput & { id: string | number }>,
  scoreThreshold: number = 70
): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];

  for (let i = 0; i < listings.length; i++) {
    for (let j = i + 1; j < listings.length; j++) {
      const result = calculateDuplicateScoreForInputs(listings[i], listings[j]);

      if (result.score >= scoreThreshold) {
        matches.push({
          listing1Id: listings[i].id,
          listing2Id: listings[j].id,
          score: result.score,
          confidence: result.confidence,
          confidenceScore: result.confidenceScore,
          confidenceLevel: result.confidenceLevel,
          confidenceReasons: result.confidenceReasons,
        });
      }
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}

export function groupDuplicates(
  listings: Array<ComparisonInput & { id: string | number }>,
  scoreThreshold: number = 70
): DuplicateGroup[] {
  const matches = findDuplicateMatches(listings, scoreThreshold);
  const groups = new Map<string | number, Set<string | number>>();
  const assigned = new Set<string | number>();

  for (const match of matches) {
    const id1 = match.listing1Id;
    const id2 = match.listing2Id;

    if (!groups.has(id1)) groups.set(id1, new Set([id1]));
    if (!groups.has(id2)) groups.set(id2, new Set([id2]));

    const group1 = groups.get(id1)!;
    const group2 = groups.get(id2)!;

    const mergedGroup = new Set([...group1, ...group2]);
    mergedGroup.forEach((id) => groups.set(id, mergedGroup));
  }

  const uniqueGroups = new Map<Set<string | number>, Set<string | number>>();
  groups.forEach((group) => {
    if (!uniqueGroups.has(group)) {
      uniqueGroups.set(group, group);
    }
  });

  return Array.from(uniqueGroups.values())
    .filter((group) => group.size > 1)
    .map((groupIds) => {
      const groupListings = listings.filter((l) => groupIds.has(l.id));
      const canonical = groupListings[0];

      const duplicatesWithScores = groupListings.slice(1).map((listing) => {
        const result = calculateDuplicateScoreForInputs(canonical, listing);
        return {
          ...listing,
          score: result.score,
          confidence: result.confidence,
          confidenceScore: result.confidenceScore,
          confidenceLevel: result.confidenceLevel,
          confidenceReasons: result.confidenceReasons,
        };
      });

      return {
        canonical,
        duplicates: duplicatesWithScores,
      };
    });
}

export function getHighestScoringDuplicate(
  reference: ComparisonInput,
  candidates: Array<ComparisonInput & { id: string | number }>,
  threshold: number = 70
): (ComparisonInput & {
  id: string | number;
  score: number;
  confidence: 'same' | 'strong' | 'possible' | 'different';
}) & ConfidenceMetadata | null {
  const results = compareMultiple(reference, candidates);

  for (const result of results) {
    if (result.result.score >= threshold) {
      const candidate = candidates.find((c) => c.title === result.candidate.title);
      if (candidate) {
        return {
          ...candidate,
          score: result.result.score,
          confidence: result.result.confidence,
          confidenceScore: result.result.confidenceScore,
          confidenceLevel: result.result.confidenceLevel,
          confidenceReasons: result.result.confidenceReasons,
        };
      }
    }
  }

  return null;
}

export function filterByConfidence(
  matches: DuplicateMatch[],
  confidence: 'same' | 'strong' | 'possible' | 'different'
): DuplicateMatch[] {
  return matches.filter((m) => m.confidence === confidence);
}

export function getMatchesByScore(
  matches: DuplicateMatch[],
  minScore: number,
  maxScore?: number
): DuplicateMatch[] {
  return matches.filter(
    (m) => m.score >= minScore && (maxScore === undefined || m.score <= maxScore)
  );
}
