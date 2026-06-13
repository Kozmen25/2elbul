"use server";

import { createSupabaseClient } from "@/lib/supabase";

export async function recordSearch(query: string) {
  const normalizedQuery = query.trim();
  const supabase = createSupabaseClient();

  if (!supabase || !normalizedQuery) return;

  const { data: products, error: productError } = await supabase
    .from("products")
    .select("id, name");

  if (productError) {
    console.error("Supabase search tracking product query failed:", productError);
    return;
  }

  const normalizedSearch = normalizedQuery.toLocaleLowerCase("tr-TR");
  const product = (products ?? []).find((item) =>
    String(item.name).toLocaleLowerCase("tr-TR").includes(normalizedSearch),
  );

  if (!product) return;

  const { error } = await supabase.from("search_events").insert({
    product_id: product.id,
    query: normalizedQuery,
  });

  if (error) {
    console.error("Supabase search event insert failed:", error);
  }
}
