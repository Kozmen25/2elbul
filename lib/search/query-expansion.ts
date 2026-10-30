import {
  expandQueryByTaxonomy,
  getExpandedSearchTerms,
  type ExpandedTaxonomyQuery,
} from "@/lib/category-taxonomy";
import { getSynonymRegistry } from "@/lib/search/synonym-registry";
import {
  limitSearchTerms,
  MAX_SEARCH_EXPANSION_TERMS,
  MAX_SUGGESTION_EXPANSION_TERMS,
} from "@/lib/search/term-budget";

/**
 * Search Query Expansion Pipeline (facade)
 *
 * Composition (implemented in `expandQueryByTaxonomy` + term budget):
 *   1. Original query
 *   2. SynonymRegistry — product-type equivalence (laptop ↔ notebook)
 *   3. Taxonomy expansion — category / alias / keyword deep terms
 *   4. Term budget — keep retrieval fast under PostgREST OR + ilike
 *
 * Prefer importing `getExpandedSearchTerms` from here or `category-taxonomy`
 * (same capped result). Use `expandSearchQuery` when metadata is needed.
 */

export {
  getExpandedSearchTerms,
  limitSearchTerms,
  MAX_SEARCH_EXPANSION_TERMS,
  MAX_SUGGESTION_EXPANSION_TERMS,
};

export type ExpandedSearchQuery = ExpandedTaxonomyQuery & {
  synonymTerms: string[];
  phraseVariants: string[];
  matchedSynonymGroupIds: string[];
  truncated: boolean;
};

/**
 * Full expansion with synonym metadata for debugging / AI / analytics.
 */
export function expandSearchQuery(query: string): ExpandedSearchQuery {
  const trimmed = query.trim().replace(/\s+/g, " ");
  const taxonomy = expandQueryByTaxonomy(trimmed);
  const synonym = getSynonymRegistry().expandQuery(trimmed);
  const uncapped = taxonomy.terms;
  const limited = limitSearchTerms(uncapped, trimmed, MAX_SEARCH_EXPANSION_TERMS);

  return {
    ...taxonomy,
    terms: limited,
    synonymTerms: synonym.terms,
    phraseVariants: synonym.phraseVariants,
    matchedSynonymGroupIds: synonym.matchedGroupIds,
    truncated: uncapped.length > limited.length,
  };
}

/**
 * Smaller term set for suggestions / lightweight endpoints.
 */
export function getSuggestionSearchTerms(query: string): string[] {
  return limitSearchTerms(
    expandQueryByTaxonomy(query).terms,
    query,
    MAX_SUGGESTION_EXPANSION_TERMS,
  );
}
