import type { MetadataRoute } from "next";
import { isMissingStatusColumn } from "@/lib/listing-status";
import { createProductSlug } from "@/lib/product-slug";
import {
  isPublicDemoListing,
  isPublicDemoProductName,
} from "@/lib/public-data-cleanup";
import { getSiteUrl } from "@/lib/site-url";
import { createSupabaseClient } from "@/lib/supabase";

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
      url: `${siteUrl}/ilan-ekle`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  const supabase = createSupabaseClient();
  if (!supabase) return routes;

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
    return routes;
  }

  const publicProductIds = new Set(
    ((listingsResult.data ?? []) as SitemapListingRow[])
      .filter((listing) => !isPublicDemoListing(listing))
      .map((listing) => (listing.product_id == null ? "" : String(listing.product_id)))
      .filter(Boolean),
  );

  if (!publicProductIds.size) return routes;

  const { data, error } = await supabase
    .from("products")
    .select("id, name, slug, created_at")
    .in("id", [...publicProductIds])
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("Sitemap product query failed:", error);
    return routes;
  }

  const productRoutes = ((data ?? []) as ProductRow[])
    .filter((product) => !isPublicDemoProductName(product.name))
    .map((product) => ({
      url: `${siteUrl}/product/${product.slug || createProductSlug(product.name)}`,
      lastModified: product.created_at ? new Date(product.created_at) : now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

  return [...routes, ...productRoutes];
}
