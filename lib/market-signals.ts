import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { loadProductMarkets, type ProductMarketContext } from "@/lib/listing-problems";
import {
  MIN_PRICE_COMPARISON_SAMPLE,
  PRICE_POSITION_THRESHOLDS,
  buildDailyPriceHistory,
  calculatePriceTrend,
  classifyPricePosition,
} from "@/lib/price-insights";

// The market signals an admin watches: where the good deals are, which prices
// look wrong, which products are getting cheaper and where data is thin. Same
// price classification as every badge on the site (price-insights).

type AdminClient = SupabaseClient<Database>;

const TOP_N = 15;
export const SIGNAL_TREND_DAYS = 30;
const HISTORY_LIMIT = 5000;
const LISTING_LIMIT = 5000;
const FOLLOW_LIMIT = 5000;
const PAGE_SIZE = 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type SignalListing = { id: number; productId: number; title: string; price: number; source: string; url: string | null };
export type ProductRef = { id: number; name: string; slug: string | null };
export type HistoryRecord = { productId: number; price: number; recordedAt: string };

export type ListingSignal = SignalListing & { productName: string; marketAverage: number; differencePercent: number };
export type ProductSignal = { productId: number; name: string; slug: string | null; value: number; note: string };

export type MarketSignals = {
  opportunities: ListingSignal[];
  suspicious: ListingSignal[];
  suspiciousTotal: number;
  falling: ProductSignal[];
  thinData: ProductSignal[];
  mostFollowed: ProductSignal[];
  scannedListings: number;
};

export function buildMarketSignals(input: {
  listings: SignalListing[];
  markets: Map<number, ProductMarketContext>;
  products: ProductRef[];
  history: HistoryRecord[];
  followCounts: Map<number, number>;
  now?: Date;
}): MarketSignals {
  const { listings, markets, products, history, followCounts, now = new Date() } = input;
  const productById = new Map(products.map((product) => [product.id, product]));
  const nameOf = (id: number) => productById.get(id)?.name ?? `Ürün #${id}`;

  const opportunities: ListingSignal[] = [];
  const suspicious: ListingSignal[] = [];
  for (const listing of listings) {
    const market = markets.get(listing.productId);
    if (!market || market.count < MIN_PRICE_COMPARISON_SAMPLE || !(listing.price > 0)) continue;
    const differencePercent = Math.round(((listing.price - market.average) / market.average) * 1000) / 10;
    const signal: ListingSignal = { ...listing, productName: nameOf(listing.productId), marketAverage: market.average, differencePercent };
    const position = classifyPricePosition(differencePercent);
    if (position === "suspicious") suspicious.push(signal);
    else if (position === "great" || position === "below") opportunities.push(signal);
  }
  opportunities.sort((a, b) => a.differencePercent - b.differencePercent);
  suspicious.sort((a, b) => a.differencePercent - b.differencePercent);

  const byProduct = new Map<number, HistoryRecord[]>();
  for (const record of history) {
    const list = byProduct.get(record.productId) ?? [];
    list.push(record);
    byProduct.set(record.productId, list);
  }
  const falling: ProductSignal[] = [];
  for (const [productId, records] of byProduct) {
    const trend = calculatePriceTrend(
      buildDailyPriceHistory(records.map((record) => ({ price: record.price, recordedAt: record.recordedAt }))),
      SIGNAL_TREND_DAYS,
      now,
    );
    if (trend?.direction !== "falling") continue;
    falling.push({
      productId,
      name: nameOf(productId),
      slug: productById.get(productId)?.slug ?? null,
      value: trend.changePercent,
      note: `${trend.spanDays} günde %${Math.abs(trend.changePercent).toLocaleString("tr-TR")} düştü`,
    });
  }
  falling.sort((a, b) => a.value - b.value);

  const liveCount = new Map<number, number>();
  for (const listing of listings) liveCount.set(listing.productId, (liveCount.get(listing.productId) ?? 0) + 1);
  const thinData: ProductSignal[] = products
    .map((product) => ({ product, count: liveCount.get(product.id) ?? 0 }))
    .filter(({ count }) => count < MIN_PRICE_COMPARISON_SAMPLE)
    .sort((a, b) => a.count - b.count || a.product.name.localeCompare(b.product.name, "tr"))
    .map(({ product, count }) => ({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      value: count,
      note: count === 0 ? "Yayında ilan yok" : `${count} ilan (en az ${MIN_PRICE_COMPARISON_SAMPLE} gerekir)`,
    }));

  const mostFollowed: ProductSignal[] = [...followCounts]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, TOP_N)
    .map(([productId, count]) => ({
      productId,
      name: nameOf(productId),
      slug: productById.get(productId)?.slug ?? null,
      value: count,
      note: `${count} takipçi`,
    }));

  return {
    opportunities: opportunities.slice(0, TOP_N),
    suspicious: suspicious.slice(0, TOP_N),
    suspiciousTotal: suspicious.length,
    falling: falling.slice(0, TOP_N),
    thinData: thinData.slice(0, TOP_N * 2),
    mostFollowed,
    scannedListings: listings.length,
  };
}

export const SUSPICIOUS_BELOW_PERCENT = Math.abs(PRICE_POSITION_THRESHOLDS.suspicious);

async function loadLiveListings(admin: AdminClient): Promise<SignalListing[]> {
  const rows: SignalListing[] = [];
  for (let offset = 0; offset < LISTING_LIMIT; offset += PAGE_SIZE) {
    const { data, error } = await admin
      .from("listings")
      .select("id, product_id, title, price, source, url")
      .in("status", ["published", "active"])
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    for (const row of data ?? []) {
      rows.push({ id: row.id, productId: row.product_id, title: row.title, price: Number(row.price), source: row.source, url: row.url });
    }
    if ((data ?? []).length < PAGE_SIZE) break;
  }
  return rows;
}

export async function loadMarketSignals(admin: AdminClient, now: Date = new Date()): Promise<MarketSignals> {
  const since = new Date(now.getTime() - SIGNAL_TREND_DAYS * MS_PER_DAY).toISOString();
  const [listings, productsResult, historyResult, followsResult] = await Promise.all([
    loadLiveListings(admin),
    admin.from("products").select("id, name, slug").limit(5000),
    admin
      .from("price_history")
      .select("product_id, price, recorded_at")
      .gte("recorded_at", since)
      .order("recorded_at", { ascending: false })
      .limit(HISTORY_LIMIT),
    admin.from("product_follows").select("product_id").limit(FOLLOW_LIMIT),
  ]);
  if (productsResult.error) throw productsResult.error;
  if (historyResult.error) throw historyResult.error;
  if (followsResult.error) throw followsResult.error;

  const markets = await loadProductMarkets(admin, [...new Set(listings.map((listing) => listing.productId))]);
  const followCounts = new Map<number, number>();
  for (const follow of followsResult.data ?? []) followCounts.set(follow.product_id, (followCounts.get(follow.product_id) ?? 0) + 1);

  return buildMarketSignals({
    listings,
    markets,
    products: (productsResult.data ?? []).map((row) => ({ id: row.id, name: row.name, slug: row.slug })),
    history: (historyResult.data ?? []).map((row) => ({ productId: row.product_id, price: Number(row.price), recordedAt: row.recorded_at })),
    followCounts,
    now,
  });
}
