import { describe, expect, it } from "vitest";
import type { DuplicateBatchSummary } from "@/lib/product-matcher";
import type { ProductIntelligence } from "@/lib/intelligence-engine";
import type { MarketIntelligenceListing } from "@/lib/market-intelligence";
import {
  buildMarketIntelligenceForProductDetail,
  resolveProductDetailDuplicateSummary,
  type ProductDecisionInsight,
  type ProductRecord,
} from "./product-detail";

const analyzedAt = "2026-07-05T10:00:00.000Z";

const product: ProductRecord = {
  id: "product-1",
  name: "iPhone 13",
  slug: "iphone-13",
  category: "Telefon",
};

const intelligence: ProductIntelligence = {
  marketValue: {
    averagePrice: 25000,
    medianPrice: 25000,
    minPrice: 24500,
    maxPrice: 25500,
    priceRange: 1000,
    listingCount: 3,
  },
  trend: {
    direction: "falling",
    strengthLabel: "Hafif dusus",
    changePercent: -4,
    periodLabel: "30 gun",
    explanation: "Trend geriliyor.",
  },
  demand: {
    searchCount: 20,
    recentSearchCount: 7,
    demandLevel: "high",
    explanation: "Talep yuksek.",
  },
  opportunity: {
    score: 88,
    label: "Guculu firsat",
    explanation: "Fiyat bandi avantajli gorunuyor.",
  },
  recommendation: {
    action: "buy_now",
    title: "Satinal",
    description: "Karar destegi guclu.",
  },
  decisionSupport: {
    buyScore: 84,
    waitScore: 16,
    volatilityScore: 20,
    volatilityLevel: "low",
    liquidityScore: 82,
    liquidityLevel: "high",
    label: "Simdi Al",
    explanation: "Karar destegi yeterli.",
  },
} as unknown as ProductIntelligence;

const decisionInsight: ProductDecisionInsight = {
  confidence: {
    score: 90,
    level: "Yuksek guven",
    description: "Analiz tutarli.",
    reasons: ["Model same"],
    warnings: [],
    className: "border-green-200 bg-green-50 text-green-700",
  },
  smartPrice: {
    summary: "Fiyat bandi dengeli.",
    details: ["detail"],
    warnings: [],
  },
} as unknown as ProductDecisionInsight;

const emptyDecisionInsight: ProductDecisionInsight = {
  confidence: {
    score: null,
    level: "Veri yetersiz",
    description: "Yeterli veri yok.",
    reasons: [],
    warnings: [],
    className: "border-slate-200 bg-slate-50 text-slate-700",
  },
  smartPrice: {
    summary: "Yeterli veri yok.",
    details: [],
    warnings: [],
  },
} as unknown as ProductDecisionInsight;

const duplicateSummary: DuplicateBatchSummary = {
  threshold: 70,
  itemCount: 3,
  groupCount: 1,
  matchedGroupCount: 1,
  duplicatePairCount: 1,
  duplicateItemCount: 2,
  maxGroupSize: 2,
  topGroups: [
    {
      canonicalId: "listing-1",
      canonicalTitle: "iPhone 13 128 GB",
      duplicateCount: 1,
      maxScore: 96,
      sampleTitles: ["iPhone 13 128 GB", "iPhone 13 128 GB"],
    },
  ],
};

function makeListing(
  overrides: Partial<MarketIntelligenceListing> = {},
): MarketIntelligenceListing {
  return {
    id: "listing-1",
    title: "iPhone 13 128 GB",
    price: 25000,
    source: "EasyCep",
    city: "Istanbul",
    condition: "used",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-02T00:00:00.000Z",
    productId: product.id,
    productName: product.name,
    status: "published",
    ...overrides,
  } as MarketIntelligenceListing;
}

function getProperty(
  result: ReturnType<typeof buildMarketIntelligenceForProductDetail>,
  name: string,
) {
  return result.structuredData.additionalProperty.find((item) => item.name === name)
    ?.value;
}

