import { describe, expect, it, vi } from "vitest";
import type { Category } from "@/lib/categories";

vi.mock("@/lib/site-settings", () => ({ getHeaderCategorySettings: vi.fn() }));

import { MAX_HEADER_CATEGORIES } from "./header-category-limits";
import { selectHeaderCategories } from "./header-categories";

function category(
  id: number,
  slug: string,
  parentId: number | null = null,
  isFallback = false,
): Category {
  return {
    id,
    slug,
    parentId,
    name: slug.toUpperCase(),
    icon: null,
    shortDescription: null,
    longDescription: null,
    expectedProductType: null,
    displayOrder: id,
    isFallback,
  };
}

const all: Category[] = [
  category(1, "telefon"),
  category(11, "telefon-iphone", 1),
  category(2, "konsol"),
  category(3, "arac"),
  category(99, "diger", null, true),
];

describe("selectHeaderCategories", () => {
  it("lists every main category except the fallback when nothing is configured", () => {
    expect(selectHeaderCategories(all, null).map((c) => c.slug)).toEqual([
      "telefon",
      "konsol",
      "arac",
    ]);
  });

  it("lists only the selected categories, in taxonomy order", () => {
    expect(selectHeaderCategories(all, ["arac", "telefon"]).map((c) => c.slug)).toEqual([
      "telefon",
      "arac",
    ]);
  });

  it("allows subcategories and ignores unknown slugs", () => {
    expect(
      selectHeaderCategories(all, ["telefon-iphone", "yok"]).map((c) => c.slug),
    ).toEqual(["telefon-iphone"]);
  });

  it("shows an empty menu for an explicit empty selection", () => {
    expect(selectHeaderCategories(all, [])).toEqual([]);
  });

  it("caps the selection", () => {
    const many = Array.from({ length: MAX_HEADER_CATEGORIES + 3 }, (_, i) => category(100 + i, `k${i}`));
    const slugs = many.map((c) => c.slug);
    expect(selectHeaderCategories(many, slugs)).toHaveLength(MAX_HEADER_CATEGORIES);
  });
});
