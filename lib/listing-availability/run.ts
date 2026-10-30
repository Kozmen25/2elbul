import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { PUBLIC_LISTING_STATUSES } from "@/lib/listing-status";
import { isPublicDemoListing } from "@/lib/public-data-cleanup";
import { classifyFetchedPage, type AvailabilityCheck } from "./classify";
import { CONFIRM_AFTER_HOURS, decideAvailability, type AvailabilityDecision } from "./decision";
import { fetchListingPage, type PageFetcher } from "./fetch-page";
import { hostOf, isCheckableUrl } from "./host-policy";

// Daily link check: takes the listings whose source page was checked longest
// ago, opens each page once and deactivates listings that are confirmed gone.
// Only real listings are checked (from a source scan or added by a user);
// demo listings and sites that block automated requests are left alone.

/** Listings opened per run; small enough for one serverless invocation. */
const BATCH_SIZE = 30;
/** A listing is due again this long after its last check (also the confirm gap). */
const RECHECK_AFTER_HOURS = CONFIRM_AFTER_HOURS;
/** Stop starting new requests after this long; the rest wait for the next run. */
const TIME_BUDGET_MS = 25_000;
/** Pause between two requests to the same site. */
const SAME_HOST_DELAY_MS = 1_000;
/** Different sites are checked side by side, one request at a time each. */
const HOST_CONCURRENCY = 4;
/**
 * When more than this share of one site's checked listings look gone in a
 * single run, the site most likely changed or blocked us: nothing of it is
 * deactivated and the run reports the site instead.
 */
const MAX_GONE_SHARE_PER_HOST = 0.5;
const MIN_SAMPLE_FOR_GONE_SHARE = 4;

const LISTED_STATUSES = [...PUBLIC_LISTING_STATUSES];
const HOUR_MS = 60 * 60 * 1000;

type CandidateRow = {
  id: number;
  url: string;
  title: string;
  source: string;
  availability_gone_count: number;
  availability_gone_since: string | null;
};

type CheckedListing = {
  listing: CandidateRow;
  check: AvailabilityCheck;
  decision: AvailabilityDecision;
};

export type AvailabilityRunSummary = {
  checked: number;
  available: number;
  removed: number;
  soldOut: number;
  unknown: number;
  skipped: number;
  deactivated: number;
  /** Sites whose results were set aside by the gone-share guard. */
  suspiciousHosts: string[];
  outOfTime: boolean;
};

