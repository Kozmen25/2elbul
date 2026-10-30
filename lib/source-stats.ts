import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Per-source numbers for the admin panel: how many listings each source has,
// how many it added recently and how its last scrape runs went.

type AdminClient = SupabaseClient<Database>;

/** Listing statuses that are live on the site. */
const LIVE_STATUSES = new Set(["published", "active"]);
const MS_PER_HOUR = 60 * 60 * 1000;
const DAY_HOURS = 24;
const WEEK_HOURS = 7 * DAY_HOURS;
/** Listing rows read for the counts; beyond this the figures are flagged as partial. */
export const SOURCE_STATS_LISTING_LIMIT = 20000;
const PAGE_SIZE = 1000;
const RUN_LIMIT = 2000;

export type ListingStatRow = { source: string; status: string | null; created_at: string };

export type RunStatRow = {
  source_id: number | null;
  status: string;
  found_count: number;
  imported_count: number;
  updated_count: number;
  error_count: number;
  created_at: string;
};

export type SourceRecord = { id: number; name: string; is_active: boolean };

export type SourceStatsRow = {
  source: string;
  /** Null when listings carry this source name but no source record exists. */
  sourceId: number | null;
  isActive: boolean | null;
  totalListings: number;
  liveListings: number;
  pendingListings: number;
  inactiveListings: number;
  addedLast24h: number;
  addedLast7d: number;
  lastRun: { status: string; at: string; found: number; imported: number; errors: number } | null;
  /** Totals over the scrape runs of the last 7 days. */
  runs7d: { runs: number; found: number; imported: number; errors: number; failedRuns: number };
};

function emptyRow(source: string, record?: SourceRecord): SourceStatsRow {
  return {
    source,
    sourceId: record?.id ?? null,
    isActive: record?.is_active ?? null,
    totalListings: 0,
    liveListings: 0,
    pendingListings: 0,
    inactiveListings: 0,
    addedLast24h: 0,
    addedLast7d: 0,
    lastRun: null,
    runs7d: { runs: 0, found: 0, imported: 0, errors: 0, failedRuns: 0 },
  };
}

/**
 * Pure aggregation. Every source record gets a row (even with no listings),
 * and a listing source without a record gets one too, so nothing is hidden.
 * Rows are ordered by live listings, then name.
 */
export function aggregateSourceStats(
  sources: SourceRecord[],
  listings: ListingStatRow[],
  runs: RunStatRow[],
  now: Date = new Date(),
): SourceStatsRow[] {
  const rows = new Map<string, SourceStatsRow>(sources.map((record) => [record.name, emptyRow(record.name, record)]));
  const idToName = new Map(sources.map((record) => [record.id, record.name]));

  const dayAgo = now.getTime() - DAY_HOURS * MS_PER_HOUR;
  const weekAgo = now.getTime() - WEEK_HOURS * MS_PER_HOUR;

  for (const listing of listings) {
    const row = rows.get(listing.source) ?? emptyRow(listing.source);
    rows.set(listing.source, row);
    row.totalListings += 1;
    if (LIVE_STATUSES.has(listing.status ?? "published")) row.liveListings += 1;
    else if (listing.status === "pending") row.pendingListings += 1;
    else row.inactiveListings += 1;

    const created = new Date(listing.created_at).getTime();
    if (created >= dayAgo) row.addedLast24h += 1;
    if (created >= weekAgo) row.addedLast7d += 1;
  }

  // Newest run first, so the first run seen per source is its last run.
  const newestFirst = [...runs].sort((a, b) => b.created_at.localeCompare(a.created_at));
  for (const run of newestFirst) {
    const name = run.source_id != null ? idToName.get(run.source_id) : undefined;
    const row = name ? rows.get(name) : undefined;
    if (!row) continue;

    if (!row.lastRun) {
      row.lastRun = {
        status: run.status,
        at: run.created_at,
        found: run.found_count,
        imported: run.imported_count + run.updated_count,
        errors: run.error_count,
      };
    }
    if (new Date(run.created_at).getTime() >= weekAgo) {
      row.runs7d.runs += 1;
      row.runs7d.found += run.found_count;
      row.runs7d.imported += run.imported_count;
      row.runs7d.errors += run.error_count;
      if (run.status === "failed" || run.status === "error") row.runs7d.failedRuns += 1;
    }
  }

  return [...rows.values()].sort((a, b) => b.liveListings - a.liveListings || a.source.localeCompare(b.source, "tr"));
}

export type SourceStatsResult = { rows: SourceStatsRow[]; scannedListings: number; partial: boolean };

export async function loadSourceStats(admin: AdminClient, now: Date = new Date()): Promise<SourceStatsResult> {
  const [sourcesResult, runsResult] = await Promise.all([
    admin.from("sources").select("id, name, is_active"),
    admin
      .from("bot_runs")
      .select("source_id, status, found_count, imported_count, updated_count, error_count, created_at")
      .order("created_at", { ascending: false })
      .limit(RUN_LIMIT),
  ]);
  if (sourcesResult.error) throw sourcesResult.error;
  if (runsResult.error) throw runsResult.error;

  const listings: ListingStatRow[] = [];
  for (let offset = 0; offset < SOURCE_STATS_LISTING_LIMIT; offset += PAGE_SIZE) {
    const { data, error } = await admin
      .from("listings")
      .select("source, status, created_at")
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    listings.push(...((data ?? []) as ListingStatRow[]));
    if ((data ?? []).length < PAGE_SIZE) break;
  }

  return {
    rows: aggregateSourceStats(sourcesResult.data ?? [], listings, runsResult.data ?? [], now),
    scannedListings: listings.length,
    partial: listings.length >= SOURCE_STATS_LISTING_LIMIT,
  };
}
