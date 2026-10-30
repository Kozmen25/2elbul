import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { FetchedPage } from "./classify";
import { runListingAvailabilityCheck } from "./run";

const NOW = new Date("2026-10-03T06:00:00.000Z");
const DAY_AGO = new Date(NOW.getTime() - 24 * 3_600_000).toISOString();

type Row = {
  id: number;
  url: string;
  title: string;
  source: string;
  availability_gone_count: number;
  availability_gone_since: string | null;
};

/** Records every update; the select returns the given queue. */
function fakeSupabase(queue: Row[]) {
  const updates: Array<{ values: Record<string, unknown>; ids: unknown }> = [];
  const client = {
    from() {
      let pendingValues: Record<string, unknown> | null = null;
      const builder = {
        select: () => builder,
        in: (column: string, ids: unknown) => {
          if (pendingValues && column === "id") updates.push({ values: pendingValues, ids });
          return builder;
        },
        or: () => builder,
        order: () => builder,
        limit: () => builder,
        eq: (_column: string, id: unknown) => {
          if (pendingValues) updates.push({ values: pendingValues, ids: id });
          return builder;
        },
        update: (values: Record<string, unknown>) => {
          pendingValues = values;
          return builder;
        },
        then: (resolve: (value: { data: Row[] | null; error: null }) => unknown) =>
          resolve({ data: pendingValues ? null : queue, error: null }),
      };
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient<Database>, updates };
}

function row(id: number, url: string, overrides: Partial<Row> = {}): Row {
  return { id, url, title: `İlan ${id}`, source: "EasyCep", availability_gone_count: 0, availability_gone_since: null, ...overrides };
}

const pages = (byUrl: Record<string, number>) => async (url: string): Promise<FetchedPage> => ({
  requestedUrl: url,
  status: byUrl[url] ?? 200,
  finalUrl: url,
  body: "<title>Ürün</title>",
});

const options = (fetchPage: (url: string) => Promise<FetchedPage>) => ({
  fetchPage,
  now: () => NOW,
  sleep: async () => undefined,
});

describe("runListingAvailabilityCheck", () => {
  it("deactivates a confirmed dead listing and keeps the live one", async () => {
    const { client, updates } = fakeSupabase([
      row(1, "https://www.easycep.com/a", { availability_gone_count: 1, availability_gone_since: DAY_AGO }),
      row(2, "https://www.getmobil.com/b"),
    ]);
    const summary = await runListingAvailabilityCheck(
      client,
      options(pages({ "https://www.easycep.com/a": 404 })),
    );
    expect(summary).toMatchObject({ checked: 2, removed: 1, available: 1, deactivated: 1 });
    expect(updates.find((u) => u.ids === 1)?.values).toMatchObject({ status: "inactive", inactive_reason: "source_removed" });
    expect(updates.find((u) => u.ids === 2)?.values).toMatchObject({ availability_gone_count: 0 });
  });

  it("skips blocked sites and demo listings without requesting them", async () => {
    const requested: string[] = [];
    const { client, updates } = fakeSupabase([
      row(1, "https://www.sahibinden.com/ilan/1"),
      row(2, "https://www.easycep.com/demo", { title: "Demo ilan" }),
    ]);
    const summary = await runListingAvailabilityCheck(client, options(async (url) => {
      requested.push(url);
      return { requestedUrl: url, status: 200, finalUrl: url, body: "" };
    }));
    expect(requested).toEqual([]);
    expect(summary).toMatchObject({ checked: 0, skipped: 2 });
    expect(updates[0]).toMatchObject({ ids: [1, 2], values: { availability_checked_at: NOW.toISOString() } });
  });

  it("sets a site aside when most of its listings look gone at once", async () => {
    const queue = [1, 2, 3, 4].map((id) =>
      row(id, `https://www.getmobil.com/${id}`, { availability_gone_count: 1, availability_gone_since: DAY_AGO }),
    );
    const { client, updates } = fakeSupabase(queue);
    const summary = await runListingAvailabilityCheck(
      client,
      options(async (url) => ({ requestedUrl: url, status: 404, finalUrl: url, body: "" })),
    );
    expect(summary.suspiciousHosts).toEqual(["getmobil.com"]);
    expect(summary.deactivated).toBe(0);
    expect(updates.every((u) => !("status" in u.values))).toBe(true);
  });
});
