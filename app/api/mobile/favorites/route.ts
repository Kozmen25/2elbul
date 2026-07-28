import { isMissingStatusColumn } from "@/lib/listing-status";
import { createSupabaseClient } from "@/lib/supabase";
import { createProductSlug } from "@/lib/product-slug";
import { mobileSuccess, mobileError } from "@/lib/mobile/response";
import { getAuthenticatedClient } from "@/lib/mobile/auth";
import type { ListingCondition, ListingSource } from "@/lib/listings";
import type {
  MobileFavoritesListResponse,
  MobileFavoriteCreatedResponse,
  MobileFavoriteItem,
  MobileProductListing,
} from "@/lib/mobile/types";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getAuthenticatedClient();
  if (auth.error) return auth.error;

  const { data, error } = await auth.supabase
    .from("favorites")
    .select("id, listing_id, created_at")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Mobile favorites query failed:", error);
    return mobileError("Favoriler yüklenirken bir sorun oluştu.", 500);
  }

  const listingIds = (data ?? []).map((f) => String(f.listing_id));
  const listingMap = await fetchListingsMap(listingIds);
  const productMap = await fetchProductMapForListings(listingIds);

  const favorites: MobileFavoriteItem[] = (data ?? []).map((f) => {
    const fid = String(f.id);
    const lid = String(f.listing_id);
    const listing = listingMap.get(lid) ?? null;
    const product = listing ? productMap.get(String(listing.productId)) : null;
    return {
      id: fid,
      listingId: lid,
      listing: listing
        ? {
            id: listing.id,
            title: listing.title,
            price: listing.price,
            city: listing.city,
            source: listing.source,
            condition: listing.condition,
            imageUrl: listing.imageUrl,
            url: listing.url,
            createdAt: listing.createdAt,
          }
        : null,
      productName: product?.name ?? "Diğer",
      productSlug: product?.slug ?? null,
      createdAt: String(f.created_at ?? ""),
    };
  });

  const response: MobileFavoritesListResponse = { favorites };
  return mobileSuccess(response);
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedClient();
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.listingId !== "string" || !body.listingId.trim()) {
    return mobileError("Geçersiz ilan ID'si.", 400);
  }

  const listingId = body.listingId.trim();

  // Check if already favorited
  const { data: existing } = await auth.supabase
    .from("favorites")
    .select("id")
    .eq("user_id", auth.userId)
    .eq("listing_id", listingId)
    .maybeSingle();

  if (existing) {
    return mobileSuccess({ favoriteId: String(existing.id) } as MobileFavoriteCreatedResponse);
  }

  const { data, error } = await auth.supabase
    .from("favorites")
    .insert({ user_id: auth.userId, listing_id: listingId })
    .select("id")
    .single();

  if (error) {
    console.error("Mobile favorite insert failed:", error);
    return mobileError("Favori eklenirken bir sorun oluştu.", 500);
  }

  return mobileSuccess({ favoriteId: String(data.id) } as MobileFavoriteCreatedResponse, 201);
}

async function fetchListingsMap(
  listingIds: string[],
): Promise<Map<string, MobileProductListing & { productId: string }>> {
  if (!listingIds.length) return new Map();

  const supabase = createSupabaseClient();
  if (!supabase) return new Map();

  const columns =
    "id, product_id, title, price, city, source, url, condition, image_url, created_at";
  const result = await supabase.from("listings").select(columns).in("id", listingIds);

  if (result.error) {
    console.error("Mobile favorites listings fetch failed:", result.error);
    return new Map();
  }

  const map = new Map<string, MobileProductListing & { productId: string }>();
  for (const row of result.data ?? []) {
    map.set(String(row.id), {
      id: String(row.id),
      productId: String(row.product_id),
      title: String(row.title),
      price: Number(row.price),
      city: String(row.city),
      source: row.source as ListingSource,
      condition: row.condition as ListingCondition,
      imageUrl: row.image_url ? String(row.image_url) : null,
      url: String(row.url),
      createdAt: String(row.created_at),
    });
  }
  return map;
}

async function fetchProductMapForListings(
  listingIds: string[],
): Promise<Map<string, { name: string; slug: string }>> {
  if (!listingIds.length) return new Map();

  const supabase = createSupabaseClient();
  if (!supabase) return new Map();

  const listingsResult = await supabase
    .from("listings")
    .select("product_id")
    .in("id", listingIds);

  if (listingsResult.error || !listingsResult.data?.length) return new Map();

  const productIds = [
    ...new Set(listingsResult.data.map((r) => String(r.product_id))),
  ];

  const { data } = await supabase
    .from("products")
    .select("id, name, slug")
    .in("id", productIds);

  if (!data) return new Map();

  const map = new Map<string, { name: string; slug: string }>();
  for (const p of data) {
    map.set(String(p.id), {
      name: String(p.name),
      slug: p.slug ? String(p.slug) : createProductSlug(String(p.name)),
    });
  }
  return map;
}
