import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { hasValidSecret } from "@/lib/auth/cron-auth";
import { formatCurrencyTRY } from "@/lib/formatters";
import { extractProductTypeFromAttributes } from "@/lib/market-intelligence/helpers";
import { createNotificationMailer } from "@/lib/email/notify";
import { createNotificationDeliverer } from "@/lib/notifications/deliver";
import { calculateMarketStats } from "@/lib/price-insights";
import { evaluateProductFollow, followNotificationTitle } from "@/lib/product-follows/rules";
import { getSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AdminClient = SupabaseClient<Database>;

/** Follows are processed in id order, this many per round trip. */
const FOLLOW_PAGE_SIZE = 500;

const VISIBLE_LISTING_STATUSES = ["published", "active"];

// Same exclusion as price alerts: accessory / spare part / service products
// are never reported as a price drop of the main product.
const NON_PRIMARY_PRODUCT_TYPES = new Set(["accessory", "spare_part", "service"]);

type FollowRow = {
  id: string;
  user_id: string;
  product_id: number;
  last_price: number | null;
  last_checked_at: string | null;
};

type RecentListing = { price: number; createdAt: string; duplicateGroupId: string | null };

type PageLookups = {
  /** Lowest visible price per product. */
  prices: Map<number, number>;
  /** Market average (outlier-trimmed) per product. */
  marketAverages: Map<number, number>;
  /** Oldest listing of each duplicate group seen among the recent listings (ms). */
  groupFirstSeen: Map<string, number>;
  names: Map<number, string>;
  slugs: Map<number, string>;
  suppressed: Set<number>;
  /** Visible listings created since the oldest last check on the page. */
  recentListings: Map<number, RecentListing[]>;
};

type RunTotals = {
  checked: number;
  priceDrops: number;
  newListings: number;
  failed: number;
  notificationsCreated: number;
  emailsSent: number;
};

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET tanımlı değil." }, { status: 500 });
  }
  if (!hasValidSecret(request, secret)) {
    return NextResponse.json({ ok: false, error: "Yetkisiz cron isteği." }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase service-role bağlantısı yok." }, { status: 500 });
  }

  const totals: RunTotals = { checked: 0, priceDrops: 0, newListings: 0, failed: 0, notificationsCreated: 0, emailsSent: 0 };
  const origin = getSiteUrl();
  const deliver = createNotificationDeliverer(supabase, createNotificationMailer(supabase, origin));
  const now = new Date().toISOString();
  let lastId: string | null = null;

  // Keyset pagination: rows are updated while we work, so an offset would skip some.
  for (;;) {
    let query = supabase
      .from("product_follows")
      .select("id, user_id, product_id, last_price, last_checked_at")
      .order("id", { ascending: true })
      .limit(FOLLOW_PAGE_SIZE);
    if (lastId) query = query.gt("id", lastId);

    const { data, error } = await query;
    if (error) {
      console.error("Product follows cron query failed:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const follows: FollowRow[] = (data ?? []).map((row) => ({
      ...row,
      last_price: row.last_price == null ? null : Number(row.last_price),
    }));
    if (follows.length === 0) break;

    const lookups = await loadLookups(supabase, follows);
    for (const follow of follows) {
      try {
        await processFollow(supabase, follow, lookups, now, totals, deliver, origin);
      } catch (followError) {
        totals.failed += 1;
        console.error("Product follow check failed:", followError);
      }
    }

    lastId = follows[follows.length - 1].id;
    if (follows.length < FOLLOW_PAGE_SIZE) break;
  }

  return NextResponse.json({ ok: true, ...totals });
}

