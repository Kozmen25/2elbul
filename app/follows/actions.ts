"use server";

import { getAlertSession } from "@/lib/price-alerts/session";
import { followProduct, unfollowProduct, type FollowResult } from "@/lib/product-follows/service";

export type FollowActionResult = FollowResult & { requiresAuth?: boolean };

/** Follows or unfollows a product for the signed-in user. */
export async function setProductFollow(productId: string, follow: boolean): Promise<FollowActionResult> {
  const result = await getAlertSession();
  if (!result.ok) {
    return {
      ok: false,
      following: !follow,
      requiresAuth: result.reason === "unauthenticated",
      message:
        result.reason === "unauthenticated"
          ? "Ürünü takip etmek için giriş yapmalısınız."
          : "Supabase bağlantısı yapılandırılmamış.",
    };
  }

  const { supabase, userId } = result.session;
  return follow ? followProduct(supabase, userId, productId) : unfollowProduct(supabase, userId, productId);
}
