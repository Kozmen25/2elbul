import { createSupabaseClient } from "@/lib/supabase";
import { getHomeData, type HomeListing } from "@/lib/home-data";
import { createProductSlug } from "@/lib/product-slug";
import { mobileSuccess, mobileError } from "@/lib/mobile/response";
import type {
  MobileHomeResponse,
  MobileHomeListing,
  MobileHomeCategory,
  MobileHomeProduct,
} from "@/lib/mobile/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const homeData = await getHomeData();
  if (homeData.error) {
    return mobileError(homeData.error, 500);
  }

  const productMap = await fetchProductMap();
  const resolveProduct = (productName: string) => {
    const found = productMap.get(productName.toLowerCase());
    if (found) return { productId: found.id, productSlug: found.slug };
    return { productId: productName, productSlug: createProductSlug(productName) };
  };

  const totalListings = homeData.sourceSummary.reduce(
    (sum, s) => sum + s.listingCount,
    0,
  );
  const totalProducts = homeData.popularListedProducts.length;
  const prices = homeData.latestListings.map((l) => l.price).filter(Number.isFinite);
  const avgPrice = prices.length > 0
    ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
    : 0;
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
  const sourceCount = homeData.sourceSummary.filter((s) => s.listingCount > 0).length;

  const response: MobileHomeResponse = {
    hero: {
      totalListings,
      totalProducts,
      newToday: homeData.last24HourListings.length,
    },
    categories: toMobileCategories(homeData.popularCategories),
    aiRecommendations: homeData.priceOpportunities.slice(0, 6).map((l) =>
      toMobileHomeListing(l, resolveProduct(l.productName)),
    ),
    trendingProducts: homeData.popularListedProducts.slice(0, 8).map(
      toMobileHomeProduct,
    ),
    latestListings: homeData.latestListings.slice(0, 10).map((l) =>
      toMobileHomeListing(l, resolveProduct(l.productName)),
    ),
    marketSummary: {
      totalListings,
      totalProducts,
      averagePrice: avgPrice,
      priceRange: { min: minPrice, max: maxPrice },
      sourceCount,
      lastUpdated: null,
    },
  };

  return mobileSuccess(response);
}

async function fetchProductMap(): Promise<Map<string, { id: string; slug: string }>> {
  const supabase = createSupabaseClient();
  if (!supabase) return new Map();

  const { data } = await supabase.from("products").select("id, name, slug");
  if (!data) return new Map();

  const map = new Map<string, { id: string; slug: string }>();
  for (const p of data) {
    const name = String(p.name).toLowerCase();
    const slug = p.slug ? String(p.slug) : createProductSlug(String(p.name));
    map.set(name, { id: String(p.id), slug });
  }
  return map;
}

function toMobileCategories(
  categories: { name: string; listingCount: number }[],
): MobileHomeCategory[] {
  return categories.map((cat) => ({
    id: cat.name,
    name: cat.name,
    slug: cat.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
    listingCount: cat.listingCount,
  }));
}

function toMobileHomeListing(
  l: HomeListing,
  resolved: { productId: string; productSlug: string },
): MobileHomeListing {
  return {
    id: l.id,
    title: l.title,
    price: l.price,
    city: l.city,
    source: l.source,
    condition: l.condition,
    imageUrl: l.imageUrl,
    createdAt: l.createdAt,
    productId: resolved.productId,
    productName: l.productName,
    productSlug: resolved.productSlug,
  };
}

function toMobileHomeProduct(p: {
  productName: string;
  listingCount: number;
  lowestPrice: number;
  averagePrice: number;
}): MobileHomeProduct {
  return {
    id: p.productName,
    name: p.productName,
    slug: createProductSlug(p.productName),
    listingCount: p.listingCount,
    minPrice: p.lowestPrice,
    averagePrice: p.averagePrice,
  };
}

// toMobileMarketPulse removed — home stats computed inline