async function processFollow(
  supabase: AdminClient,
  follow: FollowRow,
  lookups: PageLookups,
  now: string,
  totals: RunTotals,
  deliver: ReturnType<typeof createNotificationDeliverer>,
  origin: string,
) {
  const currentPrice = lookups.prices.get(follow.product_id) ?? null;
  totals.checked += 1;

  // Nothing listed right now: keep the last known price as the baseline.
  if (currentPrice === null) {
    await updateFollow(supabase, follow.id, { last_checked_at: now });
    return;
  }

  const lastCheckedAt = follow.last_checked_at ? new Date(follow.last_checked_at).getTime() : 0;

  // New ITEMS since the last check. A listing that is a copy of an item which
  // already existed (same duplicate group, older member) is not new.
  const newItems = (lookups.recentListings.get(follow.product_id) ?? []).filter((listing) => {
    if (new Date(listing.createdAt).getTime() <= lastCheckedAt) return false;
    if (!listing.duplicateGroupId) return true;
    const firstSeen = lookups.groupFirstSeen.get(listing.duplicateGroupId);
    return firstSeen === undefined || firstSeen > lastCheckedAt;
  });
  const cheapestNew = newItems.reduce<RecentListing | null>(
    (best, listing) => (best === null || listing.price < best.price ? listing : best),
    null,
  );

  const { outcome, nextBaseline } = evaluateProductFollow({
    baseline: follow.last_price,
    currentPrice,
    lowestIsNewListing: newItems.some((listing) => listing.price <= currentPrice),
    newListing: cheapestNew ? { price: cheapestNew.price } : null,
    marketAverage: lookups.marketAverages.get(follow.product_id) ?? null,
    suppressDrop: lookups.suppressed.has(follow.product_id),
  });

  if (outcome.kind === "unchanged") {
    await updateFollow(supabase, follow.id, { last_price: nextBaseline, last_checked_at: now });
    return;
  }

  const name = lookups.names.get(follow.product_id) ?? "Ürün";
  const slug = lookups.slugs.get(follow.product_id);
  const productUrl = slug ? `${origin}/product/${slug}` : `${origin}/favoriler`;
  const baseMetadata: Record<string, Json> = { product_follow_id: follow.id, product_id: follow.product_id, current_price: currentPrice };
  if (slug) baseMetadata.product_slug = slug;

  // Delivery first: if the notification cannot be stored the follow keeps its
  // old baseline and the next run tries again, instead of silently skipping it.
  let delivery;
  if (outcome.kind === "price_drop") {
    delivery = await deliver({
      userId: follow.user_id,
      kind: "price_drop",
      notification: {
        title: followNotificationTitle("price_drop"),
        body: `${name} için fiyat düştü. Önceki: ${formatCurrencyTRY(outcome.previousPrice)}, Güncel: ${formatCurrencyTRY(currentPrice)} (%${outcome.dropPercent} düşüş)`,
        metadata: { ...baseMetadata, previous_price: outcome.previousPrice, drop_percent: outcome.dropPercent },
      },
      email: {
        productName: name,
        previousPrice: outcome.previousPrice,
        currentPrice,
        dropPercent: outcome.dropPercent,
        productUrl,
      },
    });
    totals.priceDrops += 1;
  } else {
    const marketNote =
      outcome.belowMarketPercent !== null && outcome.belowMarketPercent > 0
        ? ` Piyasa ortalamasının %${outcome.belowMarketPercent.toLocaleString("tr-TR")} altında.`
        : "";
    delivery = await deliver({
      userId: follow.user_id,
      kind: "new_listing",
      notification: {
        title: followNotificationTitle("new_listing"),
        body: `${name} için ${formatCurrencyTRY(outcome.price)} fiyatlı yeni bir ilan eklendi.${marketNote}`,
        metadata: {
          ...baseMetadata,
          listing_price: outcome.price,
          ...(outcome.belowMarketPercent !== null ? { below_market_percent: outcome.belowMarketPercent } : {}),
          ...(outcome.dropPercent !== null ? { drop_percent: outcome.dropPercent } : {}),
        },
      },
      email: { productName: name, price: outcome.price, belowMarketPercent: outcome.belowMarketPercent, productUrl },
    });
    totals.newListings += 1;
  }

  await updateFollow(supabase, follow.id, { last_price: nextBaseline, last_checked_at: now });
  if (delivery.inApp) totals.notificationsCreated += 1;
  if (delivery.email === "sent") totals.emailsSent += 1;
}

async function updateFollow(
  supabase: AdminClient,
  followId: string,
  patch: Database["public"]["Tables"]["product_follows"]["Update"],
) {
  const { error } = await supabase.from("product_follows").update(patch).eq("id", followId);
  if (error) throw error;
}

/** One query per kind for the whole page instead of several per follow. */
async function loadLookups(supabase: AdminClient, follows: FollowRow[]): Promise<PageLookups> {
  const productIds = [...new Set(follows.map((follow) => follow.product_id))];
  const oldestCheck = follows.reduce<string | null>((oldest, follow) => {
    if (!follow.last_checked_at) return oldest;
    return oldest === null || follow.last_checked_at < oldest ? follow.last_checked_at : oldest;
  }, null);

  const [prices, products, recent] = await Promise.all([
    supabase.from("product_price_stats").select("product_id, min_price, prices").in("product_id", productIds),
    supabase.from("products").select("id, name, slug, attributes").in("id", productIds),
    oldestCheck
      ? supabase
          .from("listings")
          .select("product_id, price, created_at, duplicate_group_id")
          .in("product_id", productIds)
          .in("status", VISIBLE_LISTING_STATUSES)
          .gt("created_at", oldestCheck)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (prices.error) throw prices.error;
  if (products.error) throw products.error;
  if (recent.error) throw recent.error;

  const lookups: PageLookups = {
    prices: new Map(),
    marketAverages: new Map(),
    groupFirstSeen: new Map(),
    names: new Map(),
    slugs: new Map(),
    suppressed: new Set(),
    recentListings: new Map(),
  };

  for (const row of prices.data ?? []) {
    if (row.product_id == null || row.min_price == null) continue;
    lookups.prices.set(row.product_id, Number(row.min_price));
    const market = calculateMarketStats((row.prices ?? []).map(Number));
    if (market) lookups.marketAverages.set(row.product_id, market.average);
  }
  for (const product of products.data ?? []) {
    lookups.names.set(product.id, product.name);
    if (product.slug) lookups.slugs.set(product.id, product.slug);
    const type = extractProductTypeFromAttributes(product.attributes) ?? "";
    if (NON_PRIMARY_PRODUCT_TYPES.has(type)) lookups.suppressed.add(product.id);
  }
  for (const listing of recent.data ?? []) {
    const list = lookups.recentListings.get(listing.product_id) ?? [];
    list.push({
      price: Number(listing.price),
      createdAt: listing.created_at,
      duplicateGroupId: listing.duplicate_group_id,
    });
    lookups.recentListings.set(listing.product_id, list);
  }

  // When did each duplicate group first appear? A copy added today of an item
  // that was listed last month is not a new item.
  const groupIds = [
    ...new Set((recent.data ?? []).flatMap((listing) => (listing.duplicate_group_id ? [listing.duplicate_group_id] : []))),
  ];
  if (groupIds.length > 0) {
    const members = await supabase.from("listings").select("duplicate_group_id, created_at").in("duplicate_group_id", groupIds);
    if (members.error) throw members.error;
    for (const member of members.data ?? []) {
      if (!member.duplicate_group_id) continue;
      const time = new Date(member.created_at).getTime();
      const known = lookups.groupFirstSeen.get(member.duplicate_group_id);
      if (known === undefined || time < known) lookups.groupFirstSeen.set(member.duplicate_group_id, time);
    }
  }

  return lookups;
}
