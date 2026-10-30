// Ranks candidate products for a listing title so the wizard can suggest the
// right product ("Kutulu iPhone 13 128 GB" → "iPhone 13"). Pure.

import { foldTurkish } from "@/lib/listing-submission/cities";

export type ProductCandidate = { id: string; name: string; category: string | null };

const MIN_TOKEN_LENGTH = 2;
const MAX_TOKENS = 6;

export function tokenizeTitle(title: string): string[] {
  const tokens = foldTurkish(title)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= MIN_TOKEN_LENGTH);
  return [...new Set(tokens)].slice(0, MAX_TOKENS);
}

/**
 * Score = share of the product name's words found in the title. A product named
 * "iPhone 13" scores 1 for the title "Kutulu iPhone 13 128 GB" and a product
 * named "iPhone 13 Pro" only 0.67 — so the most specific full match wins, and
 * longer names win ties.
 */
export function rankProducts(title: string, candidates: ProductCandidate[], limit = 8): ProductCandidate[] {
  const titleTokens = new Set(tokenizeTitle(title));
  if (titleTokens.size === 0) return [];

  return candidates
    .map((candidate) => {
      const nameTokens = tokenizeTitle(candidate.name);
      const matched = nameTokens.filter((token) => titleTokens.has(token)).length;
      return { candidate, matched, score: nameTokens.length ? matched / nameTokens.length : 0, length: nameTokens.length };
    })
    .filter((entry) => entry.matched > 0)
    .sort((a, b) => b.score - a.score || b.matched - a.matched || b.length - a.length || a.candidate.name.localeCompare(b.candidate.name, "tr"))
    .slice(0, limit)
    .map((entry) => entry.candidate);
}
