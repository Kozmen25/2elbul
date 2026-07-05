import { describe, expect, it } from "vitest";
import { calculateProductIntelligence } from "@/lib/intelligence-engine";
import type { DuplicateBatchSummary } from "@/lib/product-matcher";
import { buildMarketIntelligence } from "./engine";
import { toConfidenceResult } from "./helpers";
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

const scope = {
  productId: "product-1",
  productName: "iPhone 13",
  slug: "iphone-13",
  url: "/product/iphone-13",
  category: "Telefon",
  brand: "Apple",
  city: "Istanbul",
};

function buildIntelligence(listings: MarketIntelligenceListing[]) {
  return calculateProductIntelligence({
    listings: listings.map((listing) => ({
      price: listing.price,
      createdAt: listing.createdAt,
    })),
    priceHistory: [
      { price: 50000, recordedAt: "2026-06-01T00:00:00.000Z" },
      { price: 47000, recordedAt: "2026-06-15T00:00:00.000Z" },
      { price: 44000, recordedAt: "2026-06-30T00:00:00.000Z" },
    ],
    demand: { searchCount: 30, recentSearchCount: 9 },
  });
}

const duplicateSummary: DuplicateBatchSummary = {
  threshold: 70,
  itemCount: 4,
  groupCount: 1,
  matchedGroupCount: 1,
  duplicatePairCount: 2,
  duplicateItemCount: 3,
  maxGroupSize: 3,
  topGroups: [
    {
      canonicalId: "1",
      canonicalTitle: "iPhone 13",
      duplicateCount: 2,
      maxScore: 96,
      sampleTitles: ["iPhone 13", "iPhone 13 128 GB"],
    },
  ],
};

