import { describe, expect, it } from "vitest";
import {
  aggregateCategoryStats,
  buildCategoryTree,
  getCategoryScopeIds,
  isCategoryVisible,
  resolveCategory,
  type Category,
} from "./categories";

function category(overrides: Partial<Category> & Pick<Category, "id" | "slug" | "name">): Category {
  return {
    parentId: null,
    icon: null,
    shortDescription: null,
    longDescription: null,
    expectedProductType: null,
    displayOrder: 0,
    isFallback: false,
    ...overrides,
  };
}

const computer = category({ id: 2, slug: "bilgisayar", name: "Bilgisayar" });
const laptop = category({ id: 10, slug: "bilgisayar-laptop", name: "Laptop", parentId: 2 });
const tablet = category({ id: 12, slug: "bilgisayar-tablet", name: "Tablet", parentId: 2 });
const phone = category({ id: 1, slug: "telefon", name: "Telefon" });
const other = category({ id: 99, slug: "diger", name: "Diğer", isFallback: true });
const categories = [phone, computer, laptop, tablet, other];

describe("buildCategoryTree / resolveCategory", () => {
  it("nests subcategories under their main category", () => {
    const tree = buildCategoryTree(categories);
    expect(tree.map((main) => main.slug)).toEqual(["telefon", "bilgisayar", "diger"]);
    expect(tree[1].children.map((child) => child.slug)).toEqual(["bilgisayar-laptop", "bilgisayar-tablet"]);
  });

  it("resolves parent and children for a category", () => {
    expect(resolveCategory(categories, laptop).parent?.slug).toBe("bilgisayar");
    expect(resolveCategory(categories, computer).children).toHaveLength(2);
  });
});

describe("getCategoryScopeIds", () => {
  it("includes subcategories for a main category", () => {
    expect(getCategoryScopeIds(resolveCategory(categories, computer))).toEqual([2, 10, 12]);
  });

  it("is only the subcategory itself for a subcategory", () => {
    expect(getCategoryScopeIds(resolveCategory(categories, laptop))).toEqual([10]);
  });
});

describe("aggregateCategoryStats", () => {
  const stats = aggregateCategoryStats(
    categories,
    [
      { productId: "p1", categoryId: 10 }, // laptop
      { productId: "p2", categoryId: 12 }, // tablet
      { productId: "p3", categoryId: 2 }, // computer without subcategory
      { productId: "p4", categoryId: 1 }, // phone
    ],
    [
      { productId: "p1", listingCount: 5, latestListingAt: "2026-09-20T10:00:00Z" },
      { productId: "p2", listingCount: 2, latestListingAt: "2026-09-25T10:00:00Z" },
      { productId: "p4", listingCount: 4, latestListingAt: null },
    ],
  );

  it("counts a product in its own category", () => {
    expect(stats.get(10)).toEqual({ productCount: 1, listingCount: 5, latestListingAt: "2026-09-20T10:00:00Z" });
  });

  it("rolls subcategory products up into the main category", () => {
    expect(stats.get(2)).toEqual({ productCount: 3, listingCount: 7, latestListingAt: "2026-09-25T10:00:00Z" });
  });

  it("keeps every product counted exactly once per level", () => {
    const mainTotal = [1, 2, 99].reduce((total, id) => total + (stats.get(id)?.productCount ?? 0), 0);
    expect(mainTotal).toBe(4);
  });

  it("reports empty categories with zero counts", () => {
    expect(stats.get(99)).toEqual({ productCount: 0, listingCount: 0, latestListingAt: null });
  });
});

describe("isCategoryVisible", () => {
  it("always shows regular categories, even when empty", () => {
    expect(isCategoryVisible(tablet, new Map())).toBe(true);
  });

  it("shows the fallback category only while it holds products", () => {
    expect(isCategoryVisible(other, new Map([[99, { productCount: 0, listingCount: 0, latestListingAt: null }]]))).toBe(false);
    expect(isCategoryVisible(other, new Map([[99, { productCount: 1, listingCount: 0, latestListingAt: null }]]))).toBe(true);
  });
});
