import { createProductSlug } from "@/lib/product-slug";

// Pure helpers behind the search box dropdown: which brand/category pages
// match what is typed, how the dropdown rows are ordered, how the typed text is
// highlighted and how recent searches are remembered.

export type BrandSuggestion = { name: string; slug: string; productCount: number; href: string };
export type CategorySuggestion = { name: string; slug: string; parentName: string | null; href: string };
export type ProductSuggestion = { id: string; name: string; listingCount: number; href: string };

export type SuggestionKind = "recent" | "product" | "brand" | "category";

export type SuggestionItem = {
  key: string;
  kind: SuggestionKind;
  label: string;
  /** Secondary text: "12 ilan", "Marka sayfası" ... */
  meta: string;
  href: string;
};

export type SuggestionGroup = { title: string; items: SuggestionItem[] };

export const MAX_RECENT_SEARCHES = 6;
const MAX_PRODUCT_ROWS = 6;

/** Letters-only comparison key: Turkish folded, case/spacing/punctuation ignored. */
function foldKey(value: string): string {
  return createProductSlug(value).replace(/-/g, "");
}

function rank(label: string, query: string): number {
  const label_ = foldKey(label);
  const query_ = foldKey(query);
  if (!query_ || !label_.includes(query_)) return -1;
  return label_.startsWith(query_) ? 0 : 1;
}

export function matchBrandSuggestions(
  catalog: { slug: string; name: string; productCount: number }[],
  query: string,
  limit: number,
): BrandSuggestion[] {
  return catalog
    .map((brand) => ({ brand, rank: rank(brand.name, query) }))
    .filter((entry) => entry.rank >= 0)
    .sort((a, b) => a.rank - b.rank || b.brand.productCount - a.brand.productCount)
    .slice(0, limit)
    .map(({ brand }) => ({
      name: brand.name,
      slug: brand.slug,
      productCount: brand.productCount,
      href: `/brand/${brand.slug}`,
    }));
}

export function matchCategorySuggestions(
  categories: { id: number; slug: string; name: string; parentId: number | null; isFallback: boolean }[],
  query: string,
  limit: number,
): CategorySuggestion[] {
  return categories
    .filter((category) => !category.isFallback)
    .map((category) => ({ category, rank: rank(category.name, query) }))
    .filter((entry) => entry.rank >= 0)
    .sort((a, b) => a.rank - b.rank || a.category.name.localeCompare(b.category.name, "tr"))
    .slice(0, limit)
    .map(({ category }) => ({
      name: category.name,
      slug: category.slug,
      parentName: categories.find((c) => c.id === category.parentId)?.name ?? null,
      href: `/category/${category.slug}`,
    }));
}

export function searchHref(query: string): string {
  return `/search?q=${encodeURIComponent(query)}`;
}

/**
 * Dropdown content. With text typed: products first (what most people want),
 * then brand and category pages. Empty box: recent searches, then popular ones.
 */
export function buildSuggestionGroups({
  query,
  products,
  brands,
  categories,
  recents,
}: {
  query: string;
  products: ProductSuggestion[];
  brands: BrandSuggestion[];
  categories: CategorySuggestion[];
  recents: string[];
}): SuggestionGroup[] {
  const groups: SuggestionGroup[] = [];
  const trimmed = query.trim();

  const productItems = products.slice(0, MAX_PRODUCT_ROWS).map<SuggestionItem>((product) => ({
    key: `product:${product.id}`,
    kind: "product",
    label: product.name,
    meta: `${product.listingCount} ilan`,
    href: product.href,
  }));

  if (!trimmed) {
    const recentItems = recents.map<SuggestionItem>((recent) => ({
      key: `recent:${recent}`,
      kind: "recent",
      label: recent,
      meta: "",
      href: searchHref(recent),
    }));
    if (recentItems.length) groups.push({ title: "Son aramalarınız", items: recentItems });
    if (productItems.length) groups.push({ title: "Popüler aramalar", items: productItems });
    return groups;
  }

  if (productItems.length) groups.push({ title: "Ürünler", items: productItems });
  if (brands.length) {
    groups.push({
      title: "Markalar",
      items: brands.map((brand) => ({
        key: `brand:${brand.slug}`,
        kind: "brand",
        label: brand.name,
        meta: `${brand.productCount} ürün`,
        href: brand.href,
      })),
    });
  }
  if (categories.length) {
    groups.push({
      title: "Kategoriler",
      items: categories.map((category) => ({
        key: `category:${category.slug}`,
        kind: "category",
        label: category.name,
        meta: category.parentName ?? "Kategori",
        href: category.href,
      })),
    });
  }
  return groups;
}

export type HighlightPart = { text: string; match: boolean };

/** Splits `label` so the first occurrence of `query` (case-insensitive) can be emphasised. */
export function highlightParts(label: string, query: string): HighlightPart[] {
  const needle = query.trim().toLocaleLowerCase("tr-TR");
  const index = needle ? label.toLocaleLowerCase("tr-TR").indexOf(needle) : -1;
  if (index < 0 || label.length === 0) return [{ text: label, match: false }];
  return [
    { text: label.slice(0, index), match: false },
    { text: label.slice(index, index + needle.length), match: true },
    { text: label.slice(index + needle.length), match: false },
  ].filter((part) => part.text !== "");
}

/** Newest first, case-insensitive de-duplication, capped. */
export function addRecentSearch(recents: string[], query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return recents;
  const key = trimmed.toLocaleLowerCase("tr-TR");
  return [trimmed, ...recents.filter((item) => item.toLocaleLowerCase("tr-TR") !== key)].slice(
    0,
    MAX_RECENT_SEARCHES,
  );
}

/** Next highlighted row for ArrowUp/ArrowDown; -1 means "nothing highlighted". */
export function moveActiveIndex(current: number, direction: "up" | "down", count: number): number {
  if (count === 0) return -1;
  if (direction === "down") return current >= count - 1 ? 0 : current + 1;
  return current <= 0 ? count - 1 : current - 1;
}
