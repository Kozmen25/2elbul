import { NextResponse } from "next/server";
import { createProductSlug } from "@/lib/product-slug";
import { isPublicDemoListing, isPublicDemoProductName } from "@/lib/public-data-cleanup";
import { createSupabaseClient } from "@/lib/supabase";
import { detectQueryIntent } from "@/lib/search/query-intent-detector";
import { getSuggestionSearchTerms } from "@/lib/search/query-expansion";
import { buildIlikeOrFilter } from "@/lib/search/ilike-filter";
import { isMissingStatusColumn } from "@/lib/listing-status";
import { cacheGet, cacheSet, cacheKeyFrom } from "@/lib/cache";
import { toBigintIds } from "@/lib/supabase-ids";
import { getBrandCatalog } from "@/lib/brand-intelligence";
import { getAllCategories } from "@/lib/categories";
import {
  matchBrandSuggestions,
  matchCategorySuggestions,
  type BrandSuggestion,
  type CategorySuggestion,
} from "@/lib/search/suggestion-items";

type ProductRow = {
  id: string | number;
  name: string;
  attributes?: unknown;
};

type ListingProductRow = {
  product_id: string | number | null;
  title?: string | null;
  source?: string | null;
  url?: string | null;
};

type Suggestion = {
  id: string;
  name: string;
  listingCount: number;
  href: string;
};

const MAX_SUGGESTIONS = 8;
const MAX_SHORTCUT_SUGGESTIONS = 3;
/** The brand catalog scans every product, so it is reused between requests. */
const BRAND_CATALOG_TTL_MS = 5 * 60_000;
const MIN_SHORTCUT_QUERY_LENGTH = 2;

export async function GET(request: Request) {
  const supabase = createSupabaseClient();
  if (!supabase) {
    return NextResponse.json(emptyResponse());
  }

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();

  try {
    const matchingSuggestions = query ? await getMatchingSuggestions(query) : [];
    const suggestions =
      query && matchingSuggestions.length > 0
        ? matchingSuggestions
        : await getPopularSuggestions();

    const shortcuts =
      query.length >= MIN_SHORTCUT_QUERY_LENGTH ? await getShortcutSuggestions(query) : emptyShortcuts();

    return NextResponse.json({ suggestions, ...shortcuts });
  } catch (error) {
    console.error("Search suggestions failed:", error);
    return NextResponse.json(emptyResponse());
  }
}

type ShortcutSuggestions = { brands: BrandSuggestion[]; categories: CategorySuggestion[] };

function emptyShortcuts(): ShortcutSuggestions {
  return { brands: [], categories: [] };
}

function emptyResponse() {
  return { suggestions: [] satisfies Suggestion[], ...emptyShortcuts() };
}

/** Brand and category pages that match what is being typed. */
async function getShortcutSuggestions(query: string): Promise<ShortcutSuggestions> {
  const catalogKey = cacheKeyFrom({ type: "brand-catalog" });
  let catalog = cacheGet<Awaited<ReturnType<typeof getBrandCatalog>>>(catalogKey);
  if (!catalog) {
    catalog = await getBrandCatalog();
    cacheSet(catalogKey, catalog, BRAND_CATALOG_TTL_MS);
  }

  return {
    brands: matchBrandSuggestions(catalog, query, MAX_SHORTCUT_SUGGESTIONS),
    categories: matchCategorySuggestions(await getAllCategories(), query, MAX_SHORTCUT_SUGGESTIONS),
  };
}

async function getMatchingSuggestions(query: string): Promise<Suggestion[]> {
  const cacheKey = cacheKeyFrom({ type: "matching-suggestions", query });
  const cached = cacheGet<Suggestion[]>(cacheKey);
  if (cached) return cached;

  const supabase = createSupabaseClient();
  if (!supabase) return [];

  const searchTerms = getSuggestionSearchTerms(query);
  const productOrFilter = buildIlikeOrFilter("name", searchTerms);
  const titleOrFilter = buildIlikeOrFilter("title", searchTerms);

  const [productsResult, listingsResult] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, attributes")
      .or(productOrFilter)
      .limit(12),
    searchListingsByTitleOr(titleOrFilter),
  ]);

  if (productsResult.error) {
    console.error("Search suggestions product query failed:", productsResult.error);
  }
  if (listingsResult.error) {
    console.error("Search suggestions listing query failed:", listingsResult.error);
  }

  const counts = new Map<string, number>();
  const productIds = new Set<string>();

  for (const row of (productsResult.data ?? []) as ProductRow[]) {
    if (isPublicDemoProductName(String(row.name))) continue;
    productIds.add(String(row.id));
    counts.set(String(row.id), counts.get(String(row.id)) ?? 0);
  }

  for (const row of (listingsResult.data ?? []) as ListingProductRow[]) {
    if (!row.product_id) continue;
    if (isPublicDemoListing(row)) continue;
    const id = String(row.product_id);
    productIds.add(id);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  if (!productIds.size) return [];

  const { data, error } = await supabase
    .from("products")
    .select("id, name, attributes")
    .in("id", toBigintIds(productIds))
    .limit(50);

  if (error) {
    console.error("Search suggestions product detail query failed:", error);
    return [];
  }

  const result = toSuggestions(
    (data ?? []) as ProductRow[],
    counts,
    query,
    detectQueryIntent(query),
  );
  cacheSet(cacheKey, result, 30_000);
  return result;
}

