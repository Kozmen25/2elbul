// Runs the listing link check against a REAL Supabase project (the one in
// .env.local) and real HTTP requests to this project's own demo site, so no
// third-party site is contacted. Skipped unless RUN_DB_TESTS=1:
//
//   RUN_DB_TESTS=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run lib/listing-availability/run.db.test.ts
//
// It creates two listings titled "ZZ Kontrol ilanı ..." and removes them afterwards.

import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveListingOutbound } from "./outbound";
import { runListingAvailabilityCheck } from "./run";

const RUN = process.env.RUN_DB_TESTS === "1";
const DEMO_SITE = "https://2elbul.projedemolari.com";
const DEAD_URL = `${DEMO_SITE}/product/zz-olmayan-urun-kontrol`;
const LIVE_URL = `${DEMO_SITE}/categories`;
const HOUR_MS = 3_600_000;

describe.skipIf(!RUN)("listing availability (real database)", () => {
  const supabase = createSupabaseAdminClient()!;
  const created: number[] = [];

  afterAll(async () => {
    if (created.length) await supabase.from("listings").delete().in("id", created);
  });

  it("deactivates a listing whose page is gone on two checks and keeps the live one", async () => {
    const { data: source } = await supabase.from("sources").select("id").limit(1).single();
    const { data: product } = await supabase.from("products").select("id").eq("slug", "iphone-13").single();
    expect(source && product).toBeTruthy();

    const base = {
      product_id: product!.id,
      source_id: source!.id,
      price: 25000,
      city: "İstanbul",
      source: "Kontrol",
      condition: "İkinci El",
      status: "published",
    };
    const { data: inserted, error } = await supabase
      .from("listings")
      .insert([
        { ...base, title: "ZZ Kontrol ilanı ölü", url: DEAD_URL, external_id: "zz-dead" },
        { ...base, title: "ZZ Kontrol ilanı canlı", url: LIVE_URL, external_id: "zz-live" },
      ])
      .select("id, url");
    expect(error).toBeNull();
    created.push(...inserted!.map((row) => row.id));
    const deadId = inserted!.find((row) => row.url === DEAD_URL)!.id;
    const liveId = inserted!.find((row) => row.url === LIVE_URL)!.id;

    const first = await runListingAvailabilityCheck(supabase);
    expect(first).toMatchObject({ removed: 1, available: 1, deactivated: 0 });

    const later = new Date(Date.now() + 13 * HOUR_MS);
    const second = await runListingAvailabilityCheck(supabase, { now: () => later });
    expect(second).toMatchObject({ deactivated: 1 });

    const { data: rows } = await supabase
      .from("listings")
      .select("id, status, inactive_reason, availability_gone_count")
      .in("id", created);
    expect(rows!.find((row) => row.id === deadId)).toMatchObject({ status: "inactive", inactive_reason: "source_removed" });
    expect(rows!.find((row) => row.id === liveId)).toMatchObject({ status: "published", availability_gone_count: 0 });

    // The "go to listing" link: live forwards, dead offers the product's live listings.
    expect(await resolveListingOutbound(liveId)).toEqual({ kind: "live", url: LIVE_URL });
    const dead = await resolveListingOutbound(deadId);
    expect(dead).toMatchObject({ kind: "gone", reason: "source_removed", product: { slug: "iphone-13" } });
    expect(dead.kind === "gone" && dead.alternatives.length).toBeGreaterThan(0);
  }, 90_000);

  it("source sync refreshes last_seen_at of unchanged listings and revives deactivated ones", async () => {
    const { data: source } = await supabase.from("sources").select("id").limit(1).single();
    const { data: product } = await supabase.from("products").select("id").eq("slug", "iphone-13").single();
    const item = {
      external_id: "zz-sync-kontrol",
      product_id: product!.id,
      title: "ZZ Kontrol ilanı senkron",
      price: 24000,
      city: "İstanbul",
      source: "Kontrol",
      url: `${DEMO_SITE}/zz-sync-kontrol`,
      condition: "İkinci El",
      image_url: null,
      status: "published",
      raw_payload: null,
    };
    const oldSeen = "2026-01-01T00:00:00.000Z";
    const { data: inserted, error } = await supabase
      .from("listings")
      .insert({ ...item, source_id: source!.id, last_seen_at: oldSeen })
      .select("id")
      .single();
    expect(error).toBeNull();
    created.push(inserted!.id);

    const sync = () =>
      supabase.rpc("sync_source_listings", {
        p_source_id: source!.id,
        p_items: [item],
        p_skip_inactive_marking: true,
      });

    const unchanged = await sync();
    expect(unchanged.error).toBeNull();
    const { data: afterUnchanged } = await supabase
      .from("listings")
      .select("last_seen_at")
      .eq("id", inserted!.id)
      .single();
    expect(new Date(afterUnchanged!.last_seen_at!).getTime()).toBeGreaterThan(new Date(oldSeen).getTime());

    await supabase
      .from("listings")
      .update({ status: "inactive", inactive_reason: "source_removed", availability_gone_count: 2 })
      .eq("id", inserted!.id);
    const revived = await sync();
    expect(revived.error).toBeNull();
    const { data: afterRevive } = await supabase
      .from("listings")
      .select("status, inactive_reason, availability_gone_count")
      .eq("id", inserted!.id)
      .single();
    expect(afterRevive).toEqual({ status: "active", inactive_reason: null, availability_gone_count: 0 });
  }, 60_000);
});
