import { describe, expect, it } from "vitest";
import type { Category, CategoryStats, CategoryWithChildren } from "@/lib/categories";
import { buildCategoryHub, hubHref, previewSubcategories } from "./category-hub";

function category(id: number, slug: string, parentId: number | null = null): Category {
  return {
    id,
    slug,
    parentId,
    name: slug,
    icon: null,
    shortDescription: null,
    longDescription: null,
    expectedProductType: null,
    displayOrder: id,
    isFallback: false,
  };
}

const tree: CategoryWithChildren[] = [
  {
    ...category(1, "telefon"),
    children: [category(11, "telefon-iphone", 1), category(12, "telefon-android", 1)],
  },
  { ...category(2, "konsol"), children: [] },
];

const stats = new Map<number, CategoryStats>([
  [1, { productCount: 5, listingCount: 20, latestListingAt: null }],
  [11, { productCount: 3, listingCount: 12, latestListingAt: null }],
  [2, { productCount: 2, listingCount: 4, latestListingAt: null }],
]);

describe("buildCategoryHub", () => {
  it("joins stats onto the tree and falls back to zero counts", () => {
    const hub = buildCategoryHub(tree, stats, null);

    expect(hub.mains[0].productCount).toBe(5);
    expect(hub.mains[0].children[1]).toMatchObject({ productCount: 0, listingCount: 0 });
  });

  it("sums totals from main categories only", () => {
    const { totals } = buildCategoryHub(tree, stats, null);

    expect(totals).toEqual({
      mainCount: 2,
      subcategoryCount: 2,
      productCount: 7,
      listingCount: 24,
    });
  });

  it("selects a main category with its subcategories", () => {
    const { selection } = buildCategoryHub(tree, stats, "telefon");

    expect(selection?.category.slug).toBe("telefon");
    expect(selection?.parent).toBeNull();
    expect(selection?.children.map((c) => c.slug)).toEqual(["telefon-iphone", "telefon-android"]);
  });

  it("selects a subcategory and keeps its branch open", () => {
    const { selection } = buildCategoryHub(tree, stats, "telefon-iphone");

    expect(selection?.category.slug).toBe("telefon-iphone");
    expect(selection?.parent?.slug).toBe("telefon");
    expect(selection?.children).toEqual([]);
    expect(selection?.branchId).toBe(1);
  });

  it("ignores unknown or empty slugs", () => {
    expect(buildCategoryHub(tree, stats, "yok").selection).toBeNull();
    expect(buildCategoryHub(tree, stats, null).selection).toBeNull();
  });
});

describe("previewSubcategories", () => {
  it("limits the preview and reports the hidden count", () => {
    const children = Array.from({ length: 6 }, (_, i) => category(100 + i, `s${i}`, 1));
    const main = {
      ...buildCategoryHub(tree, stats, null).mains[0],
      children: children.map((child) => ({ ...child, productCount: 0, listingCount: 0, latestListingAt: null })),
    };

    const preview = previewSubcategories(main);
    expect(preview.visible).toHaveLength(4);
    expect(preview.hiddenCount).toBe(2);
  });
});

describe("hubHref", () => {
  it("links every category to its own page", () => {
    expect(hubHref(null)).toBe("/categories");
    expect(hubHref("tv-ses")).toBe("/category/tv-ses");
  });
});
