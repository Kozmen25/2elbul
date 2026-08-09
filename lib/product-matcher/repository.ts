import type { SupabaseClient } from "@supabase/supabase-js";
import type { BatchMatchCandidate } from "./types";

export async function batchFindExistingMatchedProducts(
  supabase: SupabaseClient,
  candidates: BatchMatchCandidate[],
): Promise<
  Map<
    string,
    {
      id: string | number;
      name: string;
      category: string | null;
      attributes?: unknown;
    } | null
  >
> {
  if (candidates.length === 0) return new Map();

  // Initialize result map: all candidates start as null (unmatched)
  const resultMap = new Map<
    string,
    {
      id: string | number;
      name: string;
      category: string | null;
      attributes?: unknown;
    } | null
  >();
  for (const c of candidates) {
    resultMap.set(c.canonicalName, null);
  }

  // Phase 1: Batch exact name match
  const { data: exactProducts, error: exactError } = await supabase
    .from("products")
    .select("id, name, category, attributes")
    .in(
      "name",
      candidates.map((c) => c.canonicalName),
    );

  if (exactError) throw exactError;

  const exactByName = new Map<
    string,
    {
      id: string | number;
      name: string;
      category: string | null;
      attributes?: unknown;
    }
  >();
  if (exactProducts) {
    for (const p of exactProducts) {
      const name = String(p.name);
      if (!exactByName.has(name)) {
        exactByName.set(name, {
          id: p.id,
          name,
          category: p.category ? String(p.category) : null,
          attributes: "attributes" in p ? (p as { attributes?: unknown }).attributes : undefined,
        });
      }
    }
  }

  // Apply exact matches
  for (const [name, product] of exactByName) {
    resultMap.set(name, product);
  }

  // Phase 2: Key-based match via indexed normalized_key query
  const needsKeyMatch = candidates.filter((c) => !exactByName.has(c.canonicalName));
  if (needsKeyMatch.length === 0) return resultMap;

  const keyToNames = new Map<string, string[]>();
  for (const c of needsKeyMatch) {
    const names = keyToNames.get(c.canonicalKey) ?? [];
    names.push(c.canonicalName);
    keyToNames.set(c.canonicalKey, names);
  }

  const uniqueKeys = [...new Set(needsKeyMatch.map((c) => c.canonicalKey))];

  const { data: keyProducts, error: keyError } = await supabase
    .from("products")
    .select("id, name, category, normalized_key, attributes")
    .in("normalized_key", uniqueKeys);

  if (keyError) throw keyError;

  if (keyProducts) {
    const seenKeys = new Set<string>();
    for (const product of keyProducts) {
      const pKey = product.normalized_key;
      if (pKey && !seenKeys.has(pKey)) {
        seenKeys.add(pKey);
        const matched = {
          id: product.id,
          name: String(product.name),
          category: product.category ? String(product.category) : null,
          attributes: "attributes" in product ? (product as { attributes?: unknown }).attributes : undefined,
        };
        const names = keyToNames.get(pKey) ?? [];
        for (const cn of names) {
          resultMap.set(cn, matched);
        }
      }
    }
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
