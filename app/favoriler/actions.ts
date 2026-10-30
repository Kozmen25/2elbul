"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { toBigintId } from "@/lib/supabase-ids";

const FAVORITE_ERROR_MESSAGE = "Favori işlemi tamamlanamadı. Lütfen tekrar deneyin.";
const POSTGRES_UNIQUE_VIOLATION = "23505";

export type FavoriteActionResult = {
  ok: boolean;
  isFavorite: boolean;
  requiresAuth?: boolean;
  message?: string;
};

export async function setFavorite(
  listingId: string,
): Promise<FavoriteActionResult> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return {
      ok: false,
      isFavorite: false,
      message: "Supabase bağlantısı yapılandırılmamış.",
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    if (userError) console.error("Supabase favorite user lookup failed:", userError);
    return {
      ok: false,
      isFavorite: false,
      requiresAuth: true,
    };
  }

  const listingKey = toBigintId(listingId);
  if (!Number.isSafeInteger(listingKey) || listingKey <= 0) {
    return { ok: false, isFavorite: false, message: "Geçersiz ilan." };
  }

  const { data: existingFavorite, error: lookupError } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("listing_id", listingKey)
    .maybeSingle();

  if (lookupError) {
    console.error("Supabase favorite lookup failed:", lookupError);
    return { ok: false, isFavorite: false, message: FAVORITE_ERROR_MESSAGE };
  }

  if (existingFavorite) {
    const { error: deleteError } = await supabase
      .from("favorites")
      .delete()
      .eq("id", existingFavorite.id)
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("Supabase favorite delete failed:", deleteError);
      return { ok: false, isFavorite: true, message: FAVORITE_ERROR_MESSAGE };
    }

    return { ok: true, isFavorite: false };
  }

  const { error: insertError } = await supabase.from("favorites").insert({
    user_id: user.id,
    listing_id: listingKey,
  });

  if (insertError && insertError.code !== POSTGRES_UNIQUE_VIOLATION) {
    console.error("Supabase favorite insert failed:", insertError);
    return { ok: false, isFavorite: false, message: FAVORITE_ERROR_MESSAGE };
  }
  // A unique violation means a parallel request (double click) already added
  // it — the listing is a favorite, which is what the user asked for.


  return { ok: true, isFavorite: true };
}
