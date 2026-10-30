import type { DuplicateBatchSummary } from "@/lib/product-matcher/types";

// Read side of duplicate groups: one entry per group, in front of the user.
//
// The cheapest listing of a group represents it; the other platforms stay
// visible as "also on" so nothing about where the item is sold is lost, and
// anything that counts or averages listings counts the group once.

export type CollapsibleListing = {
  id: string;
  price: number;
  source: string;
  url: string;
  createdAt: string;
  duplicateGroupId?: string | null;
};

export type AlsoListedOn = {
  id: string;
  source: string;
  price: number;
  url: string;
};

export type CollapsedListing<T extends CollapsibleListing> = T & { alsoOn: AlsoListedOn[] };

function isBetterRepresentative(candidate: CollapsibleListing, current: CollapsibleListing): boolean {
  if (candidate.price !== current.price) return candidate.price < current.price;
  // Same price: the older listing is the original.
  return candidate.createdAt < current.createdAt || (candidate.createdAt === current.createdAt && candidate.id < current.id);
}

/**
 * Keeps one listing per duplicate group (the cheapest) and attaches the others
 * as `alsoOn`, cheapest first. Listings without a group pass through with an
 * empty `alsoOn`. The input order is preserved for the kept listings.
 */
export function collapseDuplicateListings<T extends CollapsibleListing>(listings: T[]): CollapsedListing<T>[] {
  const best = new Map<string, T>();
  for (const listing of listings) {
    const group = listing.duplicateGroupId;
    if (!group) continue;
    const current = best.get(group);
    if (!current || isBetterRepresentative(listing, current)) best.set(group, listing);
  }

  const result: CollapsedListing<T>[] = [];
  for (const listing of listings) {
    const group = listing.duplicateGroupId;
    if (!group) {
      result.push({ ...listing, alsoOn: [] });
      continue;
    }
    if (best.get(group) !== listing) continue;
    const alsoOn = listings
      .filter((other) => other.duplicateGroupId === group && other !== listing)
      .sort((a, b) => a.price - b.price || a.id.localeCompare(b.id))
      .map(({ id, source, price, url }) => ({ id, source, price, url }));
    result.push({ ...listing, alsoOn });
  }
  return result;
}

/** Duplicate groups are decided by explicit rules, all of which must hold. */
const RULE_BASED_THRESHOLD = 100;
const TOP_GROUP_COUNT = 3;
const SAMPLE_TITLE_COUNT = 3;

/**
 * The batch summary (duplicate density, group counts) read from the stored
 * groups, so confidence and opportunity scores are based on the same
 * duplicates the page actually collapses.
 */
export function summarizeStoredDuplicateGroups(
  listings: Array<CollapsibleListing & { title: string }>,
): DuplicateBatchSummary {
  const groups = new Map<string, Array<CollapsibleListing & { title: string }>>();
  for (const listing of listings) {
    if (!listing.duplicateGroupId) continue;
    const members = groups.get(listing.duplicateGroupId) ?? [];
    members.push(listing);
    groups.set(listing.duplicateGroupId, members);
  }
  const duplicateGroups = [...groups.entries()]
    .filter(([, members]) => members.length > 1)
    .map(([groupId, members]) => ({ groupId, members: [...members].sort((a, b) => a.price - b.price || a.id.localeCompare(b.id)) }));

  const groupedItemCount = duplicateGroups.reduce((total, group) => total + group.members.length, 0);

  return {
    threshold: RULE_BASED_THRESHOLD,
    itemCount: listings.length,
    // Every duplicate group is one entry, every other listing is its own entry.
    groupCount: listings.length - groupedItemCount + duplicateGroups.length,
    matchedGroupCount: duplicateGroups.length,
    duplicatePairCount: duplicateGroups.reduce((total, group) => total + group.members.length - 1, 0),
    duplicateItemCount: groupedItemCount,
    maxGroupSize: duplicateGroups.reduce((max, group) => Math.max(max, group.members.length), 0),
    topGroups: duplicateGroups
      .sort((a, b) => b.members.length - a.members.length || a.members[0].title.localeCompare(b.members[0].title, "tr"))
      .slice(0, TOP_GROUP_COUNT)
      .map((group) => ({
        canonicalId: group.groupId,
        canonicalTitle: group.members[0].title,
        duplicateCount: group.members.length - 1,
        maxScore: RULE_BASED_THRESHOLD,
        sampleTitles: group.members.slice(1, 1 + SAMPLE_TITLE_COUNT).map((member) => member.title),
      })),
  };
}
