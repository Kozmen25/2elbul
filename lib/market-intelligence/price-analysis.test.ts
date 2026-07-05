import { describe, expect, it } from "vitest";
import { buildMarketPriceAnalysis } from "./price-analysis";
import type { MarketIntelligenceListing } from "./types";

const makeListing = (
  overrides: Partial<MarketIntelligenceListing> = {},
): MarketIntelligenceListing => ({
  id: "1",
  title: "iPhone 13",
  price: 25000,
  source: "EasyCep",
  city: "Istanbul",
  condition: "İkinci El",
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
  ...overrides,
});

describe("buildMarketPriceAnalysis", () => {
  it("returns empty statistics for an empty dataset", () => {
    expect(buildMarketPriceAnalysis([])).toEqual({
      averagePrice: null,
      medianPrice: null,
      minPrice: null,
      maxPrice: null,
      priceRange: null,
      priceSpreadPercent: null,
      marketValue: null,
      listingCount: 0,
      activeListingCount: 0,
      sampleSize: 0,
    });
  });

  it("calculates the same values for a single listing", () => {
    expect(
      buildMarketPriceAnalysis([makeListing({ price: 32000 })]),
    ).toMatchObject({
      averagePrice: 32000,
      medianPrice: 32000,
      minPrice: 32000,
      maxPrice: 32000,
      priceRange: 0,
      priceSpreadPercent: 0,
      marketValue: 32000,
      listingCount: 1,
      activeListingCount: 1,
      sampleSize: 1,
    });
  });

  it("excludes invalid prices from sample size but keeps the total listing count", () => {
    const result = buildMarketPriceAnalysis([
      makeListing({ id: "1", price: 20000 }),
      makeListing({ id: "2", price: "not-a-number" as never }),
      makeListing({ id: "3", price: 24000 }),
    ]);

    expect(result.listingCount).toBe(3);
    expect(result.sampleSize).toBe(2);
    expect(result.averagePrice).toBe(22000);
  });

  it("calculates spread for multiple listings", () => {
    const result = buildMarketPriceAnalysis([
      makeListing({ id: "1", price: 20000 }),
      makeListing({ id: "2", price: 25000 }),
      makeListing({ id: "3", price: 30000 }),
    ]);

    expect(result.priceRange).toBe(10000);
    expect(result.priceSpreadPercent).toBe(40);
    expect(result.marketValue).toBe(25000);
  });

  it("counts only active listings when statuses are mixed", () => {
    const result = buildMarketPriceAnalysis([
      makeListing({ id: "1", status: "published" }),
      makeListing({ id: "2", status: "inactive" }),
      makeListing({ id: "3", status: "active" }),
    ]);

    expect(result.activeListingCount).toBe(2);
  });

  it("keeps market value stable in the presence of an extreme outlier", () => {
    const result = buildMarketPriceAnalysis([
      makeListing({ id: "1", price: 20000 }),
      makeListing({ id: "2", price: 20500 }),
      makeListing({ id: "3", price: 21000 }),
      makeListing({ id: "4", price: 90000 }),
    ]);

    expect(result.marketValue).toBeGreaterThan(20000);
    expect(result.marketValue).toBeLessThan(40000);
  });
});
