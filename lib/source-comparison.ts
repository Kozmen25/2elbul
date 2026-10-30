// Per-platform comparison of one product: what each source offers, side by
// side. Built from EVERY listing of the product (duplicates included): a copy
// on Letgo is still a Letgo offer, even though the item is collapsed to one
// entry in the main listing.

export type SourceOfferInput = {
  id: string;
  source: string;
  price: number;
  url: string;
  city: string;
  condition: string;
  createdAt: string;
};

export type SourceComparisonRow = {
  source: string;
  listingCount: number;
  lowestPrice: number;
  averagePrice: number;
  /** The listing behind lowestPrice, for the "go to listing" link. */
  cheapest: { id: string; url: string; city: string; condition: string };
  /** Percent above the best source's lowest price; 0 for the best source(s). */
  aboveBestPercent: number;
  isBest: boolean;
};

/** Fewer sources than this and there is nothing to compare. */
export const MIN_COMPARABLE_SOURCES = 2;

/**
 * One row per source, cheapest first. Rows with a non-positive price are
 * ignored. Returns an empty list when fewer than MIN_COMPARABLE_SOURCES
 * sources offer the product.
 */
export function buildSourceComparison(offers: SourceOfferInput[]): SourceComparisonRow[] {
  const bySource = new Map<string, SourceOfferInput[]>();
  for (const offer of offers) {
    if (!(offer.price > 0)) continue;
    const list = bySource.get(offer.source) ?? [];
    list.push(offer);
    bySource.set(offer.source, list);
  }
  if (bySource.size < MIN_COMPARABLE_SOURCES) return [];

  const rows = [...bySource.entries()].map(([source, list]) => {
    const sorted = [...list].sort((a, b) => a.price - b.price || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    const cheapest = sorted[0];
    return {
      source,
      listingCount: list.length,
      lowestPrice: cheapest.price,
      averagePrice: Math.round(list.reduce((total, offer) => total + offer.price, 0) / list.length),
      cheapest: { id: cheapest.id, url: cheapest.url, city: cheapest.city, condition: cheapest.condition },
    };
  });
  rows.sort((a, b) => a.lowestPrice - b.lowestPrice || a.source.localeCompare(b.source, "tr"));

  const best = rows[0].lowestPrice;
  return rows.map((row) => ({
    ...row,
    aboveBestPercent: Math.round(((row.lowestPrice - best) / best) * 1000) / 10,
    // Platforms tied at the lowest price are all "best".
    isBest: row.lowestPrice === best,
  }));
}
