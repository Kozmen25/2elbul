import { cache } from "react";
import type {
  Listing,
  ListingCondition,
  ListingSource,
} from "@/lib/listings";
import { isMissingStatusColumn } from "@/lib/listing-status";
import type { PriceHistoryRecord } from "@/lib/price-insights";
import { createProductSlug } from "@/lib/product-slug";
import { createSupabaseClient } from "@/lib/supabase";

export type ProductRecord = {
  id: string;
  name: string;
  slug: string;
  category: string | null;
};

export type ProductDetailData = {
  product: ProductRecord;
  listings: Listing[];
  priceHistory: PriceHistoryRecord[];
};

type ProductRow = {
  id: string | number;
  name: string;
  slug?: string | null;
  category?: string | null;
};

export const getProductBySlug = cache(
  async (slug: string): Promise<ProductRecord | null> => {
    const supabase = createSupabaseClient();
    if (!supabase) return null;

    const normalizedSlug = createProductSlug(slug);
    const slugResult = await supabase
      .from("products")
      .select("id, name, slug, category")
      .eq("slug", normalizedSlug)
      .maybeSingle();

    if (!slugResult.error && slugResult.data) {
      return {
        id: String(slugResult.data.id),
        name: String(slugResult.data.name),
        slug:
          String(slugResult.data.slug || "") ||
          createProductSlug(String(slugResult.data.name)),
        category:
          "category" in slugResult.data && slugResult.data.category
            ? String(slugResult.data.category)
            : null,
      };
    }

    let fallbackResult = await supabase
      .from("products")
      .select("id, name, category");
    if (fallbackResult.error && isMissingProductCategoryColumn(fallbackResult.error)) {
      fallbackResult = await supabase.from("products").select("id, name");
    }

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
          category:
            "category" in product && product.category
              ? String(product.category)
              : null,
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
    .in("status", ["published", "active"]);

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
    return { product, listings: [], priceHistory: [] };
  }

  const listings = (listingsResult.data ?? [])
    .map((listing) => ({
      id: String(listing.id),
      productId: product.id,
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

  const historyResult = await supabase
    .from("price_history")
    .select("price, recorded_at")
    .eq("product_id", product.id)
    .order("recorded_at", { ascending: true })
    .limit(2000);

  if (historyResult.error && !isMissingPriceHistoryTable(historyResult.error)) {
    console.error("Supabase product price history query failed:", historyResult.error);
  }

  const priceHistory = historyResult.error
    ? []
    : (historyResult.data ?? [])
        .map((record) => ({
          price: Number(record.price),
          recordedAt: String(record.recorded_at),
        }))
        .filter((record) => Number.isFinite(record.price));

  return { product, listings, priceHistory };
}

function isMissingPriceHistoryTable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: string; message?: string; details?: string };
  const text = `${record.message ?? ""} ${record.details ?? ""}`.toLowerCase();
  return (
    record.code === "42P01" ||
    record.code === "PGRST205" ||
    text.includes("price_history")
  );
}

function isMissingProductCategoryColumn(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: string; message?: string; details?: string };
  const text = `${record.message ?? ""} ${record.details ?? ""}`.toLowerCase();
  return (
    record.code === "42703" ||
    record.code === "PGRST204" ||
    text.includes("category")
  );
}
