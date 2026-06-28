"use server";

import { createSupabaseClient } from "@/lib/supabase";

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
