import { evaluatePriceAlert } from "@/lib/price-alerts/rules";

// Pure rules of the product follow check (/api/cron/check-product-follows).
// No I/O, so the daily job and the tests share one definition.

/** Mirrors the database trigger enforce_product_follow_limit(). */
export const MAX_FOLLOWED_PRODUCTS = 200;

/** A new listing must be at least this far below the market average to be called favourable. */
export const NEW_LISTING_MIN_BELOW_MARKET_PERCENT = 3;

export type FollowOutcome =
  | { kind: "price_drop"; previousPrice: number; dropPercent: number }
  | {
      kind: "new_listing";
      /** Price of the new listing. */
      price: number;
      /** How far below the market average it is, when the average is known. */
      belowMarketPercent: number | null;
      /** Set when the new listing also pushed the lowest price down by the drop threshold. */
      dropPercent: number | null;
    }
  | { kind: "unchanged" };

export type FollowEvaluation = {
  outcome: FollowOutcome;
  /** The price the next check measures against. */
  nextBaseline: number;
};

function belowMarket(price: number, marketAverage: number | null): number | null {
  if (marketAverage === null || !(marketAverage > 0)) return null;
  return Math.round(((marketAverage - price) / marketAverage) * 1000) / 10;
}

/**
 * Decides what the daily check does for one follow.
 *
 * `baseline` is the lowest price at the last check that mattered. Two things
 * are worth a notification:
 *  - the lowest price fell by at least PRICE_DROP_MIN_PERCENT since the
 *    baseline (a "new listing" notification when a listing added since the
 *    last check set the new low, otherwise a plain price drop);
 *  - a listing was added since the last check that is priced favourably, at
 *    least NEW_LISTING_MIN_BELOW_MARKET_PERCENT under the market average, even
 *    when it does not move the lowest price by the drop threshold.
 * A follow without a baseline (just created, or the product had no listings)
 * only records one. Accessories and spare parts never notify.
 *
 * Baseline handling: it moves up with the price, and down only when a drop is
 * reported. Small daily dips therefore add up until they cross the threshold,
 * instead of being forgotten one by one.
 */
export function evaluateProductFollow(input: {
  baseline: number | null;
  currentPrice: number;
  /** True when a listing created after the last check is the current lowest. */
  lowestIsNewListing: boolean;
  /** The cheapest item added since the last check, if any. */
  newListing?: { price: number } | null;
  /** Market average (outlier-trimmed) of the product's listings now. */
  marketAverage?: number | null;
  suppressDrop?: boolean;
}): FollowEvaluation {
  const { baseline, currentPrice, lowestIsNewListing, newListing = null, marketAverage = null, suppressDrop = false } = input;

  if (baseline === null) return { outcome: { kind: "unchanged" }, nextBaseline: currentPrice };

  // Target 0 can never be reached, so only the drop rule of price alerts applies.
  const result = evaluatePriceAlert({
    targetPrice: 0,
    currentPrice,
    previousPrice: baseline,
    suppressDrop,
  });

  if (result.kind === "price_drop") {
    const outcome: FollowOutcome = lowestIsNewListing
      ? {
          kind: "new_listing",
          price: currentPrice,
          belowMarketPercent: belowMarket(currentPrice, marketAverage),
          dropPercent: result.dropPercent,
        }
      : { kind: "price_drop", previousPrice: result.previousPrice, dropPercent: result.dropPercent };
    return { outcome, nextBaseline: currentPrice };
  }

  const nextBaseline = Math.max(baseline, currentPrice);

  if (!suppressDrop && newListing) {
    const below = belowMarket(newListing.price, marketAverage);
    if (below !== null && below >= NEW_LISTING_MIN_BELOW_MARKET_PERCENT) {
      return {
        outcome: { kind: "new_listing", price: newListing.price, belowMarketPercent: below, dropPercent: null },
        nextBaseline,
      };
    }
  }

  return { outcome: { kind: "unchanged" }, nextBaseline };
}

export function followNotificationTitle(kind: "price_drop" | "new_listing"): string {
  return kind === "new_listing" ? "Takip Ettiğin Üründe Yeni İlan" : "Takip Ettiğin Ürünün Fiyatı Düştü";
}
