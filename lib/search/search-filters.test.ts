import { describe, expect, it } from "vitest";
import type { Listing } from "@/lib/listings";
import {
  EMPTY_SEARCH_FILTERS,
  applySearchFilters,
  buildFacet,
  countActiveFilters,
  describeActiveFilters,
  filtersFromParams,
  priceBounds,
  sanitizeFilters,
  writeFiltersToParams,
  type SearchFilters,
} from "@/lib/search/search-filters";

function listing(id: string, overrides: Partial<Listing>): Listing {
  return {
    id,
    productId: "1",
    title: "t",
    productName: "iPhone 13",
    category: "Telefon",
    price: 20000,
    city: "İstanbul",
    source: "Sahibinden",
    url: "https://example.com",
    condition: "İyi",
    imageUrl: null,
    createdAt: "2026-01-01",
    ...overrides,
  };
}

const listings: Listing[] = [
  listing("a", { productId: "1", productName: "iPhone 13", price: 20000 }),
  listing("b", { productId: "1", productName: "iPhone 13", price: 22000, city: "Ankara" }),
  listing("c", { productId: "2", productName: "Samsung Galaxy S23", price: 25000, source: "Letgo", condition: "Sıfır" }),
  listing("d", { productId: "3", productName: "MacBook Air M2", category: "Bilgisayar", price: 40000, city: "İzmir" }),
];

const f = (overrides: Partial<SearchFilters>): SearchFilters => ({ ...EMPTY_SEARCH_FILTERS, ...overrides });

describe("applySearchFilters", () => {
  it("filters by brand derived from the product name", () => {
    expect(applySearchFilters(listings, f({ brand: "Apple" })).map((l) => l.id)).toEqual(["a", "b", "d"]);
    expect(applySearchFilters(listings, f({ brand: "Samsung" })).map((l) => l.id)).toEqual(["c"]);
  });

  it("combines category, city, condition, source and price range", () => {
    expect(applySearchFilters(listings, f({ category: "Telefon", city: "Ankara" })).map((l) => l.id)).toEqual(["b"]);
    expect(applySearchFilters(listings, f({ condition: "Sıfır" })).map((l) => l.id)).toEqual(["c"]);
    expect(applySearchFilters(listings, f({ source: "letgo" })).map((l) => l.id)).toEqual(["c"]);
    expect(applySearchFilters(listings, f({ min: "21000", max: "30000" })).map((l) => l.id)).toEqual(["b", "c"]);
  });

  it("filters by model (product id) and ignores invalid price bounds", () => {
    expect(applySearchFilters(listings, f({ model: "1" })).map((l) => l.id)).toEqual(["a", "b"]);
    expect(applySearchFilters(listings, f({ min: "abc" }))).toHaveLength(4);
  });
});

describe("buildFacet", () => {
  it("counts options over listings matching the other filters", () => {
    const brands = buildFacet(listings, f({ category: "Telefon" }), "brand");
    expect(brands).toEqual([
      { value: "Apple", label: "Apple", count: 2 },
      { value: "Samsung", label: "Samsung", count: 1 },
    ]);
  });

  it("lets the category be switched while a brand is selected", () => {
    const categories = buildFacet(listings, f({ category: "Telefon", brand: "Samsung" }), "category");
    expect(categories.map((o) => o.value).sort()).toEqual(["Bilgisayar", "Telefon"]);
  });

  it("does not filter a facet by its own selection", () => {
    const cities = buildFacet(listings, f({ city: "Ankara" }), "city");
    expect(cities.map((o) => o.value).sort()).toEqual(["Ankara", "İstanbul", "İzmir"].sort());
  });

  it("labels models by product name and sources by their display name", () => {
    expect(buildFacet(listings, EMPTY_SEARCH_FILTERS, "model")[0]).toEqual({ value: "1", label: "iPhone 13", count: 2 });
    expect(buildFacet(listings, EMPTY_SEARCH_FILTERS, "source").find((o) => o.value === "letgo")?.label).toBe("Letgo");
  });
});

describe("sanitizeFilters", () => {
  it("clears brand and model that no longer exist after the category changes", () => {
    const result = sanitizeFilters(listings, f({ category: "Bilgisayar", brand: "Samsung", model: "2" }));
    expect(result.category).toBe("Bilgisayar");
    expect(result.brand).toBe("");
    expect(result.model).toBe("");
  });

  it("keeps valid selections untouched", () => {
    const valid = f({ category: "Telefon", brand: "Apple", model: "1", city: "Nowhere" });
    expect(sanitizeFilters(listings, valid)).toEqual(valid);
  });
});

describe("price bounds, params and chips", () => {
  it("reports the price range of the non-price filters", () => {
    expect(priceBounds(listings, f({ category: "Telefon", min: "99999" }))).toEqual({ min: 20000, max: 25000 });
    expect(priceBounds(listings, f({ city: "Nowhere" }))).toBeNull();
  });

  it("round-trips through URL params", () => {
    const params = new URLSearchParams("q=iphone&sort=newest");
    writeFiltersToParams(f({ brand: "Apple", min: "100" }), params);
    expect(params.toString()).toBe("q=iphone&sort=newest&brand=Apple&min=100");
    expect(filtersFromParams(params)).toEqual(f({ brand: "Apple", min: "100" }));
    writeFiltersToParams(EMPTY_SEARCH_FILTERS, params);
    expect(params.toString()).toBe("q=iphone&sort=newest");
    expect(countActiveFilters(f({ brand: "Apple", min: "1", max: "2" }))).toBe(3);
  });

  it("describes one chip per filter with a combined price chip", () => {
    const chips = describeActiveFilters(
      f({ brand: "Apple", min: "100", max: "200" }),
      (_key, value) => value,
      (value) => `${value} TL`,
    );
    expect(chips).toEqual([
      { key: "brand", label: "Marka: Apple" },
      { key: "price", label: "Fiyat: 100 TL - 200 TL" },
    ]);
  });
});
