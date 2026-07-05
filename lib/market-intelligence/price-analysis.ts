import { calculateMarketStats } from "@/lib/price-insights";
import type { MarketIntelligenceListing, MarketPriceAnalysis } from "./types";
import {
  getActiveListingCount,
  getValidPrices,
  roundDecimal,
} from "./helpers";

export function buildMarketPriceAnalysis(
  listings: MarketIntelligenceListing[],
): MarketPriceAnalysis {
  const prices = getValidPrices(listings);
  const stats = calculateMarketStats(prices);
  const listingCount = listings.length;
  const activeListingCount = getActiveListingCount(listings);

  if (!stats) {
    return {
      averagePrice: null,
      medianPrice: null,
      minPrice: null,
      maxPrice: null,
      priceRange: null,
      priceSpreadPercent: null,
      marketValue: null,
      listingCount,
      activeListingCount,
      sampleSize: prices.length,
    };
  }

  const priceRange = stats.highest - stats.lowest;

  return {
    averagePrice: stats.average,
    medianPrice: stats.median,
    minPrice: stats.lowest,
    maxPrice: stats.highest,
    priceRange,
    priceSpreadPercent:
      stats.average > 0 ? roundDecimal((priceRange / stats.average) * 100, 1) : null,
    marketValue: stats.marketValue,
    listingCount,
    activeListingCount,
    sampleSize: prices.length,
  };
}
