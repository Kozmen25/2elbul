import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { batchFindExistingMatchedProducts, findExistingMatchedProduct } from "./repository";
import { generateProductKey } from "./signals";

type StubProduct = {
  id: number;
  name: string;
  category?: string | null;
  normalized_key?: string | null;
};

function createStub(products: StubProduct[]) {
  // Assign computed normalized_key for products that don't have one
  const dbProducts = products.map((p) => ({
    ...p,
    normalized_key: p.normalized_key ?? generateProductKey(p.name),
  }));

  const from = vi.fn((_table: string) => {
    let mode: "exact" | "key" | null = null;
    let exactNames: string[] = [];
    let keyValues: string[] = [];

    const chain = {
      select: vi.fn(() => chain),
      in: vi.fn((field: string, values: string[]) => {
        if (field === "name") {
          mode = "exact";
          exactNames = values;
        } else if (field === "normalized_key") {
          mode = "key";
          keyValues = values;
        }
        return chain;
      }),
      eq: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
      then: vi.fn((onFulfilled: (value: { data: StubProduct[]; error: null }) => unknown) => {
        let result: StubProduct[];
        if (mode === "exact") {
          const nameSet = new Set(exactNames);
          result = dbProducts.filter((p) => nameSet.has(p.name));
        } else if (mode === "key") {
          const keySet = new Set(keyValues);
          result = dbProducts.filter((p) => p.normalized_key && keySet.has(p.normalized_key));
        } else {
          result = dbProducts;
        }
        return Promise.resolve({ data: result, error: null }).then(onFulfilled);
      }),
    };

    return chain;
  });

  return { supabase: { from } as unknown as SupabaseClient, from };
}

describe("batchFindExistingMatchedProducts", () => {
  it("returns empty map for empty input", async () => {
    const { supabase } = createStub([]);
    const result = await batchFindExistingMatchedProducts(supabase, []);
    expect(result.size).toBe(0);
  });

  it("finds a single product by exact name match", async () => {
    const { supabase } = createStub([
      { id: 1, name: "iPhone 15", category: "Telefon" },
    ]);
    const key = generateProductKey("iPhone 15");
    const result = await batchFindExistingMatchedProducts(supabase, [
      { canonicalName: "iPhone 15", canonicalKey: key },
    ]);
    expect(result.get("iPhone 15")).toEqual({
      id: 1,
      name: "iPhone 15",
      category: "Telefon",
    });
  });

  it("finds multiple products by exact name match", async () => {
    const { supabase } = createStub([
      { id: 1, name: "iPhone 15", category: "Telefon" },
      { id: 2, name: "Samsung Galaxy S24", category: "Telefon" },
    ]);
    const k1 = generateProductKey("iPhone 15");
    const k2 = generateProductKey("Samsung Galaxy S24");
    const result = await batchFindExistingMatchedProducts(supabase, [
      { canonicalName: "iPhone 15", canonicalKey: k1 },
      { canonicalName: "Samsung Galaxy S24", canonicalKey: k2 },
    ]);
    expect(result.get("iPhone 15")?.id).toBe(1);
    expect(result.get("Samsung Galaxy S24")?.id).toBe(2);
  });

  it("falls back to key-based match when exact name fails", async () => {
    const { supabase } = createStub([
      { id: 42, name: "iPhone 15", category: "Telefon" },
    ]);
    const key = generateProductKey("iPhone 15");
    const result = await batchFindExistingMatchedProducts(supabase, [
      { canonicalName: "iPhone 15 alternate", canonicalKey: key },
    ]);
    expect(result.get("iPhone 15 alternate")).toEqual({
      id: 42,
      name: "iPhone 15",
      category: "Telefon",
    });
  });

  it("returns null for unmatched product", async () => {
    const { supabase } = createStub([{ id: 1, name: "iPhone 15" }]);
    const result = await batchFindExistingMatchedProducts(supabase, [
      { canonicalName: "NonExistent", canonicalKey: "no-match-key" },
    ]);
    expect(result.get("NonExistent")).toBeNull();
  });

  it("finds key match via indexed normalized_key query across large dataset", async () => {
    const products: StubProduct[] = Array.from({ length: 1500 }, (_, i) => ({
      id: i + 1,
      name: `Generic ${i + 1}`,
      category: null,
      normalized_key: `generic-${i + 1}`,
    }));
    products.push({ id: 1501, name: "iPhone 15", category: "Telefon" });

    const { supabase } = createStub(products);
    const key = generateProductKey("iPhone 15");
    const result = await batchFindExistingMatchedProducts(supabase, [
      { canonicalName: "iPhone 15 alt", canonicalKey: key },
    ]);
    expect(result.get("iPhone 15 alt")).toEqual({
      id: 1501,
      name: "iPhone 15",
      category: "Telefon",
    });
  });

  it("handles mix of exact match, key match, and no match", async () => {
    const { supabase } = createStub([
      { id: 10, name: "Samsung Galaxy S24", category: "Telefon" },
    ]);
    const k1 = generateProductKey("Samsung Galaxy S24");
    const k2 = generateProductKey("iPhone 15");
    const result = await batchFindExistingMatchedProducts(supabase, [
      { canonicalName: "Samsung Galaxy S24", canonicalKey: k1 },
      { canonicalName: "iPhone 15 alt", canonicalKey: k2 },
      { canonicalName: "Ghost Product", canonicalKey: "no-match" },
    ]);
    expect(result.get("Samsung Galaxy S24")?.id).toBe(10);
    expect(result.get("iPhone 15 alt")).toBeNull();
    expect(result.get("Ghost Product")).toBeNull();
  });

  it("first exact match wins for duplicate names", async () => {
    const { supabase } = createStub([
      { id: 1, name: "iPhone 15", category: "Telefon" },
      { id: 2, name: "iPhone 15", category: "Telefon" },
    ]);
    const key = generateProductKey("iPhone 15");
    const result = await batchFindExistingMatchedProducts(supabase, [
      { canonicalName: "iPhone 15", canonicalKey: key },
    ]);
    expect(result.get("iPhone 15")?.id).toBe(1);
  });

  it("does not call key query when all names are exact-matched", async () => {
    const { supabase, from } = createStub([{ id: 1, name: "iPhone 15" }]);
    const key = generateProductKey("iPhone 15");
    await batchFindExistingMatchedProducts(supabase, [
      { canonicalName: "iPhone 15", canonicalKey: key },
    ]);

    const chain = from.mock.results[0].value;
    const fieldNames = chain.in.mock.calls.map((c: string[]) => c[0]);
    expect(fieldNames).toEqual(["name"]);
  });

  it("backward compatible: findExistingMatchedProduct returns same result", async () => {
    const { supabase } = createStub([
      { id: 99, name: "iPhone 15", category: "Telefon" },
    ]);
    const key = generateProductKey("iPhone 15");
    const result = await findExistingMatchedProduct(supabase, "iPhone 15", key);
    expect(result).toEqual({
      id: 99,
      name: "iPhone 15",
      category: "Telefon",
    });
  });
});
