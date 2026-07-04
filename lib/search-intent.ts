import {
  CATEGORY_TAXONOMY,
  expandQueryByTaxonomy,
  normalizeCategoryText,
} from "./category-taxonomy";
import type { ICategoryResolver } from "./taxonomy/integration";

export type SearchIntentTerm = {
  term: string;
  weight: number;
  reason: "original" | "category" | "synonym" | "keyword" | "child";
};

export type SearchIntent = {
  query: string;
  normalizedQuery: string;
  matchedCategories: Array<{
    slug: string;
    name: string;
    depth: number;
  }>;
  terms: SearchIntentTerm[];
  isBroadCategory: boolean;
  label: string | null;
};

export const SEARCH_CATEGORY_TREE = CATEGORY_TAXONOMY.map((category) => ({
  slug: category.id,
  name: category.label,
  synonyms: category.aliases,
  keywords: category.keywords,
  children: category.children?.map((child) => ({
    slug: child.id,
    name: child.label,
    synonyms: child.aliases,
    keywords: child.keywords,
  })),
}));

export function resolveSearchIntent(query: string, resolver?: ICategoryResolver): SearchIntent {
  const expanded = expandQueryByTaxonomy(query);
  const termMap = new Map<string, SearchIntentTerm>();

  addTerm(termMap, query, 100, "original");

  for (const match of expanded.matches) {
    addTerm(
      termMap,
      match.category.label,
      match.matchType === "keyword" ? 45 : 90 - match.depth * 5,
      "category",
    );
  }

  for (const term of expanded.terms) {
    if (normalizeCategoryText(term) === expanded.normalizedQuery) continue;
    addTerm(
      termMap,
      term,
      expanded.isBroadCategory ? 58 : 48,
      expanded.isBroadCategory ? "child" : "keyword",
    );
  }

  return {
    query: expanded.query,
    normalizedQuery: expanded.normalizedQuery,
    matchedCategories: expanded.matches.map((match) => ({
      slug: match.category.id,
      name: match.category.label,
      depth: match.depth,
    })),
    terms: [...termMap.values()].sort((a, b) => b.weight - a.weight),
    isBroadCategory: expanded.isBroadCategory,
    label: expanded.label,
  };
}

export function scoreSearchResult(
  intent: SearchIntent,
  input: { title?: string | null; productName?: string | null },
) {
  const haystack = normalizeCategoryText(
    `${input.productName ?? ""} ${input.title ?? ""}`,
  );
  if (!haystack) return 0;

  let score = 0;
  for (const term of intent.terms) {
    const normalizedTerm = normalizeCategoryText(term.term);
    if (!normalizedTerm) continue;
    if (haystack === normalizedTerm) score += term.weight + 30;
    else if (haystack.includes(normalizedTerm)) score += term.weight;
  }

  return score;
}

export const normalizeSearchIntentText = normalizeCategoryText;

function addTerm(
  termMap: Map<string, SearchIntentTerm>,
  term: string,
  weight: number,
  reason: SearchIntentTerm["reason"],
) {
  const normalized = normalizeCategoryText(term);
  if (!normalized) return;
  const existing = termMap.get(normalized);
  if (!existing || existing.weight < weight) {
    termMap.set(normalized, { term: normalized, weight, reason });
  }
}
