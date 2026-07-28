"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseClient } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function recordSearch(query: string) {
  const normalizedQuery = query.trim();
  const supabase = createSupabaseClient();

  if (!supabase || !normalizedQuery) return;

  const searchPattern = `%${normalizedQuery}%`;
  const { data: products, error: productError } = await supabase
    .from("products")
    .select("id, name")
    .ilike("name", searchPattern)
    .limit(1);

  if (productError) {
    console.error("Supabase search tracking product query failed:", productError);
    return;
  }

  const product = products?.[0];
  if (!product) return;

  const { error } = await supabase.from("search_events").insert({
    product_id: product.id,
    query: normalizedQuery,
  });

  if (error) {
    console.error("Supabase search event insert failed:", error);
  }
}

export async function createSavedSearch(input: {
  query: string;
  filters?: Record<string, string | number>;
  frequency?: "instant" | "daily" | "weekly";
}): Promise<{ ok: boolean; message: string; requiresAuth?: boolean }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, message: "Supabase bağlantısı yapılandırılmamış." };
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { ok: false, requiresAuth: true, message: "Arama kaydetmek için giriş yapmalısınız." };
  }

  const trimmedQuery = input.query.trim();
  if (!trimmedQuery) {
    return { ok: false, message: "Aramak için bir kelime girin." };
  }

  // Check for existing duplicate (same user + query)
  const { data: existing } = await supabase
    .from("saved_searches")
    .select("id")
    .eq("user_id", user.id)
    .eq("query", trimmedQuery)
    .limit(1);

  if (existing && existing.length > 0) {
    return { ok: true, message: "Bu arama zaten kaydedilmiş." };
  }

  const { error: insertError } = await supabase
    .from("saved_searches")
    .insert({
      user_id: user.id,
      query: trimmedQuery,
      filters: input.filters ?? {},
      frequency: input.frequency ?? "instant",
    });

  if (insertError) {
    console.error("Saved search insert failed:", insertError);
    return { ok: false, message: insertError.message };
  }

  revalidatePath("/hesabim");
  return { ok: true, message: "Arama kaydedildi. Yeni ilanlar geldikçe bildirim alacaksınız." };
}
