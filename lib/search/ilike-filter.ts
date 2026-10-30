// Shared PostgREST `.or(column.ilike.%term%,...)` filter builder.
//
// Previously this exact string-building logic (`terms.map(t => "col.ilike.%"
// + t + "%").join(",")`) was copy-pasted in app/search/page.tsx,
// app/api/search/suggestions/route.ts and app/api/mobile/search/route.ts,
// with no escaping: a search term containing a comma, parenthesis or double
// quote (all of which are syntax characters in PostgREST's `.or()` filter
// grammar) could silently break the whole filter or change its meaning, and
// a term containing a literal `%`/`_` would act as an unintended SQL LIKE
// wildcard. Every term is now double-quoted and escaped before being
// interpolated, and the three call sites share this one implementation.

function escapeLikeWildcards(term: string): string {
  return term
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

function escapeIlikeValue(term: string): string {
  return escapeLikeWildcards(term).replace(/"/g, '\\"');
}

/**
 * `%term%` pattern for a single `.ilike(column, pattern)` call. Only LIKE
 * wildcards need escaping here — `.ilike()` sends the value as one URL
 * parameter, so `.or()` syntax characters are harmless.
 */
export function containsPattern(term: string): string {
  return `%${escapeLikeWildcards(term)}%`;
}

/**
 * Builds a single `column.ilike."%term%"` clause for one term, safe to use
 * on its own or joined with others into a PostgREST `.or()` filter string.
 */
export function ilikeClause(column: string, term: string): string {
  return `${column}.ilike."%${escapeIlikeValue(term)}%"`;
}

/**
 * Builds a full `.or()`-ready filter string matching `column ILIKE %term%`
 * for any of the given terms.
 */
export function buildIlikeOrFilter(column: string, terms: string[]): string {
  return terms.map((term) => ilikeClause(column, term)).join(",");
}
