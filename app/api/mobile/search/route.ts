import { createSupabaseClient } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { detectQueryIntent } from "@/lib/search/query-intent-detector";
import { attachPueScore } from "@/lib/search/pue-ranking";
import { extractProductTypeFromAttributes } from "@/lib/market-intelligence/helpers";
import { isMissingAttributesColumn, isMissingStatusColumn } from "@/lib/listing-status";
import { createProductSlug } from "@/lib/product-slug";
import { isPublicDemoListing, isPublicDemoProductName } from "@/lib/public-data-cleanup";
import { mobileSuccess, mobileError } from "@/lib/mobile/response";
import type { Listing, ListingCondition, ListingSource } from "@/lib/listings";
import type {
  MobileSearchResponse,
  MobileSearchIntent,
  MobileSearchProductHit,
  MobileSearchListingHit,
  MobileSearchFilterSummary,
  MobilePagination,
} from "@/lib/mobile/types";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const LISTING_COLUMNS =
  "id, product_id, title, price, city, source, url, condition, image_url, created_at";

type ListingRow = {
  id: string | number;
  product_id: string | number;
  title: string;
  price: string | number;
  city: string;
  source: ListingSource;
  url: string;
  condition: ListingCondition;
  image_url: string | null;
  created_at: string;
};

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = (searchParams.get("q") ?? "").trim();
  const minPrice = safeParseNumber(searchParams.get("min"));
  const maxPrice = safeParseNumber(searchParams.get("max"));
  const sourceFilter = searchParams.get("source")?.trim() || null;
  const sort = (searchParams.get("sort") ?? "relevance") as
    | "relevance"
    | "price_asc"
    | "price_desc"
    | "newest";
  const page = Math.max(1, safeParseNumber(searchParams.get("page")) ?? 1);
  const limit = Math.min(100, Math.max(1, safeParseNumber(searchParams.get("limit")) ?? 20));

  if (!query) {
    return mobileSuccess(emptySearchResponse(query, page, limit));
  }

  const supabase = createSupabaseClient();
  if (!supabase) {
    return mobileError("Supabase bağlantısı yapılandırılmamış.", 500);
  }

  const intent = detectQueryIntent(query);

  const [matchingProductsResults, titleListingsResults] = await Promise.all([
    Promise.all(
      [query].map((term) =>
        supabase
          .from("products")
          .select("id, name, category, attributes")
          .ilike("name", `%${term}%`),
      ),
    ),
    Promise.all(
      [query].map((term) =>
        searchPublishedListingsByTitle(supabase, `%${term}%`),
      ),
    ),
  ]);

  const productSearchError = matchingProductsResults.find((r) => r.error)?.error;
  const titleSearchError = titleListingsResults.find((r) => r.error)?.error;
  if (productSearchError || titleSearchError) {
    console.error("Mobile search failed:", productSearchError ?? titleSearchError);
    return mobileError("İlanlar aranırken bir sorun oluştu.", 500);
  }

  const matchingProductsById = new Map<string, { id: string | number; name: string; category: string | null; attributes?: unknown }>();
  for (const result of matchingProductsResults) {
    for (const product of result.data ?? []) {
      matchingProductsById.set(String(product.id), {
        id: product.id,
        name: String(product.name),
        category: 'category' in product ? String(product.category) : null,
        attributes: (product as { attributes?: unknown }).attributes,
      });
    }
  }

  const matchingProductIds = [...matchingProductsById.values()]
    .filter((product) => !isPublicDemoProductName(product.name))
    .map((product) => product.id);

  const productListingsResult = matchingProductIds.length
    ? await searchPublishedListingsByProduct(supabase, matchingProductIds)
    : { data: [], error: null };

  if (productListingsResult.error) {
    console.error("Mobile search product listings failed:", productListingsResult.error);
    return mobileError("İlanlar aranırken bir sorun oluştu.", 500);
  }

  const rowsById = new Map<string, ListingRow>();
  for (const row of [
    ...(titleListingsResults.flatMap((r) => (r.data ?? []) as ListingRow[])),
    ...((productListingsResult.data ?? []) as ListingRow[]),
  ]) {
    rowsById.set(String(row.id), row as ListingRow);
  }

  const rows = [...rowsById.values()].filter((row) => !isPublicDemoListing(row));
  const productIds = [...new Set(rows.map((row) => String(row.product_id)))];
  const productsResult = productIds.length
    ? await supabase
        .from("products")
        .select("id, name, slug, category, attributes")
        .in("id", productIds)
        .then((result) => {
          if (!result.error || !isMissingAttributesColumn(result.error)) return result;
          return supabase
            .from("products")
            .select("id, name, slug, category")
            .in("id", productIds);
        })
    : { data: [], error: null };

  if (productsResult.error) {
    return mobileError("İlanlar aranırken bir sorun oluştu.", 500);
  }

  const productData = new Map(
    (productsResult.data ?? [])
      .filter((p) => !isPublicDemoProductName(String(p.name)))
      .map((p) => [
        String(p.id),
        {
          name: String(p.name),
          slug: p.slug ? String(p.slug) : createProductSlug(String(p.name)),
          category: 'category' in p ? String(p.category) : null,
        },
      ]),
  );

  const productLookup = new Map<string, { attributes?: unknown }>(
    (productsResult.data ?? [])
      .filter((p) => !isPublicDemoProductName(String(p.name)))
      .filter((p) => (p as { attributes?: unknown }).attributes != null)
      .map((p) => [
        String(p.id),
        { attributes: (p as { attributes?: unknown }).attributes },
      ]),
  );

  let allListings: MobileSearchListingHit[] = rows
    .map((row): MobileSearchListingHit | null => {
      const product = productData.get(String(row.product_id));
      if (!product) return null;
      return {
        id: String(row.id),
        title: String(row.title),
        price: Number(row.price),
        city: String(row.city),
        source: row.source,
        condition: row.condition,
        imageUrl: row.image_url ? String(row.image_url) : null,
        url: String(row.url),
        createdAt: String(row.created_at),
        productId: String(row.product_id),
        productName: product.name,
        productSlug: product.slug as string | null,
        category: product.category ?? null,
        productType: (() => {
          const lookup = productLookup.get(String(row.product_id));
          return lookup ? extractProductTypeFromAttributes(lookup.attributes) : null;
        })(),
        score: attachPueScore(intent, String(row.product_id), productLookup),
      };
    })
    .filter(Boolean) as MobileSearchListingHit[];

  // Apply filters
  if (minPrice !== null) allListings = allListings.filter((l) => l.price >= minPrice!);
  if (maxPrice !== null) allListings = allListings.filter((l) => l.price <= maxPrice!);
  if (sourceFilter) {
    allListings = allListings.filter(
      (l) => l.source.toLowerCase() === sourceFilter.toLowerCase(),
    );
  }

  // Sort
  if (sort === "price_asc") {
    allListings.sort((a, b) => a.price - b.price);
  } else if (sort === "price_desc") {
    allListings.sort((a, b) => b.price - a.price);
  } else if (sort === "newest") {
    allListings.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  } else {
    // relevance (default)
    allListings.sort((a, b) => b.score - a.score || a.price - b.price);
  }

  const total = allListings.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const offset = (page - 1) * limit;
  const paginatedListings = allListings.slice(offset, offset + limit);

  // Build product hits from paginated listings
  const seenProductIds = new Set<string>();
  const productHits: MobileSearchProductHit[] = [];
  for (const listing of paginatedListings) {
    if (seenProductIds.has(listing.productId)) continue;
    seenProductIds.add(listing.productId);
    const productListings = allListings.filter(
      (l) => l.productId === listing.productId,
    );
    const prices = productListings.map((l) => l.price);
    productHits.push({
      id: listing.productId,
      name: listing.productName,
      slug: listing.productSlug,
      category: listing.category ?? null,
      listingCount: productListings.length,
      minPrice: Math.min(...prices),
      averagePrice: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
    });
  }

  // Filter summaries (from all matched listings)
  const sourceCounts = new Map<string, number>();
  const conditionCounts = new Map<string, number>();
  let filterMin = Infinity;
  let filterMax = -Infinity;
  for (const l of allListings) {
    sourceCounts.set(l.source, (sourceCounts.get(l.source) ?? 0) + 1);
    conditionCounts.set(l.condition, (conditionCounts.get(l.condition) ?? 0) + 1);
    if (l.price < filterMin) filterMin = l.price;
    if (l.price > filterMax) filterMax = l.price;
  }

  const filters: MobileSearchFilterSummary = {
    sources: [...sourceCounts.entries()]
      .map(([source, count]) => ({ source: source as ListingSource, count }))
      .sort((a, b) => b.count - a.count),
    conditions: [...conditionCounts.entries()]
      .map(([condition, count]) => ({ condition: condition as ListingCondition, count }))
      .sort((a, b) => b.count - a.count),
    priceRange: {
      min: Number.isFinite(filterMin) ? filterMin : 0,
      max: Number.isFinite(filterMax) ? filterMax : 0,
    },
  };

  // Auth check for favorites
  let isAuthenticated = false;
  let favoriteListingIds: string[] = [];
  const serverSupabase = await createSupabaseServerClient();
  if (serverSupabase) {
    const { data: authData } = await serverSupabase.auth.getUser();
    if (authData?.user) {
      isAuthenticated = true;
      const { data: favData } = await serverSupabase
        .from("favorites")
        .select("listing_id")
        .eq("user_id", authData.user.id);
      favoriteListingIds = (favData ?? []).map((f) => String(f.listing_id));
    }
  }

  const pagination: MobilePagination = { page, limit, total, totalPages };
  const mobileIntent: MobileSearchIntent = {
    query: intent.rawQuery,
    label: intent.productType ?? null,
    matchedCategories: [],
    isBroadCategory: false,
  };

  const response: MobileSearchResponse = {
    query,
    intent: intent.rawQuery ? mobileIntent : null,
    products: productHits,
    listings: paginatedListings,
    filters,
    pagination,
    isAuthenticated,
    favoriteListingIds,
  };

  return mobileSuccess(response);
}

