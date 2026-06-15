import { cache } from "react";
import type {
  Listing,
  ListingCondition,
  ListingSource,
} from "@/lib/listings";
import { isMissingStatusColumn } from "@/lib/listing-status";
import { createProductSlug } from "@/lib/product-slug";
import { createSupabaseClient } from "@/lib/supabase";

export type ProductRecord = {
  id: string;
  name: string;
  slug: string;
};

export type ProductDetailData = {
  product: ProductRecord;
  listings: Listing[];
};

type ProductRow = {
  id: string | number;
  name: string;
  slug?: string | null;
};

export const getProductBySlug = cache(
  async (slug: string): Promise<ProductRecord | null> => {
    const supabase = createSupabaseClient();
    if (!supabase) return null;

    const normalizedSlug = createProductSlug(slug);
    const slugResult = await supabase
      .from("products")
      .select("id, name, slug")
      .eq("slug", normalizedSlug)
      .maybeSingle();

    if (!slugResult.error && slugResult.data) {
      return {
        id: String(slugResult.data.id),
        name: String(slugResult.data.name),
        slug:
          String(slugResult.data.slug || "") ||
          createProductSlug(String(slugResult.data.name)),
      };
    }

    const fallbackResult = await supabase.from("products").select("id, name");
    if (fallbackResult.error) {
      console.error("Supabase product slug fallback failed:", fallbackResult.error);
      return null;
    }

    const product = ((fallbackResult.data ?? []) as ProductRow[]).find(
      (row) => createProductSlug(String(row.name)) === normalizedSlug,
    );

    return product
      ? {
          id: String(product.id),
          name: String(product.name),
          slug: createProductSlug(String(product.name)),
        }
      : null;
  },
);

export async function getProductDetail(
  slug: string,
): Promise<ProductDetailData | null> {
  const product = await getProductBySlug(slug);
  const supabase = createSupabaseClient();
  if (!product || !supabase) return null;

  let listingsResult = await supabase
    .from("listings")
    .select(
      "id, title, price, city, source, url, condition, image_url, created_at",
    )
    .eq("product_id", product.id)
    .eq("status", "published");

  if (
    listingsResult.error &&
    isMissingStatusColumn(listingsResult.error)
  ) {
    listingsResult = await supabase
      .from("listings")
      .select(
        "id, title, price, city, source, url, condition, image_url, created_at",
      )
      .eq("product_id", product.id);
  }

  if (listingsResult.error) {
    console.error(
      "Supabase product listings query failed:",
      listingsResult.error,
    );
    return { product, listings: [] };
  }

  const listings = (listingsResult.data ?? [])
    .map((listing) => ({
      id: String(listing.id),
      title: String(listing.title),
      productName: product.name,
      price: Number(listing.price),
      city: String(listing.city),
      source: listing.source as ListingSource,
      url: String(listing.url),
      condition: listing.condition as ListingCondition,
      imageUrl: listing.image_url ? String(listing.image_url) : null,
      createdAt: String(listing.created_at),
    }))
    .filter((listing) => Number.isFinite(listing.price));

  return { product, listings };
}
