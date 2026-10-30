import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { AdminCategory } from "@/lib/category-admin-rules";

vi.mock("@/lib/site-settings", () => ({ HEADER_CATEGORIES_KEY: "header_categories" }));

import { deleteCategory, moveCategoryProducts, updateCategory } from "@/lib/category-admin";

// Guard clauses must refuse before any write happens.
const untouchable = new Proxy(
  {},
  {
    get() {
      throw new Error("database must not be touched");
    },
  },
) as SupabaseClient<Database>;

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

const tree = [
  category({ id: 1, slug: "telefon", productCount: 3 }),
  category({ id: 2, slug: "bilgisayar" }),
  category({ id: 3, slug: "laptop", parentId: 2, productCount: 2 }),
  category({ id: 9, slug: "diger", isFallback: true }),
  category({ id: 10, slug: "gizli", isActive: false }),
];

describe("deleteCategory guards", () => {
  it("never deletes the fallback category", async () => {
    expect(await deleteCategory(untouchable, tree, 9, null)).toMatchObject({ ok: false });
  });

  it("refuses categories that still have subcategories", async () => {
    const result = await deleteCategory(untouchable, tree, 2, null);
    expect(result).toMatchObject({ ok: false });
    expect(result.message).toContain("alt kategori");
  });

  it("requires a target when the category holds products", async () => {
    const result = await deleteCategory(untouchable, tree, 1, null);
    expect(result).toMatchObject({ ok: false });
    expect(result.message).toContain("3 ürün");
  });
});

describe("moveCategoryProducts guards", () => {
  it("refuses same source/target and hidden targets", async () => {
    expect((await moveCategoryProducts(untouchable, tree, 1, 1)).ok).toBe(false);
    expect((await moveCategoryProducts(untouchable, tree, 1, 10)).ok).toBe(false);
    expect((await moveCategoryProducts(untouchable, tree, 1, 404)).ok).toBe(false);
  });
});

describe("updateCategory guards", () => {
  it("refuses to hide a category that holds products", async () => {
    const values = {
      name: "Bilgisayar",
      slug: "bilgisayar",
      parent_id: null,
      icon: null,
      short_description: null,
      long_description: null,
      match_keywords: [],
      exclude_keywords: [],
      is_active: false,
    };
    const result = await updateCategory(untouchable, 2, values, tree);
    expect(result.ok).toBe(false);
    expect(result.message).toContain("2 ürün");
  });
});
