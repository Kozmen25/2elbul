import type { AvailabilityCheck } from "./classify";

// Turns one check result into the listing's next availability state. A
// listing leaves the site only when its page was gone on two checks at least
// CONFIRM_AFTER_HOURS apart, so a short outage or a deploy at the source
// cannot remove it.

export const CONFIRM_AFTER_HOURS = 12;

const HOUR_MS = 60 * 60 * 1000;

export type InactiveReason = "source_removed" | "sold_out";

export type ListingAvailabilityState = {
  availabilityGoneCount: number;
  availabilityGoneSince: string | null;
};

export type AvailabilityDecision =
  | { action: "keep"; update: ListingAvailabilityUpdate }
  | { action: "deactivate"; reason: InactiveReason; update: ListingAvailabilityUpdate };

/** Columns written back for the listing (names match public.listings). */
export type ListingAvailabilityUpdate = {
  availability_checked_at: string;
  availability_gone_count?: number;
  availability_gone_since?: string | null;
  status?: "inactive";
  inactive_at?: string;
  inactive_reason?: InactiveReason;
};

export function decideAvailability(
  state: ListingAvailabilityState,
  check: AvailabilityCheck,
  now: Date,
): AvailabilityDecision {
  const checkedAt = now.toISOString();

  if (check.outcome === "unknown") {
    // Only move the listing to the back of the queue; the streak stays as it is.
    return { action: "keep", update: { availability_checked_at: checkedAt } };
  }

  if (check.outcome === "available") {
    return {
      action: "keep",
      update: { availability_checked_at: checkedAt, availability_gone_count: 0, availability_gone_since: null },
    };
  }

  const reason: InactiveReason = check.outcome === "sold_out" ? "sold_out" : "source_removed";
  const goneSince = state.availabilityGoneSince ?? checkedAt;
  const goneCount = state.availabilityGoneCount + 1;
  const confirmed =
    goneCount >= 2 && now.getTime() - new Date(goneSince).getTime() >= CONFIRM_AFTER_HOURS * HOUR_MS;

  const update: ListingAvailabilityUpdate = {
    availability_checked_at: checkedAt,
    availability_gone_count: goneCount,
    availability_gone_since: goneSince,
  };

  if (!confirmed) return { action: "keep", update };
  return {
    action: "deactivate",
    reason,
    update: { ...update, status: "inactive", inactive_at: checkedAt, inactive_reason: reason },
  };
}
