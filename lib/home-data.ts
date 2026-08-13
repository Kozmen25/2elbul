import type { ListingCondition, ListingSource } from "@/lib/listings";
import { isMissingAttributesColumn, isMissingStatusColumn } from "@/lib/listing-status";
import { buildMarketPulse, type MarketPulse } from "@/lib/market-pulse";
import { isPublicDemoListing, isPublicDemoProductName } from "@/lib/public-data-cleanup";
import { createSupabaseClient } from "@/lib/supabase";
import { extractProductTypeFromAttributes } from "@/lib/market-intelligence/helpers";
import { getCategoryForProductType } from "@/lib/taxonomy/product-type-mapping";
import { ACCESSORY_PATTERNS } from "@/lib/product-understanding/accessory-patterns";

export type { MarketPulseItem } from "@/lib/market-pulse";

export type HomeListing = {
  id: string;
  productId: string;
  productName: string;
  title: string;
  price: number;
  city: string;
  source: ListingSource;
  url: string;
  condition: ListingCondition;
  imageUrl: string | null;
  createdAt: string;
  category: string | null;
  productType: string | null;
};

export type PopularProduct = {
  productName: string;
  searchCount: number;
};

export type PopularListedProduct = {
  productName: string;
  listingCount: number;
  lowestPrice: number;
  averagePrice: number;
};

export type PriceDrop = HomeListing & {
  previousPrice: number;
  discountRate: number;
};

export type PriceOpportunity = HomeListing & {
  averagePrice: number;
  discountRate: number;
};

export type PopularCategory = {
  name: string;
  listingCount: number;
};

export type SourceSummary = {
  source: string;
  listingCount: number;
};

export type HomeData = {
  latestListings: HomeListing[];
  refurbishedListings: HomeListing[];
  priceOpportunities: PriceOpportunity[];
  last24HourListings: HomeListing[];
  sourceSummary: SourceSummary[];
  popularProducts: PopularProduct[];
  popularListedProducts: PopularListedProduct[];
  priceDrops: PriceDrop[];
  popularCategories: PopularCategory[];
  marketPulse: MarketPulse;
  error: string;
};

type ProductRow = {
  id: string | number;
  name: string;
  category?: string | null;
  attributes?: unknown;
};

type ListingRow = {
  id: string | number;
  product_id: string | number;
  title: string;
  price: number | string;
  city: string;
  source: ListingSource;
  url: string;
  condition: ListingCondition;
  image_url?: string | null;
  created_at: string;
  previous_price?: number | string | null;
  price_updated_at?: string | null;
};

