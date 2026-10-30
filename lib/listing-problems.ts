import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { toBigintIds } from "@/lib/supabase-ids";
import {
  MIN_PRICE_COMPARISON_SAMPLE,
  calculateMarketStats,
  classifyPricePosition,
} from "@/lib/price-insights";

// Listings that need an admin's attention, and why. The rules are pure so the
// admin page and its tests share one definition; the loader only gathers data.

type AdminClient = SupabaseClient<Database>;

export const LISTING_PROBLEM_KINDS = [
  "no_price",
  "no_url",
  "no_image",
  "suspicious_cheap",
  "duplicate_url",
  "stale",
] as const;
export type ListingProblemKind = (typeof LISTING_PROBLEM_KINDS)[number];

export const LISTING_PROBLEM_LABELS: Record<ListingProblemKind, { label: string; description: string }> = {
  no_price: { label: "Fiyat yok", description: "Fiyatı sıfır, eksik ya da geçersiz." },
  no_url: { label: "Bağlantı yok", description: "İlanın kaynak adresi boş." },
  no_image: { label: "Görsel yok", description: "İlanın fotoğrafı yok." },
  suspicious_cheap: {
    label: "Şüpheli ucuz",
    description: "Piyasa ortalamasının en az %40 altında; dolandırıcılık ya da hatalı fiyat olabilir.",
  },
  duplicate_url: { label: "Aynı bağlantı", description: "Aynı adres birden fazla ilanda kayıtlı." },
  stale: { label: "Güncel değil", description: "Yayında görünüyor ama uzun süredir kaynakta görülmedi." },
};

/** A live listing not seen at its source for this many days is stale. */
export const STALE_AFTER_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Listings read per check; beyond this the result is flagged as partial. */
export const PROBLEM_SCAN_LIMIT = 5000;
const PAGE_SIZE = 1000;
const PRODUCT_CHUNK = 200;
/** Statuses an admin still has to look at (rejected and inactive are already dealt with). */
const OPEN_STATUSES = ["published", "active", "pending"];
const LIVE_STATUSES = new Set(["published", "active"]);

export type ProblemCandidate = {
  id: number;
  productId: number;
  title: string;
  price: number;
  source: string;
  url: string | null;
  imageUrl: string | null;
  status: string;
  createdAt: string;
  lastSeenAt: string | null;
};

export type ProductMarketContext = { average: number; count: number };

export type ListingProblemContext = {
  /** Market figures per product id (trimmed average of live listing prices). */
  markets: Map<number, ProductMarketContext>;
  /** Addresses that appear on more than one listing. */
  duplicateUrls: Set<string>;
  now: Date;
};

const isBlank = (value: string | null | undefined) => !value || value.trim() === "";

export function detectListingProblems(listing: ProblemCandidate, context: ListingProblemContext): ListingProblemKind[] {
  const problems: ListingProblemKind[] = [];

  if (!Number.isFinite(listing.price) || listing.price <= 0) problems.push("no_price");
  if (isBlank(listing.url)) problems.push("no_url");
  if (isBlank(listing.imageUrl)) problems.push("no_image");

  const market = context.markets.get(listing.productId);
  if (
    listing.price > 0 &&
    market &&
    market.count >= MIN_PRICE_COMPARISON_SAMPLE &&
    classifyPricePosition(((listing.price - market.average) / market.average) * 100) === "suspicious"
  ) {
    problems.push("suspicious_cheap");
  }

  if (listing.url && context.duplicateUrls.has(listing.url.trim())) problems.push("duplicate_url");

  if (LIVE_STATUSES.has(listing.status)) {
    const lastSeen = new Date(listing.lastSeenAt ?? listing.createdAt).getTime();
    if (Number.isFinite(lastSeen) && context.now.getTime() - lastSeen > STALE_AFTER_DAYS * MS_PER_DAY) problems.push("stale");
  }

  return problems;
}

export function findDuplicateUrls(listings: Pick<ProblemCandidate, "url">[]): Set<string> {
  const counts = new Map<string, number>();
  for (const { url } of listings) {
    const key = url?.trim();
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, count]) => count > 1).map(([url]) => url));
}

export type ProblemListing = ProblemCandidate & { problems: ListingProblemKind[] };

export type ProblemReport = {
  listings: ProblemListing[];
  counts: Record<ListingProblemKind, number>;
  scanned: number;
  partial: boolean;
};

/** Pure: which of the candidates have problems, and how many per kind. */
export function buildProblemReport(candidates: ProblemCandidate[], markets: Map<number, ProductMarketContext>, now: Date = new Date()): ProblemReport {
  const context: ListingProblemContext = { markets, duplicateUrls: findDuplicateUrls(candidates), now };
  const counts = Object.fromEntries(LISTING_PROBLEM_KINDS.map((kind) => [kind, 0])) as Record<ListingProblemKind, number>;

  const listings: ProblemListing[] = [];
  for (const candidate of candidates) {
    const problems = detectListingProblems(candidate, context);
    if (problems.length === 0) continue;
    for (const kind of problems) counts[kind] += 1;
    listings.push({ ...candidate, problems });
  }
  return { listings, counts, scanned: candidates.length, partial: candidates.length >= PROBLEM_SCAN_LIMIT };
}

type ListingRow = {
  id: number;
  product_id: number;
  title: string;
  price: number;
  source: string;
  url: string | null;
  image_url: string | null;
  status: string;
  created_at: string;
  last_seen_at: string | null;
};

export async function loadProductMarkets(admin: AdminClient, productIds: number[]): Promise<Map<number, ProductMarketContext>> {
  const markets = new Map<number, ProductMarketContext>();
  for (let start = 0; start < productIds.length; start += PRODUCT_CHUNK) {
    const { data, error } = await admin
      .from("product_price_stats")
      .select("product_id, prices")
      .in("product_id", toBigintIds(productIds.slice(start, start + PRODUCT_CHUNK)));
    if (error) throw error;
    for (const row of data ?? []) {
      if (row.product_id == null) continue;
      const stats = calculateMarketStats((row.prices ?? []).map(Number));
      if (stats) markets.set(row.product_id, { average: stats.average, count: stats.count });
    }
  }
  return markets;
}

export async function loadProblemReport(admin: AdminClient, now: Date = new Date()): Promise<ProblemReport> {
  const rows: ListingRow[] = [];
  for (let offset = 0; offset < PROBLEM_SCAN_LIMIT; offset += PAGE_SIZE) {
    const { data, error } = await admin
      .from("listings")
      .select("id, product_id, title, price, source, url, image_url, status, created_at, last_seen_at")
      .in("status", OPEN_STATUSES)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as ListingRow[]));
    if ((data ?? []).length < PAGE_SIZE) break;
  }

  const candidates: ProblemCandidate[] = rows.map((row) => ({
    id: row.id,
    productId: row.product_id,
    title: row.title,
    price: Number(row.price),
    source: row.source,
    url: row.url,
    imageUrl: row.image_url,
    status: row.status,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
  }));
  const markets = await loadProductMarkets(admin, [...new Set(candidates.map((candidate) => candidate.productId))]);
  return buildProblemReport(candidates, markets, now);
}
