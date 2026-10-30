import { describe, expect, it } from "vitest";
import { aggregateSourceStats, type ListingStatRow, type RunStatRow } from "@/lib/source-stats";

const now = new Date("2026-10-10T12:00:00Z");
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3600_000).toISOString();

const sources = [
  { id: 1, name: "Sahibinden", is_active: true },
  { id: 2, name: "Letgo", is_active: false },
  { id: 3, name: "EasyCep", is_active: true },
];

const listing = (source: string, status: string | null, hours: number): ListingStatRow => ({ source, status, created_at: hoursAgo(hours) });
const run = (sourceId: number, status: string, hours: number, found = 10, imported = 4, errors = 0): RunStatRow => ({
  source_id: sourceId, status, found_count: found, imported_count: imported, updated_count: 1, error_count: errors, created_at: hoursAgo(hours),
});

describe("aggregateSourceStats", () => {
  const rows = aggregateSourceStats(
    sources,
    [
      listing("Sahibinden", "published", 2),
      listing("Sahibinden", "active", 30),
      listing("Sahibinden", "inactive", 400),
      listing("Sahibinden", "pending", 1),
      listing("Letgo", "published", 100),
      listing("Yenilenmiş Market", "published", 5),
      listing("Sahibinden", null, 3),
    ],
    [
      run(1, "completed", 5, 20, 8, 1),
      run(1, "failed", 30, 5, 0, 3),
      run(1, "completed", 500),
      run(2, "completed", 50),
      run(99, "completed", 5),
    ],
    now,
  );
  const by = (name: string) => rows.find((row) => row.source === name)!;

  it("counts listings per source by status", () => {
    expect(by("Sahibinden")).toMatchObject({ totalListings: 5, liveListings: 3, pendingListings: 1, inactiveListings: 1 });
    expect(by("Letgo")).toMatchObject({ totalListings: 1, liveListings: 1, isActive: false });
  });

  it("counts what each source added in the last day and week", () => {
    expect(by("Sahibinden")).toMatchObject({ addedLast24h: 3, addedLast7d: 4 });
    expect(by("Letgo")).toMatchObject({ addedLast24h: 0, addedLast7d: 1 });
  });

  it("keeps a row for a source without listings and for listings without a source record", () => {
    expect(by("EasyCep")).toMatchObject({ totalListings: 0, sourceId: 3, lastRun: null });
    expect(by("Yenilenmiş Market")).toMatchObject({ totalListings: 1, sourceId: null, isActive: null });
  });

  it("reports the last run and the last 7 days of runs, ignoring older or unknown ones", () => {
    expect(by("Sahibinden").lastRun).toEqual({ status: "completed", at: hoursAgo(5), found: 20, imported: 9, errors: 1 });
    expect(by("Sahibinden").runs7d).toEqual({ runs: 2, found: 25, imported: 8, errors: 4, failedRuns: 1 });
  });

  it("orders by live listings, then name", () => {
    expect(rows.map((row) => row.source)).toEqual(["Sahibinden", "Letgo", "Yenilenmiş Market", "EasyCep"]);
  });

  it("handles no data at all", () => {
    expect(aggregateSourceStats([], [], [], now)).toEqual([]);
  });
});
