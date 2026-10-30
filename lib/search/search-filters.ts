import type { Listing } from "@/lib/listings";
import { extractBrand, formatBrandDisplayName } from "@/lib/normalization/engine";

// Result filtering for /search: category, brand, model, city, source,
// condition and a price range. Pure functions over the listings the search
// page already loaded, so every control reacts instantly.
//
// Faceted behaviour: the options of a filter are built from the listings that
// match every OTHER active filter, so a visitor can never pick a combination
// that has no results, and each option carries the number of listings it
// would show.

export type SearchFilterKey = "category" | "brand" | "model" | "city" | "source" | "condition";

export type SearchFilters = Record<SearchFilterKey, string> & {
  /** Price bounds as typed (TL); empty string = no bound. */
  min: string;
  max: string;
};

export const EMPTY_SEARCH_FILTERS: SearchFilters = {
  category: "",
  brand: "",
  model: "",
  city: "",
  source: "",
  condition: "",
  min: "",
  max: "",
};

export const SEARCH_FILTER_PARAMS = Object.keys(EMPTY_SEARCH_FILTERS) as (keyof SearchFilters)[];

/**
 * category -> brand -> model is a hierarchy: a filter's options ignore the
 * choices below it (so the category can be switched while a brand is set) and
 * are narrowed by the choices above it.
 */
const HIERARCHY: SearchFilterKey[] = ["category", "brand", "model"];

function ignoredWhenCounting(key: SearchFilterKey): SearchFilterKey[] {
  const level = HIERARCHY.indexOf(key);
  return level === -1 ? [key] : HIERARCHY.slice(level);
}

export type FacetOption = {
  value: string;
  label: string;
  count: number;
};

export function normalizeFilterValue(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function filtersFromParams(params: { get(name: string): string | null }): SearchFilters {
  const filters = { ...EMPTY_SEARCH_FILTERS };
  for (const key of SEARCH_FILTER_PARAMS) {
    filters[key] = params.get(key) ?? "";
  }
  return filters;
}

/** Writes only the active filters, leaving other parameters (q, sort ...) alone. */
export function writeFiltersToParams(filters: SearchFilters, params: URLSearchParams): void {
  for (const key of SEARCH_FILTER_PARAMS) {
    if (filters[key]) params.set(key, filters[key]);
    else params.delete(key);
  }
}

export function countActiveFilters(filters: SearchFilters): number {
  return SEARCH_FILTER_PARAMS.filter((key) => filters[key] !== "").length;
}

/** Display brand of a listing, derived from its product name ("Apple", "HP" ...). */
export function listingBrand(listing: Listing): string {
  return formatBrandDisplayName(extractBrand(listing.productName)) ?? "";
}

function listingValue(listing: Listing, key: SearchFilterKey): string {
  switch (key) {
    case "category":
      return listing.category ?? "";
    case "brand":
      return listingBrand(listing);
    case "model":
      return listing.productId ?? "";
    case "city":
      return listing.city;
    case "source":
      return normalizeFilterValue(listing.source);
    case "condition":
      return listing.condition;
  }
}

function parseBound(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function matches(listing: Listing, filters: SearchFilters, skip: SearchFilterKey[] = []): boolean {
  for (const key of Object.keys(EMPTY_SEARCH_FILTERS) as (keyof SearchFilters)[]) {
    if (key === "min" || key === "max" || (skip as string[]).includes(key)) continue;
    if (filters[key] && listingValue(listing, key) !== filters[key]) return false;
  }
  const min = parseBound(filters.min);
  const max = parseBound(filters.max);
  return (min === null || listing.price >= min) && (max === null || listing.price <= max);
}

export function applySearchFilters(listings: Listing[], filters: SearchFilters): Listing[] {
  return listings.filter((listing) => matches(listing, filters));
}

/**
 * Options for one filter, counted over the listings that match all the other
 * filters (price included). Sorted by count, then label.
 */
export function buildFacet(
  listings: Listing[],
  filters: SearchFilters,
  key: SearchFilterKey,
): FacetOption[] {
  const counts = new Map<string, FacetOption>();
  for (const listing of listings) {
    if (!matches(listing, filters, ignoredWhenCounting(key))) continue;
    const value = listingValue(listing, key);
    if (!value) continue;
    const existing = counts.get(value);
    if (existing) existing.count += 1;
    else counts.set(value, { value, label: facetLabel(listing, key), count: 1 });
  }
  return [...counts.values()].sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label, "tr"),
  );
}

function facetLabel(listing: Listing, key: SearchFilterKey): string {
  if (key === "model") return listing.productName;
  if (key === "source") return listing.source;
  return listingValue(listing, key);
}

/**
 * Top-down cleanup: a brand that does not exist in the chosen category, or a
 * model that does not exist for the chosen brand, is dropped so the visitor
 * never lands on an empty page because of a stale choice. The category itself
 * and the non-hierarchical filters (city, price ...) are left as chosen.
 */
export function sanitizeFilters(listings: Listing[], filters: SearchFilters): SearchFilters {
  let current = filters;
  for (const key of HIERARCHY.slice(1)) {
    if (!current[key]) continue;
    // City, price etc. must not decide whether a brand/model choice is kept.
    const hierarchyOnly = { ...EMPTY_SEARCH_FILTERS };
    for (const level of HIERARCHY) hierarchyOnly[level] = current[level];
    const available = buildFacet(listings, hierarchyOnly, key);
    if (!available.some((option) => option.value === current[key])) {
      current = { ...current, [key]: "" };
    }
  }
  return current;
}

/** Lowest and highest price among listings matching the non-price filters. */
export function priceBounds(
  listings: Listing[],
  filters: SearchFilters,
): { min: number; max: number } | null {
  const pool = listings.filter((listing) => matches(listing, { ...filters, min: "", max: "" }));
  if (pool.length === 0) return null;
  const prices = pool.map((listing) => listing.price);
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

export type ActiveFilterChip = {
  key: keyof SearchFilters | "price";
  label: string;
};

/** One removable chip per active filter; min and max are shown as one price chip. */
export function describeActiveFilters(
  filters: SearchFilters,
  labelFor: (key: SearchFilterKey, value: string) => string,
  formatPrice: (value: number) => string,
): ActiveFilterChip[] {
  const labels: Record<SearchFilterKey, string> = {
    category: "Kategori",
    brand: "Marka",
    model: "Model",
    city: "Konum",
    source: "Kaynak",
    condition: "Durum",
  };
  const chips: ActiveFilterChip[] = (Object.keys(labels) as SearchFilterKey[])
    .filter((key) => filters[key])
    .map((key) => ({ key, label: `${labels[key]}: ${labelFor(key, filters[key])}` }));

  const min = parseBound(filters.min);
  const max = parseBound(filters.max);
  if (min !== null || max !== null) {
    chips.push({
      key: "price",
      label: `Fiyat: ${min !== null ? formatPrice(min) : "0 TL"} - ${max !== null ? formatPrice(max) : "üst sınır yok"}`,
    });
  }
  return chips;
}
