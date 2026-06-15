import type { ListingCondition, ListingSource } from "@/lib/listings";
import { isMissingStatusColumn } from "@/lib/listing-status";
import { createSupabaseClient } from "@/lib/supabase";

export type HomeListing = {
  id: string;
  productName: string;
  title: string;
  price: number;
  city: string;
  source: ListingSource;
  url: string;
  condition: ListingCondition;
  imageUrl: string | null;
  createdAt: string;
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

export type PopularCategory = {
  name: string;
  listingCount: number;
};

export type HomeData = {
  latestListings: HomeListing[];
  popularProducts: PopularProduct[];
  popularListedProducts: PopularListedProduct[];
  priceDrops: PriceDrop[];
  popularCategories: PopularCategory[];
  error: string;
};

type ProductRow = {
  id: string | number;
  name: string;
  category?: string | null;
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
    popularProducts: [],
    popularListedProducts: [],
    priceDrops: [],
    popularCategories: [],
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
  ] =
    await Promise.all([
      supabase.from("products").select("id, name"),
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
  );
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
      if (!product) return null;

      return {
        id: String(listing.id),
        productName: product.name,
        title: listing.title,
        price: Number(listing.price),
        city: listing.city,
        source: listing.source,
        url: listing.url,
        condition: listing.condition,
        imageUrl: listing.image_url ? String(listing.image_url) : null,
        createdAt: listing.created_at,
        previousPrice:
          listing.previous_price == null
            ? null
            : Number(listing.previous_price),
        priceUpdatedAt: listing.price_updated_at,
      };
    })
    .filter((listing): listing is NonNullable<typeof listing> => Boolean(listing));

  const searchCounts = new Map<string, number>();
  for (const event of searchEventsResult.error
    ? []
    : (searchEventsResult.data ?? [])) {
    const productId = String(event.product_id);
    searchCounts.set(productId, (searchCounts.get(productId) ?? 0) + 1);
  }

  const popularProducts = [...searchCounts.entries()]
    .map(([productId, searchCount]) => ({
      productName: productMap.get(productId)?.name ?? "",
      searchCount,
    }))
    .filter((product) => product.productName)
    .sort((a, b) => b.searchCount - a.searchCount)
    .slice(0, 5);

  const listedProductStats = new Map<
    string,
    { count: number; total: number; lowest: number }
  >();
  for (const listing of normalizedListings) {
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
  const priceDrops = normalizedListings
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
  if (!categoriesResult.error) {
    for (const listing of listings) {
      const category =
        productMap.get(String(listing.product_id))?.category?.trim() ||
        "Diğer";
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    }
  }

  return {
    latestListings: normalizedListings.slice(0, 6),
    popularProducts,
    popularListedProducts,
    priceDrops,
    popularCategories: [...categoryCounts.entries()]
      .map(([name, listingCount]) => ({ name, listingCount }))
      .sort((a, b) => b.listingCount - a.listingCount)
      .slice(0, 6),
    error: "",
  };
}

async function getPublishedHomeListings(
  supabase: NonNullable<ReturnType<typeof createSupabaseClient>>,
) {
  const columns =
    "id, product_id, title, price, city, source, url, condition, image_url, created_at";
  const publishedResult = await supabase
    .from("listings")
    .select(columns)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (!publishedResult.error) return publishedResult;
  if (!isMissingStatusColumn(publishedResult.error)) return publishedResult;

  return supabase
    .from("listings")
    .select(columns)
    .order("created_at", { ascending: false });
}
