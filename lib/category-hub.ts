import {
  EMPTY_CATEGORY_STATS,
  getCategoryStats,
  getNavigationCategoryTree,
  type Category,
  type CategoryStats,
  type CategoryWithChildren,
} from "@/lib/categories";

// View model for the /categories hub: the navigation tree joined with the
// per-category counts, plus the category picked in the sidebar.

export type HubCategory = Category & CategoryStats;

export type HubMainCategory = HubCategory & {
  children: HubCategory[];
};

export type HubTotals = {
  mainCount: number;
  subcategoryCount: number;
  productCount: number;
  listingCount: number;
};

export type HubSelection = {
  category: HubCategory;
  /** Set when the selected category is a subcategory. */
  parent: HubCategory | null;
  /** Subcategories of the selected main category (empty for a subcategory). */
  children: HubCategory[];
  /** The main category whose branch the sidebar should expand. */
  branchId: number;
};

export type CategoryHub = {
  mains: HubMainCategory[];
  totals: HubTotals;
  selection: HubSelection | null;
};

const SUBCATEGORY_PREVIEW_LIMIT = 4;

function withStats(category: Category, stats: Map<number, CategoryStats>): HubCategory {
  return { ...category, ...(stats.get(category.id) ?? EMPTY_CATEGORY_STATS) };
}

export function buildCategoryHub(
  tree: CategoryWithChildren[],
  stats: Map<number, CategoryStats>,
  selectedSlug: string | null,
): CategoryHub {
  const mains: HubMainCategory[] = tree.map((main) => ({
    ...withStats(main, stats),
    children: main.children.map((child) => withStats(child, stats)),
  }));

  // Main totals already include their subcategories, so summing mains is exact.
  const totals: HubTotals = {
    mainCount: mains.length,
    subcategoryCount: mains.reduce((sum, main) => sum + main.children.length, 0),
    productCount: mains.reduce((sum, main) => sum + main.productCount, 0),
    listingCount: mains.reduce((sum, main) => sum + main.listingCount, 0),
  };

  return { mains, totals, selection: findSelection(mains, selectedSlug) };
}

function findSelection(mains: HubMainCategory[], slug: string | null): HubSelection | null {
  if (!slug) return null;
  for (const main of mains) {
    if (main.slug === slug) {
      return { category: main, parent: null, children: main.children, branchId: main.id };
    }
    const child = main.children.find((candidate) => candidate.slug === slug);
    if (child) return { category: child, parent: main, children: [], branchId: main.id };
  }
  return null;
}

/** First subcategories shown on an overview card, and how many are hidden. */
export function previewSubcategories(main: HubMainCategory) {
  return {
    visible: main.children.slice(0, SUBCATEGORY_PREVIEW_LIMIT),
    hiddenCount: Math.max(0, main.children.length - SUBCATEGORY_PREVIEW_LIMIT),
  };
}

/** Every category, subcategory included, opens its own /category/[slug] page. */
export function hubHref(slug: string | null): string {
  return slug ? `/category/${encodeURIComponent(slug)}` : "/categories";
}

/** Cached tree + counts joined for the sidebar; `selectedSlug` marks the open branch. */
export async function loadCategoryHub(selectedSlug: string | null): Promise<CategoryHub> {
  const [tree, stats] = await Promise.all([getNavigationCategoryTree(), getCategoryStats()]);
  return buildCategoryHub(tree, stats, selectedSlug);
}