async function getPopularSuggestions(): Promise<Suggestion[]> {
  const cacheKey = cacheKeyFrom({ type: "popular-suggestions" });
  const cached = cacheGet<Suggestion[]>(cacheKey);
  if (cached) return cached;

  const supabase = createSupabaseClient();
  if (!supabase) return [];

  const listingsResult = await searchRecentListingProducts();
  if (listingsResult.error) {
    console.error("Search suggestions popular listing query failed:", listingsResult.error);
    return [];
  }

  const counts = new Map<string, number>();
  for (const row of (listingsResult.data ?? []) as ListingProductRow[]) {
    if (!row.product_id) continue;
    if (isPublicDemoListing(row)) continue;
    const id = String(row.product_id);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  if (!counts.size) {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, attributes")
      .order("created_at", { ascending: false })
      .limit(MAX_SUGGESTIONS);

    if (error) {
      console.error("Search suggestions fallback product query failed:", error);
      return [];
    }

    return toSuggestions((data ?? []) as ProductRow[], counts);
  }

  const { data, error } = await supabase
    .from("products")
    .select("id, name, attributes")
    .in("id", toBigintIds(counts.keys()))
    .limit(50);

  if (error) {
    console.error("Search suggestions popular product query failed:", error);
    return [];
  }

  return toSuggestions((data ?? []) as ProductRow[], counts);
}

async function searchListingsByTitleOr(titleOrFilter: string) {
  const supabase = createSupabaseClient();
  if (!supabase) return { data: [], error: null };

  const result = await supabase
    .from("listings")
    .select("product_id, title, source, url")
    .in("status", ["published", "active"])
    .or(titleOrFilter)
    .limit(80);

  if (!result.error || !isMissingStatusColumn(result.error)) return result;

  return supabase
    .from("listings")
    .select("product_id, title, source, url")
    .or(titleOrFilter)
    .limit(80);
}

async function searchRecentListingProducts() {
  const supabase = createSupabaseClient();
  if (!supabase) return { data: [], error: null };

  const result = await supabase
    .from("listings")
    .select("product_id, title, source, url")
    .in("status", ["published", "active"])
    .order("created_at", { ascending: false })
    .limit(400);

  if (!result.error || !isMissingStatusColumn(result.error)) return result;

  return supabase
    .from("listings")
    .select("product_id, title, source, url")
    .order("created_at", { ascending: false })
    .limit(400);
}

/**
 * Extract PUE productType with confidence from a product's attributes.
 * Returns null when data is missing or malformed.
 */
function getPueProductType(attributes: unknown): { value: string; confidence: number } | null {
  if (!attributes || typeof attributes !== "object") return null;
  const record = attributes as Record<string, unknown>;
  const pu = record.productUnderstanding as Record<string, unknown> | undefined;
  if (!pu || typeof pu !== "object") return null;
  const pt = pu.productType as { value?: unknown; confidence?: unknown } | undefined;
  if (!pt || typeof pt !== "object") return null;
  if (typeof pt.value !== "string" || pt.value.length === 0) return null;
  return { value: pt.value, confidence: typeof pt.confidence === "number" ? pt.confidence : 0 };
}

function toSuggestions(
  products: ProductRow[],
  counts: Map<string, number>,
  query = "",
  intent?: { productType: string | null },
): Suggestion[] {
  const normalizedQuery = query.toLocaleLowerCase("tr-TR");

  return products
    .filter((product) => !isPublicDemoProductName(String(product.name)))
    .filter((product) => {
      if (!intent?.productType) return true;
      const pue = getPueProductType(product.attributes);
      if (!pue || pue.confidence < 70) return true;
      return pue.value === intent.productType;
    })
    .map((product) => ({
      id: String(product.id),
      name: String(product.name),
      listingCount: counts.get(String(product.id)) ?? 0,
      href: `/search?q=${encodeURIComponent(String(product.name))}`,
    }))
    .filter((item) => item.listingCount > 0)
    .sort((a, b) => {
      const aStarts = normalizedQuery
        ? a.name.toLocaleLowerCase("tr-TR").startsWith(normalizedQuery)
        : false;
      const bStarts = normalizedQuery
        ? b.name.toLocaleLowerCase("tr-TR").startsWith(normalizedQuery)
        : false;

      if (aStarts !== bStarts) return aStarts ? -1 : 1;
      if (b.listingCount !== a.listingCount) return b.listingCount - a.listingCount;
      return a.name.localeCompare(b.name, "tr-TR");
    })
    .filter((item, index, self) => {
      const slug = createProductSlug(item.name);
      return self.findIndex((other) => createProductSlug(other.name) === slug) === index;
    })
    .slice(0, MAX_SUGGESTIONS);
}
