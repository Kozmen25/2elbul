import { unstable_cache } from "next/cache";
import { cache } from "react";
import { CATEGORY_ICON_MAP, resolveCategoryIcon } from "@/lib/category-icons";
import { CACHE_SECONDS, CACHE_TAGS } from "@/lib/cache-policy";
import { isPublicDemoProductName } from "@/lib/public-data-cleanup";
import { createSupabaseClient } from "@/lib/supabase";

// The one category system. Everything category-related — homepage tiles,
// header mega-menu, /category/[slug] pages, product breadcrumbs, sitemap,
// mobile API — reads from here.
//
//  * Taxonomy: public.categories (main + subcategories, descriptions, rules).
//  * Membership: products.category_id, assigned in the database by trigger
//    products_assign_category (supabase/migrations/
//    20260930002800_product_category_assignment.sql). It is NOT NULL, so every
//    product is in exactly one category; unmatched products go to the
//    fallback category ("Diğer").
//
// Nothing in the app decides membership by keywords at read time.
//
// Separate concern: lib/category-taxonomy.ts expands search queries
// ("laptop" → "notebook", ...) and is not a navigation taxonomy.

// Icons live in lib/category-icons.ts so client components can use them
// without importing this server-side data layer.
export { CATEGORY_ICON_MAP, resolveCategoryIcon };

export type Category = {
  id: number;
  slug: string;
  parentId: number | null;
  name: string;
  icon: string | null;
  shortDescription: string | null;
  longDescription: string | null;
  expectedProductType: string | null;
  displayOrder: number;
  isFallback: boolean;
};

export type CategoryWithChildren = Category & {
  children: Category[];
};

export type ResolvedCategory = {
  category: Category;
  parent: Category | null;
  children: Category[];
};

export type CategoryStats = {
  productCount: number;
  listingCount: number;
  latestListingAt: string | null;
};

export const EMPTY_CATEGORY_STATS: CategoryStats = {
  productCount: 0,
  listingCount: 0,
  latestListingAt: null,
};

type CategoryRow = {
  id: number;
  slug: string;
  parent_id: number | null;
  name: string;
  icon: string | null;
  short_description: string | null;
  long_description: string | null;
  expected_product_type: string | null;
  display_order: number;
  is_fallback: boolean;
};

function mapRow(row: CategoryRow): Category {
  return {
    id: row.id,
    slug: row.slug,
    parentId: row.parent_id,
    name: row.name,
    icon: row.icon,
    shortDescription: row.short_description,
    longDescription: row.long_description,
    expectedProductType: row.expected_product_type,
    displayOrder: row.display_order,
    isFallback: row.is_fallback,
  };
}

// Cached across requests (shared tag: CACHE_TAGS.categories). A failed query
// throws so the failure is never cached; callers fall back to an empty list.
const fetchActiveCategories = unstable_cache(
  async (): Promise<Category[]> => {
    const supabase = createSupabaseClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("categories")
      .select(
        "id, slug, parent_id, name, icon, short_description, long_description, expected_product_type, display_order, is_fallback",
      )
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (error) throw error;
    return (data ?? []).map(mapRow);
  },
  ["categories:active"],
  { revalidate: CACHE_SECONDS.catalog, tags: [CACHE_TAGS.categories] },
);

/** All active categories (main + sub), ordered. Empty array if DB unavailable. */
export const getAllCategories = cache(async (): Promise<Category[]> => {
  try {
    return await fetchActiveCategories();
  } catch (error) {
    console.error("Categories query failed:", error);
    return [];
  }
});

export function buildCategoryTree(categories: Category[]): CategoryWithChildren[] {
  return categories
    .filter((category) => category.parentId === null)
    .map((main) => ({
      ...main,
      children: categories.filter((category) => category.parentId === main.id),
    }));
}

export function resolveCategory(categories: Category[], category: Category): ResolvedCategory {
  const parent = category.parentId
    ? categories.find((c) => c.id === category.parentId) ?? null
    : null;
  const children = categories.filter((c) => c.parentId === category.id);
  return { category, parent, children };
}

/** Category ids whose products belong to `category` (itself + its subcategories). */
export function getCategoryScopeIds(resolved: ResolvedCategory): number[] {
  return [resolved.category.id, ...resolved.children.map((child) => child.id)];
}

/** Full two-level tree (all active categories). */
export const getCategoryTree = cache(async (): Promise<CategoryWithChildren[]> => {
  return buildCategoryTree(await getAllCategories());
});

/** Single category by slug, with its parent (if a subcategory) and children. */
export const getCategoryBySlug = cache(async (slug: string): Promise<ResolvedCategory | null> => {
  const all = await getAllCategories();
  const category = all.find((c) => c.slug === slug);
  return category ? resolveCategory(all, category) : null;
});

/** Single category by id — used to resolve products.category_id. */
export const getCategoryById = cache(async (id: number): Promise<ResolvedCategory | null> => {
  const all = await getAllCategories();
  const category = all.find((c) => c.id === id);
  return category ? resolveCategory(all, category) : null;
});

// ---------------------------------------------------------------------------
// Counts
// ---------------------------------------------------------------------------

