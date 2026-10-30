import { describe, expect, it } from "vitest";
import {
  nextDisplayOrder,
  parseKeywordList,
  planReorder,
  slugifyCategoryName,
  validateCategoryInput,
  countProductsInScope,
  type AdminCategory,
  type CategoryInput,
} from "@/lib/category-admin-rules";

function category(overrides: Partial<AdminCategory> & Pick<AdminCategory, "id" | "slug">): AdminCategory {
  return {
    parentId: null,
    name: overrides.slug,
    icon: null,
    shortDescription: null,
    longDescription: null,
    matchKeywords: [],
    excludeKeywords: [],
    displayOrder: overrides.id * 10,
    isActive: true,
    isFallback: false,
    productCount: 0,
    ...overrides,
  };
}

const tree: AdminCategory[] = [
  category({ id: 1, slug: "telefon", productCount: 2 }),
  category({ id: 2, slug: "bilgisayar" }),
  category({ id: 3, slug: "laptop", parentId: 2, displayOrder: 10, productCount: 5 }),
  category({ id: 4, slug: "tablet", parentId: 2, displayOrder: 20, productCount: 1 }),
  category({ id: 9, slug: "diger", isFallback: true, displayOrder: 1000, productCount: 7 }),
];

const ICONS = ["Laptop", "Smartphone"];

function input(overrides: Partial<CategoryInput> = {}): CategoryInput {
  return {
    name: "Yeni Kategori",
    slug: "",
    parentId: null,
    icon: null,
    shortDescription: "",
    longDescription: "",
    matchKeywords: "",
    excludeKeywords: "",
    isActive: true,
    ...overrides,
  };
}

describe("slugifyCategoryName / parseKeywordList", () => {
  it("folds Turkish letters", () => {
    expect(slugifyCategoryName("Çamaşır Makinesi İşlemci")).toBe("camasir-makinesi-islemci");
  });

  it("splits on commas and newlines, trims and removes duplicates", () => {
    expect(parseKeywordList("laptop, Notebook\n laptop ,,NOTEBOOK")).toEqual(["laptop", "Notebook"]);
  });
});

describe("validateCategoryInput", () => {
  it("derives the slug from the name and normalises values", () => {
    const result = validateCategoryInput(
      input({ name: " Akıllı Saat ", matchKeywords: "saat, watch", icon: "Laptop" }),
      tree,
      null,
      ICONS,
    );
    expect(result).toMatchObject({
      ok: true,
      values: { name: "Akıllı Saat", slug: "akilli-saat", match_keywords: ["saat", "watch"], parent_id: null },
    });
  });

  it("rejects duplicate slugs but allows keeping the own slug", () => {
    expect(validateCategoryInput(input({ slug: "telefon" }), tree, null, ICONS)).toMatchObject({
      ok: false,
      errors: { slug: expect.any(String) },
    });
    expect(validateCategoryInput(input({ name: "Telefon", slug: "telefon" }), tree, 1, ICONS).ok).toBe(true);
  });

  it("allows only two levels", () => {
    const underSub = validateCategoryInput(input({ parentId: 3 }), tree, null, ICONS);
    expect(underSub).toMatchObject({ ok: false, errors: { parentId: expect.any(String) } });
    expect(validateCategoryInput(input({ parentId: 1 }), tree, null, ICONS).ok).toBe(true);
  });

  it("does not let a category with subcategories become a subcategory", () => {
    const result = validateCategoryInput(input({ name: "Bilgisayar", slug: "bilgisayar", parentId: 1 }), tree, 2, ICONS);
    expect(result).toMatchObject({ ok: false, errors: { parentId: expect.any(String) } });
  });

  it("protects the fallback category", () => {
    const reparent = validateCategoryInput(input({ name: "Diğer", slug: "diger", parentId: 1 }), tree, 9, ICONS);
    expect(reparent).toMatchObject({ ok: false, errors: { parentId: expect.any(String) } });
    const hide = validateCategoryInput(input({ name: "Diğer", slug: "diger", isActive: false }), tree, 9, ICONS);
    expect(hide).toMatchObject({ ok: false, errors: { isActive: expect.any(String) } });
    const underFallback = validateCategoryInput(input({ parentId: 9 }), tree, null, ICONS);
    expect(underFallback).toMatchObject({ ok: false, errors: { parentId: expect.any(String) } });
  });

  it("rejects bad names, slugs and icons", () => {
    const result = validateCategoryInput(input({ name: "A", slug: "Bad Slug!", icon: "Nope" }), tree, null, ICONS);
    expect(result).toMatchObject({
      ok: false,
      errors: { name: expect.any(String), slug: expect.any(String), icon: expect.any(String) },
    });
  });
});

describe("planReorder", () => {
  it("swaps with the neighbour and renumbers only changed rows", () => {
    expect(planReorder(tree, 2, "up")).toEqual([
      { id: 2, displayOrder: 10 },
      { id: 1, displayOrder: 20 },
    ]);
  });

  it("returns null at the edges and for the fallback category", () => {
    expect(planReorder(tree, 1, "up")).toBeNull();
    expect(planReorder(tree, 2, "down")).toBeNull(); // fallback is pinned last, not a sibling
    expect(planReorder(tree, 9, "up")).toBeNull();
    expect(planReorder(tree, 999, "up")).toBeNull();
  });

  it("only reorders among the same parent", () => {
    expect(planReorder(tree, 4, "up")).toEqual([
      { id: 4, displayOrder: 10 },
      { id: 3, displayOrder: 20 },
    ]);
  });

  it("repairs duplicate orders", () => {
    const same = [category({ id: 1, slug: "a", displayOrder: 5 }), category({ id: 2, slug: "b", displayOrder: 5 })];
    expect(planReorder(same, 2, "up")).toEqual([
      { id: 2, displayOrder: 10 },
      { id: 1, displayOrder: 20 },
    ]);
  });
});

describe("ordering and counting helpers", () => {
  it("appends after the last sibling, ignoring the fallback", () => {
    expect(nextDisplayOrder(tree, null)).toBe(30);
    expect(nextDisplayOrder(tree, 2)).toBe(30);
    expect(nextDisplayOrder(tree, 1)).toBe(10);
  });

  it("counts products of a category including its subcategories", () => {
    expect(countProductsInScope(tree, 2)).toBe(6);
    expect(countProductsInScope(tree, 1)).toBe(2);
  });
});
