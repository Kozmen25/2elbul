import { describe, expect, it } from "vitest";
import {
  MAX_RECENT_SEARCHES,
  addRecentSearch,
  buildSuggestionGroups,
  highlightParts,
  matchBrandSuggestions,
  matchCategorySuggestions,
  moveActiveIndex,
} from "@/lib/search/suggestion-items";

const catalog = [
  { slug: "apple", name: "Apple", productCount: 12 },
  { slug: "samsung", name: "Samsung", productCount: 9 },
  { slug: "casper", name: "Casper", productCount: 2 },
];

describe("brand and category matching", () => {
  it("matches brands case-insensitively, prefix matches first", () => {
    expect(matchBrandSuggestions(catalog, "APP", 3).map((b) => b.slug)).toEqual(["apple"]);
    expect(matchBrandSuggestions(catalog, "as", 3).map((b) => b.slug)).toEqual(["casper"]);
    expect(matchBrandSuggestions(catalog, "sa", 3).map((b) => b.slug)).toEqual(["samsung"]);
    expect(matchBrandSuggestions(catalog, "xyz", 3)).toEqual([]);
    expect(matchBrandSuggestions(catalog, "a", 1)).toHaveLength(1);
  });

  it("matches Turkish names without diacritics and skips the fallback category", () => {
    const categories = [
      { id: 1, slug: "bilgisayar", name: "Bilgisayar", parentId: null, isFallback: false },
      { id: 2, slug: "bilgisayar-masaustu", name: "Masaüstü", parentId: 1, isFallback: false },
      { id: 3, slug: "diger", name: "Diğer", parentId: null, isFallback: true },
    ];
    expect(matchCategorySuggestions(categories, "masaustu", 3)).toEqual([
      { name: "Masaüstü", slug: "bilgisayar-masaustu", parentName: "Bilgisayar", href: "/category/bilgisayar-masaustu" },
    ]);
    expect(matchCategorySuggestions(categories, "diger", 3)).toEqual([]);
  });
});

describe("buildSuggestionGroups", () => {
  const products = [{ id: "1", name: "iPhone 13", listingCount: 4, href: "/search?q=iPhone%2013" }];
  const brands = matchBrandSuggestions(catalog, "app", 3);

  it("shows products, brands and categories while typing", () => {
    const groups = buildSuggestionGroups({
      query: "app",
      products,
      brands,
      categories: [{ name: "Telefon", slug: "telefon", parentName: null, href: "/category/telefon" }],
      recents: ["ignored"],
    });
    expect(groups.map((g) => g.title)).toEqual(["Ürünler", "Markalar", "Kategoriler"]);
    expect(groups[1].items[0]).toMatchObject({ kind: "brand", href: "/brand/apple", meta: "12 ürün" });
  });

  it("shows recent searches before popular ones on an empty box", () => {
    const groups = buildSuggestionGroups({ query: " ", products, brands: [], categories: [], recents: ["macbook"] });
    expect(groups.map((g) => g.title)).toEqual(["Son aramalarınız", "Popüler aramalar"]);
    expect(groups[0].items[0]).toMatchObject({ kind: "recent", href: "/search?q=macbook" });
  });
});

describe("highlight, recents and keyboard helpers", () => {
  it("highlights the typed text, Turkish case aware", () => {
    expect(highlightParts("iPhone 13 Pro", "phone")).toEqual([
      { text: "i", match: false },
      { text: "Phone", match: true },
      { text: " 13 Pro", match: false },
    ]);
    expect(highlightParts("Isparta", "ısp")).toEqual([
      { text: "Isp", match: true },
      { text: "arta", match: false },
    ]);
    expect(highlightParts("Laptop", "")).toEqual([{ text: "Laptop", match: false }]);
    expect(highlightParts("Laptop", "zzz")).toEqual([{ text: "Laptop", match: false }]);
  });

  it("keeps the newest recent search first without duplicates and caps the list", () => {
    expect(addRecentSearch(["a", "B"], " b ")).toEqual(["b", "a"]);
    expect(addRecentSearch(["a"], "   ")).toEqual(["a"]);
    const many = Array.from({ length: 10 }, (_, i) => `q${i}`);
    expect(addRecentSearch(many, "new")).toHaveLength(MAX_RECENT_SEARCHES);
    expect(addRecentSearch(many, "new")[0]).toBe("new");
  });

  it("wraps the keyboard selection", () => {
    expect(moveActiveIndex(-1, "down", 3)).toBe(0);
    expect(moveActiveIndex(2, "down", 3)).toBe(0);
    expect(moveActiveIndex(0, "up", 3)).toBe(2);
    expect(moveActiveIndex(-1, "up", 3)).toBe(2);
    expect(moveActiveIndex(0, "down", 0)).toBe(-1);
  });
});
