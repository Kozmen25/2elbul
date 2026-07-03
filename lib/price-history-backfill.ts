import type {
  PriceHistoryInput,
  PriceHistoryWriteResult,
} from "./price-history";
import { normalizePriceHistoryInput } from "./price-history";

export type PriceHistoryBackfillListing = {
  id?: number | string | null;
  product_id?: number | string | null;
  price?: number | string | null;
  source?: string | null;
};

export type PriceHistoryBackfillResult = {
  scanned: number;
  inserted: number;
  skipped: number;
  errors: number;
  errorMessages: string[];
};

export type PriceHistoryBackfillWriter = (
  input: PriceHistoryInput,
) => Promise<PriceHistoryWriteResult>;

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 100;

export function normalizeBackfillLimit(value: unknown) {
  const limit = Number(value ?? DEFAULT_LIMIT);
  if (!Number.isFinite(limit) || limit <= 0) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(limit)));
}

export async function backfillPriceHistoryFromListings(
  listings: PriceHistoryBackfillListing[],
  writeHistory: PriceHistoryBackfillWriter,
): Promise<PriceHistoryBackfillResult> {
  const result: PriceHistoryBackfillResult = {
    scanned: 0,
    inserted: 0,
    skipped: 0,
    errors: 0,
    errorMessages: [],
  };

  for (const listing of listings) {
    result.scanned += 1;
    const input: PriceHistoryInput = {
      productId: listing.product_id,
      listingId: listing.id,
      source: listing.source,
      price: listing.price,
    };
    const normalized = normalizePriceHistoryInput(input);

    if (!normalized) {
      result.skipped += 1;
      continue;
    }

    const write = await writeHistory(input);

    if (write.inserted) {
      result.inserted += 1;
      continue;
    }

    if (write.skipped) {
      result.skipped += 1;
      if (!write.ok && write.error) {
        result.errors += 1;
        result.errorMessages.push(write.error);
      }
      continue;
    }

    result.errors += 1;
    result.errorMessages.push(write.error ?? "Price history kaydi yazilamadi.");
  }

  return {
    ...result,
    errorMessages: [...new Set(result.errorMessages)].slice(0, 10),
  };
}