describe("resolveProductDetailDuplicateSummary", () => {
  it("returns the provided duplicate summary as-is", () => {
    const listings = [makeListing(), makeListing({ id: "listing-2" })];

    const result = resolveProductDetailDuplicateSummary(listings, duplicateSummary);

    expect(result).toBe(duplicateSummary);
  });

  it("builds a fallback duplicate summary from duplicate listings", () => {
    const listings = [
      makeListing(),
      makeListing({ id: "listing-2", source: "Getmobil" }),
      makeListing({
        id: "listing-3",
        title: "Samsung Galaxy S22",
        source: "Getmobil",
        price: 28000,
      }),
    ];

    const result = resolveProductDetailDuplicateSummary(listings);

    expect(result.groupCount).toBe(1);
    expect(result.duplicatePairCount).toBe(1);
    expect(result.duplicateItemCount).toBe(2);
  });

  it("returns an empty summary when the listing set is empty", () => {
    const result = resolveProductDetailDuplicateSummary([]);

    expect(result.itemCount).toBe(0);
    expect(result.groupCount).toBe(0);
    expect(result.duplicatePairCount).toBe(0);
    expect(result.topGroups).toEqual([]);
  });
});

describe("buildMarketIntelligenceForProductDetail", () => {
  const duplicatedListings = [
    makeListing({
      id: "listing-1",
      confidenceScore: 92,
      source: "EasyCep",
      price: 24500,
    }),
    makeListing({
      id: "listing-2",
      title: "iPhone 13 128 GB",
      confidenceScore: 88,
      source: "EasyCep",
      price: 25000,
    }),
    makeListing({
      id: "listing-3",
      title: "iPhone 13 128 GB",
      source: "Getmobil",
      price: 25500,
    }),
  ];

  const emptySummary = resolveProductDetailDuplicateSummary([]);

  it("keeps the provided analysis timestamp", () => {
    const result = buildMarketIntelligenceForProductDetail({
      product,
      productBrand: "Apple",
      listings: duplicatedListings,
      intelligence,
      decisionInsight,
      duplicateSummary,
      analyzedAt,
    });

    expect(result.analysisGeneratedAt).toBe(analyzedAt);
  });

  it("propagates duplicate summary counts into market summary", () => {
    const result = buildMarketIntelligenceForProductDetail({
      product,
      productBrand: "Apple",
      listings: duplicatedListings,
      intelligence,
      decisionInsight,
      duplicateSummary,
      analyzedAt,
    });

    expect(result.marketSummary.duplicateGroupCount).toBe(1);
    expect(result.marketSummary.duplicatePairCount).toBe(1);
    expect(result.marketSummary.duplicateItemCount).toBe(2);
    expect(result.marketSummary.duplicateDensity).toBe(0.667);
  });

  it("keeps confidence metadata from listings in the aggregate", () => {
    const result = buildMarketIntelligenceForProductDetail({
      product,
      productBrand: "Apple",
      listings: duplicatedListings,
      intelligence,
      decisionInsight,
      duplicateSummary,
      analyzedAt,
    });

    expect(result.marketSummary.confidenceAverage).toBe(90);
  });

  it("derives sourcesUsed from the actual listing sources", () => {
    const result = buildMarketIntelligenceForProductDetail({
      product,
      productBrand: "Apple",
      listings: duplicatedListings,
      intelligence,
      decisionInsight,
      duplicateSummary,
      analyzedAt,
    });

    expect(result.sourcesUsed).toEqual(["EasyCep", "Getmobil"]);
  });

  it("returns a stable confidence score for the provided signal mix", () => {
    const result = buildMarketIntelligenceForProductDetail({
      product,
      productBrand: "Apple",
      listings: duplicatedListings,
      intelligence,
      decisionInsight,
      duplicateSummary,
      analyzedAt,
    });

    expect(result.confidenceScore).toBe(85);
    expect(result.confidenceLevel).toBe("high");
    expect(result.confidenceReasons).toContain("Model same");
  });

  it("keeps the product brand in JSON-LD metadata", () => {
    const result = buildMarketIntelligenceForProductDetail({
      product,
      productBrand: "Apple",
      listings: duplicatedListings,
      intelligence,
      decisionInsight,
      duplicateSummary,
      analyzedAt,
    });

    expect(result.structuredData.about.brand?.name).toBe("Apple");
    expect(result.structuredData.about.category).toBe("Telefon");
  });

  it("exposes the analysis timestamp in JSON-LD", () => {
    const result = buildMarketIntelligenceForProductDetail({
      product,
      productBrand: "Apple",
      listings: duplicatedListings,
      intelligence,
      decisionInsight,
      duplicateSummary,
      analyzedAt,
    });

    expect(getProperty(result, "Analysis generated at")).toBe(analyzedAt);
  });

  it("exposes the sample size in JSON-LD", () => {
    const result = buildMarketIntelligenceForProductDetail({
      product,
      productBrand: "Apple",
      listings: duplicatedListings,
      intelligence,
      decisionInsight,
      duplicateSummary,
      analyzedAt,
    });

    expect(getProperty(result, "Sample size")).toBe(3);
  });

  it("exposes the confidence level in JSON-LD", () => {
    const result = buildMarketIntelligenceForProductDetail({
      product,
      productBrand: "Apple",
      listings: duplicatedListings,
      intelligence,
      decisionInsight,
      duplicateSummary,
      analyzedAt,
    });

    expect(getProperty(result, "Confidence level")).toBe("high");
  });

  it("exposes the source list in JSON-LD", () => {
    const result = buildMarketIntelligenceForProductDetail({
      product,
      productBrand: "Apple",
      listings: duplicatedListings,
      intelligence,
      decisionInsight,
      duplicateSummary,
      analyzedAt,
    });

    expect(getProperty(result, "Sources used")).toBe("EasyCep, Getmobil");
  });

  it("preserves product intelligence in the opportunity block", () => {
    const result = buildMarketIntelligenceForProductDetail({
      product,
      productBrand: "Apple",
      listings: duplicatedListings,
      intelligence,
      decisionInsight,
      duplicateSummary,
      analyzedAt,
    });

    expect(result.opportunity.score).toBe(88);
    expect(result.opportunity.label).toBe("Guculu firsat");
  });

  it("keeps the market summary highlight list populated", () => {
    const result = buildMarketIntelligenceForProductDetail({
      product,
      productBrand: "Apple",
      listings: duplicatedListings,
      intelligence,
      decisionInsight,
      duplicateSummary,
      analyzedAt,
    });

    expect(result.marketSummary.highlights.length).toBeGreaterThan(0);
  });

  it("is safe for an empty listing dataset", () => {
    const result = buildMarketIntelligenceForProductDetail({
      product,
      productBrand: "Apple",
      listings: [],
      intelligence: intelligence as ProductIntelligence,
      decisionInsight: emptyDecisionInsight,
      duplicateSummary: emptySummary,
      analyzedAt,
    });

    expect(result.sampleSize).toBe(0);
    expect(result.confidenceLevel).toBe("very-low");
    expect(result.sourcesUsed).toEqual([]);
  });

  it("keeps the duplicate summary fallback compatible with real listings", () => {
    const fallback = resolveProductDetailDuplicateSummary(duplicatedListings);
    const result = buildMarketIntelligenceForProductDetail({
      product,
      productBrand: "Apple",
      listings: duplicatedListings,
      intelligence,
      decisionInsight,
      duplicateSummary: fallback,
      analyzedAt,
    });

    expect(result.marketSummary.duplicateGroupCount).toBe(fallback.groupCount);
    expect(result.marketSummary.duplicatePairCount).toBe(fallback.duplicatePairCount);
  });
});
