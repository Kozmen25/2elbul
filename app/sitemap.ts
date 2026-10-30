import type { MetadataRoute } from "next";
import { isMissingStatusColumn } from "@/lib/listing-status";
import { extractBrand } from "@/lib/normalization";
import { createProductSlug } from "@/lib/product-slug";
import { getBrandCatalog } from "@/lib/brand-intelligence";
import { getCategoryCatalog } from "@/lib/category-intelligence";
import { getCityCatalog } from "@/lib/city-intelligence";
import {
  isPublicDemoListing,
  isPublicDemoProductName,
} from "@/lib/public-data-cleanup";
import { PRICE_LIST_PATH } from "@/lib/seo/landing-content";
import { getSiteUrl } from "@/lib/site-url";
import { createSupabaseClient } from "@/lib/supabase";
import { toBigintIds } from "@/lib/supabase-ids";

// Regenerated hourly; without this the sitemap is frozen at build time.
export const revalidate = 3600;

const STATIC_INFO_PATHS = ["/iletisim", "/gizlilik", "/kullanim-sartlari"];

type ProductRow = {
  id: string | number;
  name: string;
  slug?: string | null;
  created_at?: string | null;
};

type SitemapListingRow = {
  product_id: string | number | null;
  title?: string | null;
  source?: string | null;
  url?: string | null;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const now = new Date();
  const routes: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${siteUrl}/search`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/categories`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.75,
    },
    {
      url: `${siteUrl}${PRICE_LIST_PATH}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/market`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    ...STATIC_INFO_PATHS.map((path) => ({
      url: `${siteUrl}${path}`,
      lastModified: now,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];

  const brandCatalog = await getBrandCatalog();
  const toBrandRoute = (brand: (typeof brandCatalog)[number]) => ({
    url: `${siteUrl}/brand/${brand.slug}`,
    lastModified: brand.latestProductAt ? new Date(brand.latestProductAt) : now,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  });
  // Without listing data every brand is listed; once it loads, only brands
  // that have a model with live listings (others are noindex).
  let brandRoutes = brandCatalog.map(toBrandRoute);

  const categoryCatalog = await getCategoryCatalog();
  // Categories without listings are noindex, so they stay out of the sitemap.
  const categoryRoutes = categoryCatalog
    .filter((category) => category.listingCount > 0)
    .map((category) => ({
      url: `${siteUrl}/category/${category.slug}`,
      lastModified: category.latestListingAt ? new Date(category.latestListingAt) : now,
      changeFrequency: "weekly" as const,
      priority: 0.65,
    }));

  const cityCatalog = await getCityCatalog();
  const cityRoutes = cityCatalog.map((city) => ({
    url: `${siteUrl}/city/${city.slug}`,
    lastModified: city.latestListingAt ? new Date(city.latestListingAt) : now,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  const supabase = createSupabaseClient();
  if (!supabase) return [...routes, ...brandRoutes, ...categoryRoutes, ...cityRoutes];

  let listingsResult = await supabase
    .from("listings")
    .select("product_id, title, source, url")
    .in("status", ["published", "active"])
    .limit(2000);

  if (listingsResult.error && isMissingStatusColumn(listingsResult.error)) {
    listingsResult = await supabase
      .from("listings")
      .select("product_id, title, source, url")
      .limit(2000);
  }

  if (listingsResult.error) {
    console.error("Sitemap listing query failed:", listingsResult.error);
    return [...routes, ...brandRoutes, ...categoryRoutes, ...cityRoutes];
  }

  const publicProductIds = new Set(
    ((listingsResult.data ?? []) as SitemapListingRow[])
      .filter((listing) => !isPublicDemoListing(listing))
      .map((listing) => (listing.product_id == null ? "" : String(listing.product_id)))
      .filter(Boolean),
  );

  // No live listings at all: no brand page has content to index.
  if (!publicProductIds.size) return [...routes, ...categoryRoutes, ...cityRoutes];

  const { data, error } = await supabase
    .from("products")
    .select("id, name, slug, created_at")
    .in("id", toBigintIds(publicProductIds))
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("Sitemap product query failed:", error);
    return [...routes, ...brandRoutes, ...categoryRoutes, ...cityRoutes];
  }

  const publicProducts = ((data ?? []) as ProductRow[]).filter(
    (product) => !isPublicDemoProductName(product.name),
  );
  const listedBrandSlugs = new Set(
    publicProducts.map((product) => extractBrand(product.name)).filter(Boolean),
  );
  brandRoutes = brandCatalog
    .filter((brand) => listedBrandSlugs.has(brand.slug))
    .map(toBrandRoute);

  const productRoutes = publicProducts.map((product) => ({
      url: `${siteUrl}/product/${product.slug || createProductSlug(product.name)}`,
      lastModified: product.created_at ? new Date(product.created_at) : now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

  return [...routes, ...brandRoutes, ...categoryRoutes, ...cityRoutes, ...productRoutes];
}
