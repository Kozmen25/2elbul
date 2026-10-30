import { normalizeCategoryText } from "@/lib/normalization";

/** Soft cap for PostgREST `.or(ilike...)` filters — keeps latency healthy. */
export const MAX_SEARCH_EXPANSION_TERMS = 24;

/** Tighter budget for autocomplete suggestions. */
export const MAX_SUGGESTION_EXPANSION_TERMS = 8;

/**
 * Keep original query first, then shorter high-signal terms, then the rest.
 */
export function limitSearchTerms(
  terms: string[],
  originalQuery: string,
  maxTerms: number,
): string[] {
  if (terms.length <= maxTerms) {
    return [...new Set(terms.map((t) => normalizeCategoryText(t)).filter(Boolean))];
  }

  const original = normalizeCategoryText(originalQuery);
  const unique = [
    ...new Set(terms.map((t) => normalizeCategoryText(t)).filter(Boolean)),
  ];

  const prioritized: string[] = [];
  const rest: string[] = [];

  for (const term of unique) {
    if (term === original) {
      prioritized.unshift(term);
    } else {
      rest.push(term);
    }
  }

  // Prefer shorter terms (product-type synonyms) over long deep-taxonomy brands.
  rest.sort((a, b) => a.length - b.length || a.localeCompare(b, "tr"));

  return [...prioritized, ...rest].slice(0, Math.max(1, maxTerms));
}
