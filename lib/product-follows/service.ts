// Follow / unfollow use cases, run with the signed-in user's own Supabase
// client so row-level security scopes every query to that user. Used by the
// server actions in app/follows/actions.ts.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { parsePositiveInteger } from "@/lib/price-alerts/rules";
import { MAX_FOLLOWED_PRODUCTS } from "@/lib/product-follows/rules";

type UserClient = SupabaseClient<Database>;

export type FollowResult = {
  ok: boolean;
  message: string;
  /** Whether the product is followed after the call. */
  following: boolean;
};

const POSTGRES_UNIQUE_VIOLATION = "23505";
const POSTGRES_CHECK_VIOLATION = "23514";

const failed = (message: string, following: boolean): FollowResult => ({ ok: false, message, following });

export async function followProduct(
  supabase: UserClient,
  userId: string,
  productId: unknown,
): Promise<FollowResult> {
  const id = parsePositiveInteger(productId);
  if (!id) return failed("Geçersiz ürün.", false);

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (productError) {
    console.error("Follow product lookup failed:", productError);
    return failed("Takip başlatılamadı.", false);
  }
  if (!product) return failed("Ürün bulunamadı.", false);

  // The baseline is the price today, so the first notification is about a
  // change after the follow, never about the price the visitor already saw.
  const { data: stats, error: statsError } = await supabase
    .from("product_price_stats")
    .select("min_price")
    .eq("product_id", id)
    .maybeSingle();
  if (statsError) console.error("Follow baseline lookup failed:", statsError);

  const { error } = await supabase.from("product_follows").insert({
    user_id: userId,
    product_id: id,
    last_price: stats?.min_price != null ? Number(stats.min_price) : null,
    last_checked_at: new Date().toISOString(),
  });

  if (error) {
    if (error.code === POSTGRES_UNIQUE_VIOLATION) {
      return { ok: true, following: true, message: "Bu ürünü zaten takip ediyorsun." };
    }
    if (error.code === POSTGRES_CHECK_VIOLATION) {
      return failed(`En fazla ${MAX_FOLLOWED_PRODUCTS} ürün takip edebilirsin. Birini bırakıp tekrar dene.`, false);
    }
    console.error("Follow product insert failed:", error);
    return failed("Takip başlatılamadı.", false);
  }

  return { ok: true, following: true, message: "Takip ediliyor. Fiyat düşünce ya da yeni uygun ilan gelince haber vereceğiz." };
}

export async function unfollowProduct(
  supabase: UserClient,
  userId: string,
  productId: unknown,
): Promise<FollowResult> {
  const id = parsePositiveInteger(productId);
  if (!id) return failed("Geçersiz ürün.", true);

  const { error } = await supabase
    .from("product_follows")
    .delete()
    .eq("user_id", userId)
    .eq("product_id", id);
  if (error) {
    console.error("Unfollow product failed:", error);
    return failed("Takip bırakılamadı.", true);
  }
  return { ok: true, following: false, message: "Takip bırakıldı." };
}
