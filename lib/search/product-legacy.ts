import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Normalize a product name for lookup: trim whitespace, collapse multi-space.
 */
export function normalizeProductName(query: string): string {
  return query.trim().replace(/\s+/g, " ") || "Aranan ürün";
}

/**
 * Find an existing product by name, or create one.
 * Shared between instant-bot and process-search-queue routes.
 */
export async function ensureProductLegacy(
  supabase: SupabaseClient,
  query: string,
): Promise<number> {
  const productName = normalizeProductName(query);

  const existing = await supabase
    .from("products")
    .select("id")
    .eq("name", productName)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data?.id) return Number(existing.data.id);

  const { data, error } = await supabase
    .from("products")
    .insert({ name: productName })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Ürün oluşturulamadı.");
  }

  return Number(data.id);
}