export async function getHomeData(): Promise<HomeData> {
  const emptyData: HomeData = {
    latestListings: [],
    refurbishedListings: [],
    priceOpportunities: [],
    last24HourListings: [],
    sourceSummary: [],
    popularProducts: [],
    popularListedProducts: [],
    priceDrops: [],
    popularCategories: [],
    marketPulse: buildMarketPulse({ products: [], listings: [] }),
    error: "",
  };
  const supabase = createSupabaseClient();

  if (!supabase) {
    return {
      ...emptyData,
      error: "Supabase bağlantısı yapılandırılmamış.",
    };
  }

  const [
    productsResult,
    listingsResult,
    categoriesResult,
    priceDataResult,
    searchEventsResult,
    searchDemandsResult,
  ] =
    await Promise.all([
      getHomeProducts(supabase),
      getPublishedHomeListings(supabase),
      supabase.from("products").select("id, category"),
      supabase
        .from("listings")
        .select("id, previous_price, price_updated_at"),
      supabase
        .from("search_events")
        .select("product_id, created_at")
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase
        .from("search_demands")
        .select("query, normalized_query, requested_at")
        .order("requested_at", { ascending: false })
        .limit(1000),
    ]);

  if (productsResult.error) {
    console.error("Supabase homepage products query failed:", productsResult.error);
  }
  if (listingsResult.error) {
    console.error("Supabase homepage listings query failed:", listingsResult.error);
  }
  if (productsResult.error || listingsResult.error) {
    return {
      ...emptyData,
      error: "Ana sayfa verileri yüklenirken bir sorun oluştu.",
    };
  }

  const categories = new Map(
    (categoriesResult.error ? [] : (categoriesResult.data ?? [])).map((product) => [
      String(product.id),
      product.category ? String(product.category) : null,
    ]),
  );
  const priceData = new Map(
    (priceDataResult.error ? [] : (priceDataResult.data ?? [])).map((listing) => [
      String(listing.id),
      {
        previousPrice:
          listing.previous_price == null
            ? null
            : Number(listing.previous_price),
        priceUpdatedAt: listing.price_updated_at
          ? String(listing.price_updated_at)
          : null,
      },
    ]),
  );
  const products = ((productsResult.data ?? []) as ProductRow[]).map(
    (product) => ({
      ...product,
      category: categories.get(String(product.id)) ?? null,
    }),
  ).filter((product) => !isPublicDemoProductName(String(product.name)));
  const listings = ((listingsResult.data ?? []) as ListingRow[]).map(
    (listing) => {
      const optionalPriceData = priceData.get(String(listing.id));
      return {
        ...listing,
        previous_price: optionalPriceData?.previousPrice ?? null,
        price_updated_at: optionalPriceData?.priceUpdatedAt ?? null,
      };
    },
  );
  const productMap = new Map(
    products.map((product) => [String(product.id), product]),
  );
  const normalizedListings = listings
    .map((listing) => {
      const product = productMap.get(String(listing.product_id));
      const price = Number(listing.price);
      if (!product || !Number.isFinite(price) || price <= 0) return null;

      let category = product.category ?? null;

      // Product Understanding Engine override: resolve category from PUE productType.
      // This catches cases like "iPhone 14 Pro Max Ekran Koruyucu" where the
      // product IS an accessory even if the product name matches a phone pattern.
      const pueProductType = extractProductTypeFromAttributes(product.attributes);
      const pueCategory = getCategoryForProductType(pueProductType);
      if (pueCategory) {
        category = pueCategory;
      }

      return {
        id: String(listing.id),
        productId: String(product.id),
        productName: product.name,
        category,
        title: listing.title,
        price,
        city: listing.city,
        source: listing.source,
        url: listing.url,
        condition: listing.condition,
        imageUrl: listing.image_url ? String(listing.image_url) : null,
        createdAt: listing.created_at,
        productType: pueProductType,
        previousPrice:
          listing.previous_price == null
            ? null
            : Number(listing.previous_price),
        priceUpdatedAt: listing.price_updated_at,
      };
    })
    .filter((listing): listing is NonNullable<typeof listing> => Boolean(listing));
  const publicListings = normalizedListings.filter(
    (listing) => !isPublicDemoListing(listing),
  );

  const NON_PRIMARY_TYPES = new Set(["accessory", "spare_part", "service"]);

  // Title-based accessory detection: catches old contaminated listings whose
  // productId points to a phone product but whose title clearly indicates an
  // accessory. This is a secondary defense — the primary defense is the PUE
  // productType gate above.
  function hasAccessoryInTitle(title: string): boolean {
    return ACCESSORY_PATTERNS.some((entry) =>
      entry.patterns.some((pattern) => pattern.test(title)),
    );
  }

  const primaryListings = publicListings.filter((listing) => {
    // Exclude known non-primary product types (accessory, spare_part, service)
    if (listing.productType && NON_PRIMARY_TYPES.has(listing.productType)) {
      return false;
    }

    // Secondary defense: for old contaminated data where the listing's productId
    // points to a phone product (PUE says "primary_product") but the listing
    // title clearly indicates an accessory, exclude it anyway.
    if (listing.productType === "primary_product" && hasAccessoryInTitle(listing.title)) {
      return false;
    }

    return true;
  });

  const productLookup = new Map(
    products.map((product) => [String(product.name), product]),
  );

  const searchCounts = new Map<string, number>();
  for (const event of searchEventsResult.error
    ? []
    : (searchEventsResult.data ?? [])) {
    const productId = String(event.product_id);
    searchCounts.set(productId, (searchCounts.get(productId) ?? 0) + 1);
  }
  const marketPulseSearches = [
    ...(searchEventsResult.error
      ? []
      : (searchEventsResult.data ?? []).map((event) => ({
          productId: String(event.product_id),
          createdAt: String(event.created_at ?? ""),
        }))),
    ...(searchDemandsResult.error
      ? []
      : (searchDemandsResult.data ?? []).map((demand) => ({
          query: String(demand.query ?? ""),
          normalizedQuery: String(demand.normalized_query ?? ""),
          createdAt: String(demand.requested_at ?? ""),
        }))),
  ];

  const popularProducts = [...searchCounts.entries()]
    .map(([productId, searchCount]) => ({
      productName: productMap.get(productId)?.name ?? "",
      searchCount,
    }))
    .filter((product) => product.productName)
    .sort((a, b) => b.searchCount - a.searchCount)
    .slice(0, 8);

  const listedProductStats = new Map<
    string,
    { count: number; total: number; lowest: number }
  >();
  for (const listing of primaryListings) {
    const product = productLookup.get(listing.productName);
    if (!product) continue;
    const current = listedProductStats.get(listing.productName) ?? {
      count: 0,
      total: 0,
      lowest: listing.price,
    };
    listedProductStats.set(listing.productName, {
      count: current.count + 1,
      total: current.total + listing.price,
      lowest: Math.min(current.lowest, listing.price),
    });
  }

  // Category-aware stats for price opportunities — prevents cross-category contamination
  // e.g. "iPhone 14 Pro Max Ekran Koruyucu" (aksesuar) priced against phone averages
  const productCategoryStats = new Map<
    string,
    { count: number; total: number; lowest: number }
  >();
  for (const listing of primaryListings) {
    const key = `${listing.productName}||${listing.category ?? ""}`;
    const current = productCategoryStats.get(key) ?? {
      count: 0,
      total: 0,
      lowest: listing.price,
    };
    productCategoryStats.set(key, {
      count: current.count + 1,
      total: current.total + listing.price,
      lowest: Math.min(current.lowest, listing.price),
    });
  }

  const popularListedProducts = [...listedProductStats.entries()]
    .map(([productName, stats]) => ({
      productName,
      listingCount: stats.count,
      lowestPrice: stats.lowest,
      averagePrice: Math.round(stats.total / stats.count),
    }))
    .sort(
      (a, b) =>
        b.listingCount - a.listingCount ||
        a.averagePrice - b.averagePrice ||
        a.productName.localeCompare(b.productName, "tr"),
    )
    .slice(0, 8);

  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const refurbishedListings = primaryListings
    .filter((listing) => listing.condition === "Yenilenmiş")
    .slice(0, 8);
  const last24HourMatches = primaryListings.filter(
    (listing) => new Date(listing.createdAt).getTime() >= oneDayAgo,
  );
  const last24HourListings = (
    last24HourMatches.length > 0 ? last24HourMatches : primaryListings
  ).slice(0, 8);
  const analyzedPriceOpportunities = primaryListings
    .map((listing) => {
      const key = `${listing.productName}||${listing.category ?? ""}`;
      const stats = productCategoryStats.get(key);
      if (!stats || stats.count < 2) return null;

      const averagePrice = stats.total / stats.count;
      if (listing.price >= averagePrice) return null;

      return {
        ...listing,
        averagePrice: Math.round(averagePrice),
        discountRate: Math.round(
          ((averagePrice - listing.price) / averagePrice) * 100,
        ),
      };
    })
    .filter(
      (listing): listing is NonNullable<typeof listing> => Boolean(listing),
    )
    .sort(
      (a, b) =>
        a.price - b.price ||
        b.discountRate - a.discountRate ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 8);
  const opportunityIds = new Set(
    analyzedPriceOpportunities.map((listing) => listing.id),
  );
  const fallbackOpportunities: PriceOpportunity[] = primaryListings
    .filter((listing) => !opportunityIds.has(listing.id))
    .sort(
      (a, b) =>
        a.price - b.price ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .map((listing) => {
      const key = `${listing.productName}||${listing.category ?? ""}`;
      const stats = productCategoryStats.get(key);
      const averagePrice = stats ? stats.total / stats.count : listing.price;
      return {
        ...listing,
        averagePrice: Math.round(averagePrice),
        discountRate: Math.max(
          0,
          Math.round(((averagePrice - listing.price) / averagePrice) * 100),
        ),
      };
    });
  const priceOpportunities: PriceOpportunity[] = [
    ...analyzedPriceOpportunities,
    ...fallbackOpportunities,
  ]
    .slice(0, 8);
  const priceDrops = primaryListings
    .filter(
      (listing) =>
        listing.previousPrice !== null &&
        listing.previousPrice > listing.price &&
        Boolean(listing.priceUpdatedAt) &&
        new Date(listing.priceUpdatedAt as string).getTime() >= oneDayAgo,
    )
    .map((listing) => ({
      ...listing,
      previousPrice: listing.previousPrice as number,
      discountRate: Math.round(
        (((listing.previousPrice as number) - listing.price) /
          (listing.previousPrice as number)) *
          100,
      ),
    }))
    .sort((a, b) => b.discountRate - a.discountRate)
    .slice(0, 6);

  const categoryCounts = new Map<string, number>();
  for (const listing of primaryListings) {
    const category = listing.category?.trim() || "Diğer";
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
  }
  const summarizedSources = [
    "Sahibinden",
    "Letgo",
    "Facebook Marketplace",
    "EasyCep",
    "Getmobil",
  ];
  const sourceCounts = new Map<string, number>();
  for (const listing of publicListings) {
    sourceCounts.set(
      listing.source,
      (sourceCounts.get(listing.source) ?? 0) + 1,
    );
  }

  const productLookupByAttributes = new Map<string, { attributes?: unknown }>(
    products.map((product) => [String(product.id), { attributes: product.attributes }]),
  );

  return {
    latestListings: primaryListings.slice(0, 6),
    refurbishedListings,
    priceOpportunities,
    last24HourListings,
    sourceSummary: summarizedSources.map((source) => ({
      source,
      listingCount: sourceCounts.get(source) ?? 0,
    })),
    popularProducts,
    popularListedProducts,
    priceDrops,
    popularCategories: [...categoryCounts.entries()]
      .map(([name, listingCount]) => ({ name, listingCount }))
      .sort((a, b) => b.listingCount - a.listingCount)
      .slice(0, 6),
    marketPulse: buildMarketPulse({
      products: products.map((product) => ({
        id: product.id,
        name: String(product.name),
      })),
      listings: primaryListings
        .map((listing) => ({
          productId: listing.productId,
          productName: listing.productName,
          price: listing.price,
          createdAt: listing.createdAt,
        })),
      searches: marketPulseSearches,
      limit: 5,
      expectedProductType: "primary_product",
      productLookup: productLookupByAttributes,
    }),
    error: "",
  };
}

async function getHomeProducts(
  supabase: NonNullable<ReturnType<typeof createSupabaseClient>>,
) {
  const attrsResult = await supabase
    .from("products")
    .select("id, name, attributes");

  if (!attrsResult.error) return attrsResult;
  if (!isMissingAttributesColumn(attrsResult.error)) return attrsResult;

  return supabase
    .from("products")
    .select("id, name");
}

async function getPublishedHomeListings(
  supabase: NonNullable<ReturnType<typeof createSupabaseClient>>,
) {
  const columns =
    "id, product_id, title, price, city, source, url, condition, image_url, created_at";
  const publishedResult = await supabase
    .from("listings")
    .select(columns)
    .in("status", ["published", "active"])
    .order("created_at", { ascending: false });

  if (!publishedResult.error) return publishedResult;
  if (!isMissingStatusColumn(publishedResult.error)) return publishedResult;

  return supabase
    .from("listings")
    .select(columns)
    .order("created_at", { ascending: false });
}
