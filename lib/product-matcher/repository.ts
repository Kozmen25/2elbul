import type { SupabaseClient } from "@supabase/supabase-js";
import { generateProductKey } from "./signals";
import type { ProductRow } from "./types";

export async function findExistingMatchedProduct(
  supabase: SupabaseClient,
  canonicalName: string,
  canonicalKey: string,
) {
  const exact = await supabase
    .from("products")
    .select("id, name, category")
    .eq("name", canonicalName)
    .maybeSingle();
  if (exact.error) throw exact.error;
  if (exact.data) {
    return {
      id: exact.data.id,
      name: String(exact.data.name),
      category: exact.data.category ? String(exact.data.category) : null,
    };
  }

  const { data: products, error: lookupError } = await supabase
    .from("products")
    .select("id, name, category")
    .limit(2000);
  if (lookupError) throw lookupError;

  const matched = (products ?? []).find(
    (product: ProductRow) => generateProductKey(product.name) === canonicalKey,
  );
  if (!matched) return null;

  return {
    id: matched.id,
    name: matched.name,
    category: matched.category ?? null,
  };
}
