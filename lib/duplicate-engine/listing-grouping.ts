import { compareListingIdentity, fingerprintListing, type IdentityListing } from "./listing-identity";

// Turns the pairwise rules of listing-identity into groups for ONE product.
//
// Complete linkage: a listing joins a group only if it matches EVERY member,
// so a chain A~B, B~C can never pull in a C that does not match A. A group
// holds at most one listing per source (a platform does not list the same
// item twice). Listings are visited cheapest first, so the result does not
// depend on the order they came in.

export type GroupableListing = IdentityListing & {
  /** The group id stored on the listing today, if any. */
  duplicateGroupId?: string | null;
};

/** listing id -> group id; listings without a duplicate map to null. */
export type GroupAssignment = Map<string, string | null>;

export function assignDuplicateGroups(
  listings: GroupableListing[],
  createGroupId: () => string = () => crypto.randomUUID(),
): GroupAssignment {
  const ordered = [...listings].sort((a, b) => a.price - b.price || a.id.localeCompare(b.id));
  const fingerprints = new Map(ordered.map((listing) => [listing.id, fingerprintListing(listing)]));

  const groups: GroupableListing[][] = [];
  for (const listing of ordered) {
    const home = groups.find((members) =>
      members.every(
        (member) =>
          compareListingIdentity(member, listing, {
            a: fingerprints.get(member.id)!,
            b: fingerprints.get(listing.id)!,
          }).same,
      ),
    );
    if (home) home.push(listing);
    else groups.push([listing]);
  }

  const assignment: GroupAssignment = new Map(listings.map((listing) => [listing.id, null]));
  const claimed = new Set<string>();

  // Larger groups pick their id first; each existing id is reused at most once.
  const duplicates = groups.filter((members) => members.length > 1).sort((a, b) => b.length - a.length);
  for (const members of duplicates) {
    const groupId = pickExistingGroupId(members, claimed) ?? createGroupId();
    claimed.add(groupId);
    for (const member of members) assignment.set(member.id, groupId);
  }

  return assignment;
}

/** The most common stored group id among the members that nobody else took yet. */
function pickExistingGroupId(members: GroupableListing[], claimed: Set<string>): string | null {
  const votes = new Map<string, number>();
  for (const member of members) {
    const id = member.duplicateGroupId;
    if (id && !claimed.has(id)) votes.set(id, (votes.get(id) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestVotes = 0;
  for (const [id, count] of votes) {
    if (count > bestVotes) {
      best = id;
      bestVotes = count;
    }
  }
  return best;
}

export type GroupChange = { id: string; groupId: string | null };

/** Only the listings whose stored group id differs from the new assignment. */
export function diffGroupAssignment(listings: GroupableListing[], assignment: GroupAssignment): GroupChange[] {
  const changes: GroupChange[] = [];
  for (const listing of listings) {
    const next = assignment.get(listing.id) ?? null;
    if ((listing.duplicateGroupId ?? null) !== next) changes.push({ id: listing.id, groupId: next });
  }
  return changes;
}
