import { buildCategoryTree, getAllCategories, type Category } from "@/lib/categories";
import { MAX_HEADER_CATEGORIES } from "@/lib/header-category-limits";
import { getHeaderCategorySettings } from "@/lib/site-settings";

/** What the header menu needs to render and link a category. */
export type HeaderCategory = {
  id: number;
  slug: string;
  name: string;
};

function toHeaderCategory(category: Category): HeaderCategory {
  return { id: category.id, slug: category.slug, name: category.name };
}

/**
 * Picks the header categories. Without a saved selection every main category
 * is shown (the fallback "Diğer" category excluded). A saved selection may
 * contain main categories and subcategories; it is listed in taxonomy order.
 */
export function selectHeaderCategories(
  categories: Category[],
  selectedSlugs: string[] | null,
): HeaderCategory[] {
  const tree = buildCategoryTree(categories);

  if (selectedSlugs === null) {
    return tree.filter((main) => !main.isFallback).map(toHeaderCategory);
  }

  const selected = new Set(selectedSlugs);
  return tree
    .flatMap((main) => [main, ...main.children])
    .filter((category) => selected.has(category.slug))
    .slice(0, MAX_HEADER_CATEGORIES)
    .map(toHeaderCategory);
}

/** Header menu categories: two cached reads, no per-category counts. */
export async function getHeaderCategories(): Promise<HeaderCategory[]> {
  const [categories, settings] = await Promise.all([
    getAllCategories(),
    getHeaderCategorySettings(),
  ]);
  return selectHeaderCategories(categories, settings.slugs);
}