function emptySearchResponse(
  query: string,
  page: number,
  limit: number,
): MobileSearchResponse {
  return {
    query,
    intent: null,
    products: [],
    listings: [],
    filters: { sources: [], conditions: [], priceRange: { min: 0, max: 0 } },
    pagination: { page, limit, total: 0, totalPages: 0 },
    isAuthenticated: false,
    favoriteListingIds: [],
  };
}

function safeParseNumber(value: string | null): number | null {
  if (value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function searchPublishedListingsByTitle(
  supabase: NonNullable<ReturnType<typeof createSupabaseClient>>,
  pattern: string,
) {
  const result = await supabase
    .from("listings")
    .select(LISTING_COLUMNS)
    .in("status", ["published", "active"])
    .ilike("title", pattern);
  if (!result.error || !isMissingStatusColumn(result.error)) return result;

  return supabase
    .from("listings")
    .select(LISTING_COLUMNS)
    .ilike("title", pattern);
}

async function searchPublishedListingsByProduct(
  supabase: NonNullable<ReturnType<typeof createSupabaseClient>>,
  productIds: (string | number)[],
) {
  const result = await supabase
    .from("listings")
    .select(LISTING_COLUMNS)
    .in("status", ["published", "active"])
    .in("product_id", productIds);
  if (!result.error || !isMissingStatusColumn(result.error)) return result;

  return supabase
    .from("listings")
    .select(LISTING_COLUMNS)
    .in("product_id", productIds);
}
