import type { SupabaseClient } from "@supabase/supabase-js";
import { generateProductKey } from "./signals";
import type { BatchMatchCandidate } from "./types";

const SCAN_PAGE_SIZE = 1000;

export async function batchFindExistingMatchedProducts(
  supabase: SupabaseClient,
  candidates: BatchMatchCandidate[],
): Promise<
  Map<string, { id: string | number; name: string; category: string | null } | null>
> {
  if (candidates.length === 0) return new Map();

  // Initialize result map: all candidates start as null (unmatched)
  const resultMap = new Map<
    string,
    { id: string | number; name: string; category: string | null } | null
  >();
  for (const c of candidates) {
    resultMap.set(c.canonicalName, null);
  }

  // Phase 1: Batch exact name match
  const { data: exactProducts, error: exactError } = await supabase
    .from("products")
    .select("id, name, category")
    .in(
      "name",
      candidates.map((c) => c.canonicalName),
    );

  if (exactError) throw exactError;

  const exactByName = new Map<
    string,
    { id: string | number; name: string; category: string | null }
  >();
  if (exactProducts) {
    for (const p of exactProducts) {
      const name = String(p.name);
      if (!exactByName.has(name)) {
        exactByName.set(name, {
          id: p.id,
          name,
          category: p.category ? String(p.category) : null,
        });
      }
    }
  }

  // Apply exact matches
  for (const [name, product] of exactByName) {
    resultMap.set(name, product);
  }

  // Phase 2: Key-based fallback for unmatched names via paginated full scan
  const needsKeyMatch = candidates.filter((c) => !exactByName.has(c.canonicalName));
  if (needsKeyMatch.length === 0) return resultMap;

  const keySet = new Set(needsKeyMatch.map((c) => c.canonicalKey));
  const keyToNames = new Map<string, string[]>();
  for (const c of needsKeyMatch) {
    const names = keyToNames.get(c.canonicalKey) ?? [];
    names.push(c.canonicalName);
    keyToNames.set(c.canonicalKey, names);
  }

  const seenKeys = new Set<string>();
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data: products, error: scanError } = await supabase
      .from("products")
      .select("id, name, category")
      .order("id", { ascending: true })
      .range(offset, offset + SCAN_PAGE_SIZE - 1);

    if (scanError) throw scanError;
    if (!products || products.length === 0) break;

    for (const product of products) {
      const pKey = generateProductKey(product.name);
      if (keySet.has(pKey) && !seenKeys.has(pKey)) {
        seenKeys.add(pKey);
        const matched = {
          id: product.id,
          name: String(product.name),
          category: product.category ? String(product.category) : null,
        };
        const names = keyToNames.get(pKey) ?? [];
        for (const cn of names) {
          resultMap.set(cn, matched);
        }
      }
    }

    hasMore = products.length === SCAN_PAGE_SIZE;
    offset += SCAN_PAGE_SIZE;
  }

  return resultMap;
}

export async function findExistingMatchedProduct(
  supabase: SupabaseClient,
  canonicalName: string,
  canonicalKey: string,
) {
  const map = await batchFindExistingMatchedProducts(supabase, [
    { canonicalName, canonicalKey },
  ]);
  return map.get(canonicalName) ?? null;
}