export type AvailabilityRunOptions = {
  fetchPage?: PageFetcher;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  batchSize?: number;
  timeBudgetMs?: number;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function fetchCandidates(
  supabase: SupabaseClient<Database>,
  now: Date,
  batchSize: number,
): Promise<CandidateRow[]> {
  const dueBefore = new Date(now.getTime() - RECHECK_AFTER_HOURS * HOUR_MS).toISOString();
  const due = `or(availability_checked_at.is.null,availability_checked_at.lt.${dueBefore})`;
  const { data, error } = await supabase
    .from("listings")
    .select("id, url, title, source, availability_gone_count, availability_gone_since")
    .in("status", LISTED_STATUSES)
    // Real listings only: found by a source scan or submitted by a user.
    .or(`and(source_id.not.is.null,${due}),and(user_id.not.is.null,${due})`)
    .order("availability_checked_at", { ascending: true, nullsFirst: true })
    .limit(batchSize);
  if (error) throw new Error(`Listing availability queue query failed: ${error.message}`);
  return (data ?? []) as CandidateRow[];
}

/** Applies the gone-share guard: a suspicious site keeps all its listings. */
export function guardHostResults(results: CheckedListing[], now: Date): {
  results: CheckedListing[];
  suspicious: boolean;
} {
  const gone = results.filter((result) => result.check.outcome === "removed" || result.check.outcome === "sold_out");
  const suspicious =
    results.length >= MIN_SAMPLE_FOR_GONE_SHARE && gone.length / results.length > MAX_GONE_SHARE_PER_HOST;
  if (!suspicious) return { results, suspicious };
  const checkedAt = now.toISOString();
  return {
    suspicious,
    results: results.map((result) => ({
      ...result,
      decision: { action: "keep", update: { availability_checked_at: checkedAt } },
    })),
  };
}

async function checkHost(
  listings: CandidateRow[],
  options: Required<Pick<AvailabilityRunOptions, "fetchPage" | "now" | "sleep">> & { deadline: number },
): Promise<CheckedListing[]> {
  const results: CheckedListing[] = [];
  for (const [index, listing] of listings.entries()) {
    if (Date.now() >= options.deadline) break;
    if (index > 0) await options.sleep(SAME_HOST_DELAY_MS);
    const check = classifyFetchedPage(await options.fetchPage(listing.url));
    const decision = decideAvailability(
      {
        availabilityGoneCount: listing.availability_gone_count,
        availabilityGoneSince: listing.availability_gone_since,
      },
      check,
      options.now(),
    );
    results.push({ listing, check, decision });
  }
  return results;
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await task(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function runListingAvailabilityCheck(
  supabase: SupabaseClient<Database>,
  options: AvailabilityRunOptions = {},
): Promise<AvailabilityRunSummary> {
  const now = options.now ?? (() => new Date());
  const fetchPage = options.fetchPage ?? fetchListingPage;
  const sleep = options.sleep ?? defaultSleep;
  const deadline = Date.now() + (options.timeBudgetMs ?? TIME_BUDGET_MS);
  const summary: AvailabilityRunSummary = {
    checked: 0,
    available: 0,
    removed: 0,
    soldOut: 0,
    unknown: 0,
    skipped: 0,
    deactivated: 0,
    suspiciousHosts: [],
    outOfTime: false,
  };

  const candidates = await fetchCandidates(supabase, now(), options.batchSize ?? BATCH_SIZE);
  const skippedIds: number[] = [];
  const byHost = new Map<string, CandidateRow[]>();
  for (const listing of candidates) {
    const host = hostOf(listing.url);
    if (!host || !isCheckableUrl(listing.url) || isPublicDemoListing(listing)) {
      skippedIds.push(listing.id);
      continue;
    }
    byHost.set(host, [...(byHost.get(host) ?? []), listing]);
  }

  const hostResults = await mapWithConcurrency([...byHost.entries()], HOST_CONCURRENCY, async ([host, listings]) => {
    const checked = await checkHost(listings, { fetchPage, now, sleep, deadline });
    const guarded = guardHostResults(checked, now());
    if (guarded.suspicious) summary.suspiciousHosts.push(host);
    return guarded.results;
  });
  const results = hostResults.flat();
  summary.outOfTime = results.length < candidates.length - skippedIds.length;

  for (const { check, decision } of results) {
    summary.checked += 1;
    if (check.outcome === "available") summary.available += 1;
    else if (check.outcome === "removed") summary.removed += 1;
    else if (check.outcome === "sold_out") summary.soldOut += 1;
    else summary.unknown += 1;
    if (decision.action === "deactivate") summary.deactivated += 1;
  }

  // Skipped listings move to the back of the queue so they do not block it.
  if (skippedIds.length) {
    summary.skipped = skippedIds.length;
    const { error } = await supabase
      .from("listings")
      .update({ availability_checked_at: now().toISOString() })
      .in("id", skippedIds);
    if (error) console.error("Listing availability skip update failed:", error);
  }

  await Promise.all(
    results.map(async ({ listing, decision }) => {
      const { error } = await supabase
        .from("listings")
        .update(decision.update)
        .eq("id", listing.id)
        // An admin may have changed the listing meanwhile; never revive it.
        .in("status", LISTED_STATUSES);
      if (error) console.error(`Listing availability update failed for ${listing.id}:`, error);
    }),
  );

  return summary;
}
