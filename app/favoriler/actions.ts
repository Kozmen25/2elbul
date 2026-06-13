"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";

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

  const { data: existingFavorite, error: lookupError } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("listing_id", listingId)
    .maybeSingle();

  if (lookupError) {
    console.error("Supabase favorite lookup failed:", lookupError);
    return {
      ok: false,
      isFavorite: false,
      message: lookupError.message,
    };
  }

  if (existingFavorite) {
    const { error: deleteError } = await supabase
      .from("favorites")
      .delete()
      .eq("id", existingFavorite.id)
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("Supabase favorite delete failed:", deleteError);
      return {
        ok: false,
        isFavorite: true,
        message: deleteError.message,
      };
    }

    revalidatePath("/search");
    revalidatePath("/favoriler");
    revalidatePath("/hesabim");
    return { ok: true, isFavorite: false };
  }

  const { error: insertError } = await supabase.from("favorites").insert({
    user_id: user.id,
    listing_id: listingId,
  });

  if (insertError) {
    console.error("Supabase favorite insert failed:", insertError);
    return {
      ok: false,
      isFavorite: false,
      message: insertError.message,
    };
  }

  revalidatePath("/search");
  revalidatePath("/favoriler");
  revalidatePath("/hesabim");

  return { ok: true, isFavorite: true };
}