export type CategoryProductMembership = {
  productId: string;
  categoryId: number;
};

export type ProductListingSummary = {
  productId: string;
  listingCount: number;
  latestListingAt: string | null;
};

/**
 * Per-category totals. A main category's totals include its subcategories,
 * so the homepage tile, the menu and the category page all agree.
 */
export function aggregateCategoryStats(
  categories: Category[],
  memberships: CategoryProductMembership[],
  listingSummaries: ProductListingSummary[],
): Map<number, CategoryStats> {
  const listingsByProduct = new Map(listingSummaries.map((summary) => [summary.productId, summary]));
  const parentById = new Map(categories.map((category) => [category.id, category.parentId]));
  const stats = new Map<number, CategoryStats>(
    categories.map((category) => [category.id, { ...EMPTY_CATEGORY_STATS }]),
  );

  for (const membership of memberships) {
    const listing = listingsByProduct.get(membership.productId);
    const parentId = parentById.get(membership.categoryId) ?? null;
    for (const categoryId of parentId ? [membership.categoryId, parentId] : [membership.categoryId]) {
      const entry = stats.get(categoryId);
      if (!entry) continue;
      entry.productCount += 1;
      entry.listingCount += listing?.listingCount ?? 0;
      entry.latestListingAt = latestTimestamp(entry.latestListingAt, listing?.latestListingAt ?? null);
    }
  }

  return stats;
}

function latestTimestamp(current: string | null, candidate: string | null) {
  if (!candidate) return current;
  if (!current) return candidate;
  return new Date(candidate).getTime() > new Date(current).getTime() ? candidate : current;
}

const PRODUCT_PAGE_SIZE = 1000;

async function fetchProductMemberships(
  supabase: NonNullable<ReturnType<typeof createSupabaseClient>>,
): Promise<CategoryProductMembership[]> {
  const memberships: CategoryProductMembership[] = [];
  for (let offset = 0; ; offset += PRODUCT_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, category_id")
      .order("id", { ascending: true })
      .range(offset, offset + PRODUCT_PAGE_SIZE - 1);
    if (error) {
      throw error;
    }
    for (const row of data ?? []) {
      if (isPublicDemoProductName(row.name)) continue;
      memberships.push({ productId: String(row.id), categoryId: row.category_id });
    }
    if ((data ?? []).length < PRODUCT_PAGE_SIZE) return memberships;
  }
}

async function fetchListingSummaries(
  supabase: NonNullable<ReturnType<typeof createSupabaseClient>>,
): Promise<ProductListingSummary[]> {
  const summaries: ProductListingSummary[] = [];
  for (let offset = 0; ; offset += PRODUCT_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("product_price_stats")
      .select("product_id, listing_count, last_seen_at")
      .order("product_id", { ascending: true })
      .range(offset, offset + PRODUCT_PAGE_SIZE - 1);
    if (error) {
      throw error;
    }
    for (const row of data ?? []) {
      if (row.product_id == null) continue;
      summaries.push({
        productId: String(row.product_id),
        listingCount: row.listing_count ?? 0,
        latestListingAt: row.last_seen_at,
      });
    }
    if ((data ?? []).length < PRODUCT_PAGE_SIZE) return summaries;
  }
}

type CategoryStatEntry = [categoryId: number, stats: CategoryStats];

// Counting walks every product and price-stat row, so the result is shared
// across requests. Map is not serialisable, hence the entry list. A failed
// query throws and is therefore never cached.
const fetchCategoryStatEntries = unstable_cache(
  async (): Promise<CategoryStatEntry[]> => {
    const categories = await getAllCategories();
    const supabase = createSupabaseClient();
    if (!supabase) return [...aggregateCategoryStats(categories, [], [])];

    const [memberships, listingSummaries] = await Promise.all([
      fetchProductMemberships(supabase),
      fetchListingSummaries(supabase),
    ]);
    return [...aggregateCategoryStats(categories, memberships, listingSummaries)];
  },
  ["categories:stats"],
  { revalidate: CACHE_SECONDS.catalog, tags: [CACHE_TAGS.categories] },
);

export const getCategoryStats = cache(async (): Promise<Map<number, CategoryStats>> => {
  try {
    return new Map(await fetchCategoryStatEntries());
  } catch (error) {
    console.error("Category stats query failed:", error);
    return aggregateCategoryStats(await getAllCategories(), [], []);
  }
});

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

/**
 * The fallback category ("Diğer") is only shown while it actually holds
 * products; every other active category is always shown.
 */
export function isCategoryVisible(category: Category, stats: Map<number, CategoryStats>): boolean {
  return !category.isFallback || (stats.get(category.id)?.productCount ?? 0) > 0;
}

/** Tree used by the header mega-menu and the homepage. */
export const getNavigationCategoryTree = cache(async (): Promise<CategoryWithChildren[]> => {
  const [tree, stats] = await Promise.all([getCategoryTree(), getCategoryStats()]);
  return tree
    .filter((main) => isCategoryVisible(main, stats))
    .map((main) => ({
      ...main,
      children: main.children.filter((child) => isCategoryVisible(child, stats)),
    }));
});
