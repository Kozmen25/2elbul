import type { DuplicateBatchSummary, GroupedListingDuplicates } from "./types";

export function summarizeDuplicateGroups(
  grouped: GroupedListingDuplicates,
  itemCount: number,
  threshold: number = 70,
): DuplicateBatchSummary {
  const duplicatePairCount = grouped.groups.reduce(
    (total, group) => total + group.duplicates.length,
    0,
  );
  const duplicateItemCount = grouped.groups.reduce(
    (total, group) => total + group.duplicates.length + 1,
    0,
  );
  const maxGroupSize = grouped.groups.reduce(
    (max, group) => Math.max(max, group.duplicates.length + 1),
    0,
  );

  const topGroups = grouped.groups
    .map((group) => {
      const duplicateCount = group.duplicates.length;
      const maxScore =
        duplicateCount > 0
          ? Math.max(...group.duplicates.map((candidate) => candidate.score))
          : 0;

      return {
        canonicalId: group.canonical.title,
        canonicalTitle: group.canonical.title,
        duplicateCount,
        maxScore,
        sampleTitles: group.duplicates.slice(0, 3).map((candidate) => candidate.title),
      };
    })
    .sort(
      (a, b) =>
        b.duplicateCount - a.duplicateCount ||
        b.maxScore - a.maxScore ||
        a.canonicalTitle.localeCompare(b.canonicalTitle, "tr"),
    )
    .slice(0, 3);

  return {
    threshold,
    itemCount,
    groupCount: grouped.count,
    matchedGroupCount: grouped.matchedCount,
    duplicatePairCount,
    duplicateItemCount,
    maxGroupSize,
    topGroups,
  };
}