describe("buildMarketIntelligence", () => {
  it("returns empty analysis for an empty dataset", () => {
    const result = buildMarketIntelligence({
      scope,
      listings: [],
      analyzedAt: "2026-07-05T00:00:00.000Z",
    });

    expect(result.sampleSize).toBe(0);
    expect(result.confidenceLevel).toBe("very-low");
    expect(result.marketSummary.summary).toContain("henüz yeterli ilan verisi");
    expect(result.sourcesUsed).toEqual([]);
    expect(result.structuredData.about.brand?.name).toBe("Apple");
  });

  it("keeps one listing low confidence but still produces a summary", () => {
    const listings = [makeListing({ id: "1", source: "EasyCep", price: 26000 })];
    const result = buildMarketIntelligence({
      scope,
      listings,
      intelligence: buildIntelligence(listings),
      analyzedAt: "2026-07-05T00:00:00.000Z",
    });

    expect(result.sampleSize).toBe(1);
    expect(result.confidenceLevel).toBe("low");
    expect(result.marketSummary.warnings).toContain("Tek kaynak baskın görünüyor.");
    expect(result.sourcesUsed).toEqual(["EasyCep"]);
  });

  it("builds a very-high confidence score when evidence is strong", () => {
    const listings = [
      makeListing({ id: "1", source: "EasyCep", price: 24000 }),
      makeListing({ id: "2", source: "Getmobil", price: 24500 }),
      makeListing({ id: "3", source: "Sahibinden", price: 25000 }),
    ];

    const result = buildMarketIntelligence({
      scope,
      listings,
      intelligence: buildIntelligence(listings),
      decisionInsight: {
        confidence: toConfidenceResult(92, ["Model same"]),
        smartPrice: {
          summary: "Strong price signal",
          details: ["detail"],
          warnings: [],
        },
      },
      analyzedAt: "2026-07-05T00:00:00.000Z",
    });

    expect(result.confidenceScore).toBe(100);
    expect(result.confidenceLevel).toBe("very-high");
    expect(result.confidenceReasons).toContain("Örneklem yeterli");
    expect(result.confidenceReasons).toContain("3 farklı kaynak doğruladı");
    expect(result.sourcesUsed).toEqual(["EasyCep", "Getmobil", "Sahibinden"]);
  });

  it("propagates duplicate density from duplicate summary input", () => {
    const listings = [
      makeListing({ id: "1", source: "EasyCep", price: 24000 }),
      makeListing({ id: "2", source: "EasyCep", price: 24200 }),
      makeListing({ id: "3", source: "Getmobil", price: 24500 }),
      makeListing({ id: "4", source: "Sahibinden", price: 24800 }),
    ];

    const result = buildMarketIntelligence({
      scope,
      listings,
      intelligence: buildIntelligence(listings),
      decisionInsight: {
        confidence: toConfidenceResult(90, ["Model same"]),
        smartPrice: {
          summary: "Strong price signal",
          details: ["detail"],
          warnings: [],
        },
      },
      duplicateSummary,
      analyzedAt: "2026-07-05T00:00:00.000Z",
    });

    expect(result.marketSummary.duplicateGroupCount).toBe(1);
    expect(result.marketSummary.duplicatePairCount).toBe(2);
    expect(result.marketSummary.duplicateDensity).toBe(0.75);
    expect(result.marketSummary.warnings).toContain("Duplicate yoğunluğu yüksek.");
    expect(result.confidenceScore).toBeLessThan(100);
  });

  it("uses product intelligence for the market opportunity output", () => {
    const listings = [
      makeListing({ id: "1", source: "EasyCep", price: 24000 }),
      makeListing({ id: "2", source: "Getmobil", price: 30000 }),
      makeListing({ id: "3", source: "Sahibinden", price: 31000 }),
    ];
    const intelligence = buildIntelligence(listings);
    const result = buildMarketIntelligence({
      scope,
      listings,
      intelligence,
      analyzedAt: "2026-07-05T00:00:00.000Z",
    });

    expect(result.opportunity.score).toBe(intelligence.opportunity.score);
    expect(result.opportunity.label).toBe(intelligence.opportunity.label);
    expect(result.opportunity.action).toBe(intelligence.recommendation.action);
  });

  it("builds structured data with the expected product metadata", () => {
    const listings = [
      makeListing({ id: "1", source: "EasyCep", price: 24000 }),
      makeListing({ id: "2", source: "Getmobil", price: 25000 }),
      makeListing({ id: "3", source: "Sahibinden", price: 26000 }),
    ];

    const result = buildMarketIntelligence({
      scope,
      listings,
      intelligence: buildIntelligence(listings),
      analyzedAt: "2026-07-05T00:00:00.000Z",
    });

    expect(result.structuredData["@type"]).toBe("Dataset");
    expect(result.structuredData.about.brand?.name).toBe("Apple");
    expect(result.structuredData.about.category).toBe("Telefon");
    expect(result.structuredData.additionalProperty.some((item) => item.name === "Confidence score")).toBe(true);
  });

  it("keeps the provided analysis timestamp", () => {
    const result = buildMarketIntelligence({
      scope,
      listings: [makeListing()],
      analyzedAt: "2026-07-04T10:00:00.000Z",
    });

    expect(result.analysisGeneratedAt).toBe("2026-07-04T10:00:00.000Z");
  });

  it("adds trend and demand highlights from product intelligence", () => {
    const listings = [
      makeListing({ id: "1", source: "EasyCep", price: 24000, createdAt: "2026-06-01T00:00:00.000Z" }),
      makeListing({ id: "2", source: "Getmobil", price: 24500, createdAt: "2026-06-02T00:00:00.000Z" }),
      makeListing({ id: "3", source: "Sahibinden", price: 25000, createdAt: "2026-06-03T00:00:00.000Z" }),
    ];
    const intelligence = buildIntelligence(listings);

    expect(intelligence.trend.direction).toBe("falling");

    const result = buildMarketIntelligence({
      scope,
      listings,
      intelligence,
      analyzedAt: "2026-07-05T00:00:00.000Z",
    });

    expect(result.marketSummary.highlights).toContain("Arama talebi yüksek");
    expect(result.marketSummary.highlights).toContain("Fiyat trendi düşüyor");
  });

  it("orders sources by their listing dominance", () => {
    const listings = [
      makeListing({ id: "1", source: "EasyCep", price: 24000 }),
      makeListing({ id: "2", source: "EasyCep", price: 24500 }),
      makeListing({ id: "3", source: "Getmobil", price: 25000 }),
    ];
    const result = buildMarketIntelligence({
      scope,
      listings,
      intelligence: buildIntelligence(listings),
      analyzedAt: "2026-07-05T00:00:00.000Z",
    });

    expect(result.sourcesUsed).toEqual(["EasyCep", "Getmobil"]);
    expect(result.marketSummary.sourceBreakdown[0]?.listingCount).toBe(2);
    expect(result.marketSummary.sourceBreakdown[0]?.averagePrice).toBe(24250);
  });

  it("surfaces decision insight confidence reasons in the aggregate score", () => {
    const listings = [
      makeListing({ id: "1", source: "EasyCep", price: 24000 }),
      makeListing({ id: "2", source: "Getmobil", price: 24500 }),
      makeListing({ id: "3", source: "Sahibinden", price: 25000 }),
    ];
    const result = buildMarketIntelligence({
      scope,
      listings,
      intelligence: buildIntelligence(listings),
      decisionInsight: {
        confidence: toConfidenceResult(88, ["Model same"]),
        smartPrice: {
          summary: "Detail summary",
          details: ["detail"],
          warnings: [],
        },
      },
      analyzedAt: "2026-07-05T00:00:00.000Z",
    });

    expect(result.confidenceReasons).toContain("Model same");
    expect(result.confidenceReasons).toContain("Örneklem yeterli");
  });
});
