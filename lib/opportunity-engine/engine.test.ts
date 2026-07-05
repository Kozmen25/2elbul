import { describe, expect, it } from "vitest";
import type { ProductIntelligence } from "@/lib/intelligence-engine";
import type { MarketIntelligence } from "@/lib/market-intelligence";
import type { DuplicateBatchSummary } from "@/lib/product-matcher";
import { buildOpportunityAnalysis } from "./engine";
import { buildOpportunityJsonLdProperties, OPPORTUNITY_SCORE_VERSION } from "./helpers";
import {
  scoreOpportunityConfidence,
  scoreOpportunityDecisionEdge,
  scoreOpportunityDuplicateDensity,
  scoreOpportunityFreshness,
  scoreOpportunityIntelligenceOpportunity,
  scoreOpportunityPriceAdvantage,
  scoreOpportunityPriceSpread,
  scoreOpportunitySampleSize,
  scoreOpportunitySourceCount,
  calculateOpportunityScore,
  toOpportunityLevel,
  toRiskLevel,
} from "./scoring";
import { buildOpportunityReasons, buildPositiveSignals, buildWarningSignals } from "./reasons";
import { calculateOpportunityRiskScore } from "./risk";

const ANALYZED_AT = "2026-07-05T12:00:00.000Z";
const LATEST_LISTING_AT = "2026-07-05T08:30:00.000Z";

type ProductIntelligenceOverrides = {
  marketValue?: Partial<ProductIntelligence["marketValue"]>;
  trend?: Partial<ProductIntelligence["trend"]>;
  demand?: Partial<ProductIntelligence["demand"]>;
  opportunity?: Partial<ProductIntelligence["opportunity"]>;
  recommendation?: Partial<ProductIntelligence["recommendation"]>;
  decisionSupport?: Partial<ProductIntelligence["decisionSupport"]>;
};

type MarketIntelligenceOverrides = {
  analysisGeneratedAt?: string | Date | null;
  sampleSize?: number;
  confidenceScore?: number;
  confidenceLevel?: MarketIntelligence["confidenceLevel"];
  confidenceReasons?: string[];
  sourcesUsed?: string[];
  priceAnalysis?: Partial<MarketIntelligence["priceAnalysis"]>;
  marketSummary?: Partial<MarketIntelligence["marketSummary"]> & {
    sourceBreakdown?: MarketIntelligence["marketSummary"]["sourceBreakdown"];
  };
  opportunity?: Partial<MarketIntelligence["opportunity"]>;
  structuredData?: Partial<MarketIntelligence["structuredData"]> & {
    about?: Partial<MarketIntelligence["structuredData"]["about"]>;
  };
};

const baseProductIntelligence: ProductIntelligence = {
  marketValue: {
    averagePrice: 25000,
    medianPrice: 24500,
    minPrice: 23000,
    maxPrice: 27000,
    priceRange: 4000,
    listingCount: 12,
  },
  trend: {
    direction: "stable",
    strengthLabel: "Stabil",
    changePercent: 0,
    periodLabel: "30 gun",
    explanation: "Trend stabil.",
  },
  demand: {
    searchCount: 12,
    recentSearchCount: 4,
    demandLevel: "medium",
    explanation: "Talep orta.",
  },
  opportunity: {
    score: 78,
    label: "Normal piyasa",
    explanation: "Fiyat avantaji var.",
  },
  recommendation: {
    action: "watch",
    title: "Takip et",
    description: "Izlemek mantikli.",
  },
  decisionSupport: {
    buyScore: 72,
    waitScore: 55,
    volatilityScore: 25,
    volatilityLevel: "low",
    liquidityScore: 66,
    liquidityLevel: "medium",
    label: "Takip Et",
    explanation: "Karar destek.",
  },
};

const baseMarketIntelligence: MarketIntelligence = {
  scope: {
    productId: "product-1",
    productName: "iPhone 13",
    slug: "iphone-13",
    url: "/product/iphone-13",
    category: "Telefon",
    brand: "Apple",
    city: "Istanbul",
  },
  analysisGeneratedAt: ANALYZED_AT,
  sampleSize: 12,
  confidenceScore: 88,
  confidenceLevel: "high",
  confidenceReasons: ["Model ayni", "Orneklem yeterli"],
  sourcesUsed: ["EasyCep", "Getmobil", "Sahibinden"],
  priceAnalysis: {
    averagePrice: 25000,
    medianPrice: 24500,
    minPrice: 23000,
    maxPrice: 27000,
    priceRange: 4000,
    priceSpreadPercent: 16,
    marketValue: 25000,
    listingCount: 12,
    activeListingCount: 11,
    sampleSize: 12,
  },
  marketSummary: {
    summary: "summary",
    highlights: ["Talep orta"],
    warnings: ["Tek kaynak baskin gorunuyor"],
    sourceBreakdown: [
      {
        source: "EasyCep",
        listingCount: 5,
        share: 0.417,
        averagePrice: 24800,
        lowestPrice: 24000,
        highestPrice: 25500,
      },
      {
        source: "Getmobil",
        listingCount: 4,
        share: 0.333,
        averagePrice: 25200,
        lowestPrice: 24500,
        highestPrice: 26000,
      },
      {
        source: "Sahibinden",
        listingCount: 3,
        share: 0.25,
        averagePrice: 25700,
        lowestPrice: 25000,
        highestPrice: 26500,
      },
    ],
    totalListingCount: 12,
    activeListingCount: 11,
    sourceCount: 3,
    duplicateGroupCount: 1,
    duplicatePairCount: 1,
    duplicateItemCount: 2,
    duplicateDensity: 0.167,
    confidenceAverage: 88,
  },
  opportunity: {
    score: 78,
    label: "Normal piyasa",
    explanation: "Fiyat avantaji var.",
    action: "watch",
    discountPercent: 10,
  },
  structuredData: {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "iPhone 13 market intelligence",
    description: "summary",
    url: "/product/iphone-13",
    about: {
      "@type": "Product",
      name: "iPhone 13",
      category: "Telefon",
      brand: {
        "@type": "Brand",
        name: "Apple",
      },
    },
    additionalProperty: [],
  },
};

const baseDuplicateSummary: DuplicateBatchSummary = {
  threshold: 70,
  itemCount: 12,
  groupCount: 1,
  matchedGroupCount: 1,
  duplicatePairCount: 1,
  duplicateItemCount: 2,
  maxGroupSize: 3,
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

function makeScenario(overrides: {
  intelligence?: ProductIntelligenceOverrides;
  marketIntelligence?: MarketIntelligenceOverrides;
  duplicateSummary?: Partial<DuplicateBatchSummary>;
  analyzedAt?: string | Date | null;
  latestListingAt?: string | Date | null;
} = {}) {
  const intelligence = makeProductIntelligence(overrides.intelligence);
  const marketIntelligence = makeMarketIntelligence(overrides.marketIntelligence);
  const duplicateSummary = makeDuplicateSummary(overrides.duplicateSummary);
  const analyzedAt = overrides.analyzedAt === undefined ? ANALYZED_AT : overrides.analyzedAt;
  const latestListingAt =
    overrides.latestListingAt === undefined ? LATEST_LISTING_AT : overrides.latestListingAt;

  return {
    intelligence,
    marketIntelligence,
    duplicateSummary,
    result: buildOpportunityAnalysis({
      marketIntelligence,
      intelligence,
      duplicateSummary,
      analyzedAt,
      latestListingAt,
    }),
  };
}

function makeProductIntelligence(
  overrides: ProductIntelligenceOverrides = {},
): ProductIntelligence {
  const intelligence = structuredClone(baseProductIntelligence);
  if (overrides.marketValue) {
    Object.assign(intelligence.marketValue, overrides.marketValue);
  }

  if (overrides.trend) {
    Object.assign(intelligence.trend, overrides.trend);
  }

  if (overrides.demand) {
    Object.assign(intelligence.demand, overrides.demand);
  }

  if (overrides.opportunity) {
    Object.assign(intelligence.opportunity, overrides.opportunity);
  }

  if (overrides.recommendation) {
    Object.assign(intelligence.recommendation, overrides.recommendation);
  }

  if (overrides.decisionSupport) {
    Object.assign(intelligence.decisionSupport, overrides.decisionSupport);
  }

  return intelligence;
}

function makeMarketIntelligence(
  overrides: MarketIntelligenceOverrides = {},
): MarketIntelligence {
  const marketIntelligence = structuredClone(baseMarketIntelligence);

  if (overrides.analysisGeneratedAt !== undefined) {
    marketIntelligence.analysisGeneratedAt = overrides.analysisGeneratedAt
      ? new Date(overrides.analysisGeneratedAt).toISOString()
      : new Date().toISOString();
  }

  if (overrides.sampleSize !== undefined) {
    marketIntelligence.sampleSize = overrides.sampleSize;
  }

  if (overrides.confidenceScore !== undefined) {
    marketIntelligence.confidenceScore = overrides.confidenceScore;
  }

  if (overrides.confidenceLevel !== undefined) {
    marketIntelligence.confidenceLevel = overrides.confidenceLevel;
  }

  if (overrides.confidenceReasons) {
    marketIntelligence.confidenceReasons = overrides.confidenceReasons;
  }

  if (overrides.sourcesUsed) {
    marketIntelligence.sourcesUsed = overrides.sourcesUsed;
  }

  if (overrides.priceAnalysis) {
    Object.assign(marketIntelligence.priceAnalysis, overrides.priceAnalysis);
  }

  if (overrides.marketSummary) {
    const { sourceBreakdown, ...rest } = overrides.marketSummary;
    Object.assign(marketIntelligence.marketSummary, rest);
    if (sourceBreakdown) {
      marketIntelligence.marketSummary.sourceBreakdown = sourceBreakdown;
    }
  }

  if (overrides.structuredData) {
    const { about, additionalProperty, ...rest } = overrides.structuredData;
    Object.assign(marketIntelligence.structuredData, rest);
    if (about) {
      Object.assign(marketIntelligence.structuredData.about, about);
      if (about.brand) {
        marketIntelligence.structuredData.about.brand = about.brand;
      }
    }
    if (additionalProperty) {
      marketIntelligence.structuredData.additionalProperty = additionalProperty;
    }
  }

  return marketIntelligence;
}

function makeDuplicateSummary(
  overrides: Partial<DuplicateBatchSummary> = {},
): DuplicateBatchSummary {
  const summary = structuredClone(baseDuplicateSummary);
  Object.assign(summary, overrides);
  return summary;
}

describe("scoreOpportunityPriceAdvantage", () => {
  it.each([
    [null, null],
    [30, 98],
    [20, 90],
    [15, 90],
    [10, 82],
    [5, 70],
    [0, 58],
    [-5, 46],
    [-11, 18],
  ])("maps %p to %p", (value, expected) => {
    expect(scoreOpportunityPriceAdvantage(value as number | null)).toBe(expected);
  });
});

describe("scoreOpportunityConfidence", () => {
  it.each([
    [null, null],
    [95, 98],
    [85, 90],
    [70, 78],
    [50, 62],
    [1, 42],
    [0, 24],
  ])("maps %p to %p", (value, expected) => {
    expect(scoreOpportunityConfidence(value as number | null)).toBe(expected);
  });
});

describe("scoreOpportunitySampleSize", () => {
  it.each([
    [0, 0],
    [1, 16],
    [2, 30],
    [3, 46],
    [4, 58],
    [5, 70],
    [10, 84],
    [20, 94],
    [50, 98],
  ])("maps %p to %p", (value, expected) => {
    expect(scoreOpportunitySampleSize(value as number)).toBe(expected);
  });
});

describe("scoreOpportunitySourceCount", () => {
  it.each([
    [0, 0],
    [1, 18],
    [2, 54],
    [3, 78],
    [4, 90],
    [5, 96],
  ])("maps %p to %p", (value, expected) => {
    expect(scoreOpportunitySourceCount(value as number)).toBe(expected);
  });
});

describe("scoreOpportunityDuplicateDensity", () => {
  it.each([
    [0.01, 96],
    [0.03, 92],
    [0.08, 84],
    [0.15, 66],
    [0.3, 44],
    [0.4, 18],
  ])("maps %p to %p", (value, expected) => {
    expect(scoreOpportunityDuplicateDensity(value as number)).toBe(expected);
  });
});

describe("scoreOpportunityPriceSpread", () => {
  it.each([
    [null, null],
    [5, 92],
    [12, 84],
    [20, 70],
    [30, 52],
    [45, 34],
    [60, 18],
  ])("maps %p to %p", (value, expected) => {
    expect(scoreOpportunityPriceSpread(value as number | null)).toBe(expected);
  });
});

describe("scoreOpportunityFreshness", () => {
  it.each([
    ["fresh", 94],
    ["recent", 78],
    ["stale", 42],
    ["unknown", 50],
  ])("maps %p to %p", (value, expected) => {
    expect(scoreOpportunityFreshness(value as "fresh" | "recent" | "stale" | "unknown")).toBe(expected);
  });
});

describe("scoreOpportunityDecisionEdge", () => {
  it.each([
    [null, null, null],
    [90, 50, 98],
    [80, 60, 88],
    [70, 60, 78],
    [60, 60, 62],
    [50, 55, 42],
    [40, 65, 14],
  ])("maps buy %p and wait %p to %p", (buyScore, waitScore, expected) => {
    expect(
      scoreOpportunityDecisionEdge(
        buyScore as number | null,
        waitScore as number | null,
      ),
    ).toBe(expected);
  });
});

describe("scoreOpportunityIntelligenceOpportunity", () => {
  it.each([
    [null, null],
    [95, 95],
    [80, 84],
    [60, 70],
    [45, 56],
    [30, 40],
    [20, 24],
  ])("maps %p to %p", (value, expected) => {
    expect(scoreOpportunityIntelligenceOpportunity(value as number | null)).toBe(expected);
  });
});

describe("combined opportunity scoring", () => {
  it("produces a very-high opportunity score when signals are strong", () => {
    const { result } = makeScenario({
      intelligence: {
        trend: {
          direction: "falling",
          strengthLabel: "Hafif düşüş",
          changePercent: -8,
          periodLabel: "30 gun",
          explanation: "Trend dusuyor.",
        },
        demand: {
          searchCount: 28,
          recentSearchCount: 10,
          demandLevel: "high",
          explanation: "Talep yuksek.",
        },
        opportunity: {
          score: 92,
          label: "Normal piyasa",
          explanation: "Avantajli fiyat.",
        },
        recommendation: {
          action: "buy_now",
          title: "Hemen al",
          description: "Karar net.",
        },
        decisionSupport: {
          buyScore: 92,
          waitScore: 40,
          volatilityScore: 18,
          volatilityLevel: "low",
          liquidityScore: 86,
          liquidityLevel: "high",
          label: "Şimdi Al",
          explanation: "Satinalma sinyali guclu.",
        },
      },
      marketIntelligence: {
        sampleSize: 52,
        confidenceScore: 97,
        confidenceLevel: "very-high",
        confidenceReasons: ["Model ayni", "Orneklem yeterli"],
        sourcesUsed: ["EasyCep", "Getmobil", "Sahibinden", "Teknosa"],
        priceAnalysis: {
          averagePrice: 30000,
          medianPrice: 29800,
          minPrice: 23500,
          maxPrice: 31500,
          priceRange: 8000,
          priceSpreadPercent: 12,
          marketValue: 30000,
          listingCount: 52,
          activeListingCount: 50,
          sampleSize: 52,
        },
        marketSummary: {
          sourceCount: 4,
          duplicateDensity: 0.04,
          duplicateGroupCount: 2,
          duplicatePairCount: 2,
          duplicateItemCount: 3,
          confidenceAverage: 95,
          totalListingCount: 52,
          activeListingCount: 50,
          summary: "summary",
          highlights: ["Talep yuksek"],
          warnings: [],
        },
        opportunity: {
          score: 92,
          label: "Normal piyasa",
          explanation: "Avantajli fiyat.",
          action: "buy_now",
          discountPercent: 22,
        },
      },
      duplicateSummary: {
        itemCount: 52,
        duplicateItemCount: 3,
        duplicatePairCount: 2,
        groupCount: 2,
        matchedGroupCount: 2,
        maxGroupSize: 3,
      },
      latestListingAt: "2026-07-05T11:45:00.000Z",
    });

    expect(result.opportunityScore).toBeGreaterThanOrEqual(90);
    expect(result.opportunityLevel).toBe("very-high");
    expect(result.riskLevel).toBe("very-low");
    expect(result.recommendation.action).toBe("buy_now");
    expect(result.positiveSignals).toContain("Confidence çok yüksek");
    expect(result.positiveSignals.some((value) => value.includes("ilan analiz edildi"))).toBe(true);
    expect(result.positiveSignals).toContain("Duplicate yoğunluğu düşük");
  });

  it("returns insufficient data when the sample size is tiny", () => {
    const { result } = makeScenario({
      marketIntelligence: {
        sampleSize: 1,
        confidenceScore: 30,
        confidenceLevel: "low",
        sourcesUsed: ["EasyCep"],
        priceAnalysis: {
          sampleSize: 1,
          listingCount: 1,
          activeListingCount: 1,
          averagePrice: 25000,
          medianPrice: 25000,
          minPrice: 25000,
          maxPrice: 25000,
          priceRange: 0,
          priceSpreadPercent: 0,
          marketValue: 25000,
        },
        marketSummary: {
          sourceCount: 1,
          duplicateDensity: 0.8,
          duplicateGroupCount: 0,
          duplicatePairCount: 0,
          duplicateItemCount: 0,
          confidenceAverage: 30,
          totalListingCount: 1,
          activeListingCount: 1,
          summary: "summary",
          highlights: [],
          warnings: [],
        },
      },
      duplicateSummary: {
        itemCount: 1,
        duplicateItemCount: 0,
        duplicatePairCount: 0,
        groupCount: 0,
        matchedGroupCount: 0,
        maxGroupSize: 1,
      },
      latestListingAt: null,
    });

    expect(result.recommendation.action).toBe("insufficient_data");
    expect(result.dataFreshness).toBe("unknown");
    expect(result.warningSignals).toContain("Örneklem küçük");
    expect(result.warningSignals).toContain("Tek kaynak");
    expect(result.warningSignals).toContain("Confidence düşük");
  });

  it("pushes the risk level up when data is stale and duplicate density is high", () => {
    const { result } = makeScenario({
      intelligence: {
        trend: {
          direction: "rising",
          strengthLabel: "Hafif yükseliş",
          changePercent: 6,
          periodLabel: "30 gun",
          explanation: "Trend yukseliyor.",
        },
        demand: {
          searchCount: 2,
          recentSearchCount: 0,
          demandLevel: "low",
          explanation: "Talep dusuk.",
        },
        decisionSupport: {
          buyScore: 35,
          waitScore: 62,
          volatilityScore: 55,
          volatilityLevel: "medium",
          liquidityScore: 30,
          liquidityLevel: "low",
          label: "Takip Et",
          explanation: "Bekleme sinyali guclu.",
        },
      },
      marketIntelligence: {
        sampleSize: 8,
        confidenceScore: 42,
        confidenceLevel: "low",
        priceAnalysis: {
          sampleSize: 8,
          listingCount: 8,
          activeListingCount: 7,
          averagePrice: 20000,
          medianPrice: 19800,
          minPrice: 22000,
          maxPrice: 28000,
          priceRange: 6000,
          priceSpreadPercent: 42,
          marketValue: 20000,
        },
        marketSummary: {
          sourceCount: 1,
          duplicateDensity: 0.45,
          duplicateGroupCount: 4,
          duplicatePairCount: 3,
          duplicateItemCount: 4,
          confidenceAverage: 42,
          totalListingCount: 8,
          activeListingCount: 7,
          summary: "summary",
          highlights: [],
          warnings: [],
        },
      },
      duplicateSummary: {
        itemCount: 8,
        duplicateItemCount: 4,
        duplicatePairCount: 3,
        groupCount: 4,
        matchedGroupCount: 3,
        maxGroupSize: 4,
      },
      latestListingAt: "2026-06-01T00:00:00.000Z",
    });

    expect(result.riskLevel).not.toBe("very-low");
    expect(result.warningSignals).toContain("Veri eski");
    expect(result.warningSignals).toContain("Duplicate yoğunluğu yüksek");
    expect(result.warningSignals).toContain("Bekleme sinyali güçlü");
  });

  it("orders reasons with warnings first when risk dominates", () => {
    const { result } = makeScenario({
      marketIntelligence: {
        sampleSize: 4,
        confidenceScore: 20,
        confidenceLevel: "low",
        sourcesUsed: ["EasyCep"],
        priceAnalysis: {
          sampleSize: 4,
          listingCount: 4,
          activeListingCount: 4,
          averagePrice: 22000,
          medianPrice: 22000,
          minPrice: 28000,
          maxPrice: 36000,
          priceRange: 8000,
          priceSpreadPercent: 60,
          marketValue: 22000,
        },
        marketSummary: {
          sourceCount: 1,
          duplicateDensity: 0.45,
          duplicateGroupCount: 1,
          duplicatePairCount: 1,
          duplicateItemCount: 1,
          confidenceAverage: 20,
          totalListingCount: 4,
          activeListingCount: 4,
          summary: "summary",
          highlights: [],
          warnings: [],
        },
      },
      latestListingAt: "2026-06-25T00:00:00.000Z",
    });

    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.reasons[0]).toBe(result.warningSignals[0]);
  });

  it("caps the reasons list at five items", () => {
    const { result } = makeScenario({
      intelligence: {
        trend: {
          direction: "falling",
          strengthLabel: "Hafif düşüş",
          changePercent: -5,
          periodLabel: "30 gun",
          explanation: "Trend dusuyor.",
        },
        demand: {
          searchCount: 30,
          recentSearchCount: 8,
          demandLevel: "high",
          explanation: "Talep yuksek.",
        },
        decisionSupport: {
          buyScore: 90,
          waitScore: 40,
          volatilityScore: 20,
          volatilityLevel: "low",
          liquidityScore: 80,
          liquidityLevel: "high",
          label: "Şimdi Al",
          explanation: "Karar destegi guclu.",
        },
      },
      marketIntelligence: {
        sampleSize: 15,
        confidenceScore: 92,
        confidenceLevel: "high",
        sourcesUsed: ["EasyCep", "Getmobil", "Sahibinden"],
        priceAnalysis: {
          sampleSize: 15,
          listingCount: 15,
          activeListingCount: 14,
          averagePrice: 30000,
          medianPrice: 29500,
          minPrice: 25000,
          maxPrice: 32000,
          priceRange: 7000,
          priceSpreadPercent: 24,
          marketValue: 30000,
        },
        marketSummary: {
          sourceCount: 3,
          duplicateDensity: 0.05,
          duplicateGroupCount: 1,
          duplicatePairCount: 1,
          duplicateItemCount: 1,
          confidenceAverage: 92,
          totalListingCount: 15,
          activeListingCount: 14,
          summary: "summary",
          highlights: [],
          warnings: [],
        },
      },
    });

    expect(result.reasons.length).toBeLessThanOrEqual(5);
    expect(result.positiveSignals.length).toBeGreaterThan(0);
  });
});

describe("opportunity metadata helpers", () => {
  it("builds JSON-LD properties for the computed opportunity", () => {
    const { result, marketIntelligence } = makeScenario();
    const properties = buildOpportunityJsonLdProperties(result, marketIntelligence);

    expect(properties.some((item) => item.name === "Opportunity score")).toBe(true);
    expect(properties.some((item) => item.name === "Opportunity level")).toBe(true);
    expect(properties.some((item) => item.name === "Risk level")).toBe(true);
    expect(properties.some((item) => item.name === "Recommendation")).toBe(true);
    expect(properties.some((item) => item.name === "Score version" && item.value === OPPORTUNITY_SCORE_VERSION)).toBe(true);
  });

  it("includes freshness and sample metadata in JSON-LD", () => {
    const { result, marketIntelligence } = makeScenario();
    const properties = buildOpportunityJsonLdProperties(result, marketIntelligence);

    expect(properties.some((item) => item.name === "Data freshness")).toBe(true);
    expect(properties.some((item) => item.name === "Sample size" && item.value === result.sampleSize)).toBe(true);
    expect(properties.some((item) => item.name === "Confidence level" && item.value === "Yüksek")).toBe(true);
  });

  it("adds signal lists when positive and warning reasons exist", () => {
    const { result, marketIntelligence } = makeScenario({
      marketIntelligence: {
        sourcesUsed: ["EasyCep"],
        confidenceScore: 45,
        confidenceLevel: "low",
        sampleSize: 2,
        priceAnalysis: {
          sampleSize: 2,
          listingCount: 2,
          activeListingCount: 2,
          averagePrice: 22000,
          medianPrice: 22000,
          minPrice: 18000,
          maxPrice: 26000,
          priceRange: 8000,
          priceSpreadPercent: 38,
          marketValue: 22000,
        },
        marketSummary: {
          sourceCount: 1,
          duplicateDensity: 0.32,
          duplicateGroupCount: 1,
          duplicatePairCount: 1,
          duplicateItemCount: 1,
          confidenceAverage: 45,
          totalListingCount: 2,
          activeListingCount: 2,
          summary: "summary",
          highlights: [],
          warnings: [],
        },
      },
      duplicateSummary: {
        itemCount: 2,
        duplicateItemCount: 1,
        duplicatePairCount: 1,
        groupCount: 1,
        matchedGroupCount: 1,
        maxGroupSize: 2,
      },
      latestListingAt: null,
    });

    const properties = buildOpportunityJsonLdProperties(result, marketIntelligence);
    const positive = properties.find((item) => item.name === "Positive signals");
    const warning = properties.find((item) => item.name === "Warning signals");

    expect(positive?.value).toContain("Piyasanın");
    expect(warning?.value).toContain("Tek kaynak");
  });
});

describe("analysis signal helpers", () => {
  it("builds strong positive signals for a healthy market", () => {
    const { result } = makeScenario();

    expect(buildPositiveSignals({
      sampleSize: result.sampleSize,
      confidenceScore: result.confidenceLevel === "high" ? 88 : 0,
      confidenceLevel: "high",
      sourceCount: 3,
      duplicateDensity: 0.04,
      priceSpreadPercent: 12,
      priceAdvantagePercent: 12,
      buyScore: 80,
      waitScore: 55,
      opportunityScoreFromIntelligence: 78,
      trendDirection: "falling",
      trendChangePercent: -6,
      demandLevel: "high",
      dataFreshness: "fresh",
      latestListingAgeDays: 0,
      sourceConcentration: 0.41,
    })).toContain("Confidence yüksek");
  });

  it("builds warning signals for stale single-source data", () => {
    const warnings = buildWarningSignals({
      sampleSize: 1,
      confidenceScore: 42,
      confidenceLevel: "low",
      sourceCount: 1,
      duplicateDensity: 0.4,
      priceSpreadPercent: 40,
      priceAdvantagePercent: -2,
      buyScore: 35,
      waitScore: 62,
      opportunityScoreFromIntelligence: 30,
      trendDirection: "rising",
      trendChangePercent: 8,
      demandLevel: "low",
      dataFreshness: "stale",
      latestListingAgeDays: 20,
      sourceConcentration: 0.82,
    });

    expect(warnings).toContain("Örneklem küçük");
    expect(warnings).toContain("Tek kaynak");
    expect(warnings).toContain("Duplicate yoğunluğu yüksek");
    expect(warnings).toContain("Veri eski");
  });

  it("keeps the opportunity reason list deduplicated", () => {
    const reasons = buildOpportunityReasons(
      90,
      30,
      ["A", "B", "A", "C"],
      ["C", "D", "B"],
    );

    expect(reasons).toEqual(["A", "B", "C", "D"]);
  });
});

describe("core opportunity calculations", () => {
  it("maps a score to the expected opportunity level", () => {
    expect(toOpportunityLevel(95)).toBe("very-high");
    expect(toOpportunityLevel(85)).toBe("high");
    expect(toOpportunityLevel(70)).toBe("medium");
    expect(toOpportunityLevel(40)).toBe("low");
    expect(toOpportunityLevel(10)).toBe("very-low");
  });

  it("maps a score to the expected risk level", () => {
    expect(toRiskLevel(95)).toBe("very-high");
    expect(toRiskLevel(85)).toBe("high");
    expect(toRiskLevel(70)).toBe("medium");
    expect(toRiskLevel(40)).toBe("low");
    expect(toRiskLevel(10)).toBe("very-low");
  });

  it("returns a weighted opportunity score from the full context", () => {
    const { marketIntelligence, intelligence, duplicateSummary, result } = makeScenario();
    expect(
      calculateOpportunityScore({
        sampleSize: marketIntelligence.sampleSize,
        confidenceScore: marketIntelligence.confidenceScore,
        confidenceLevel: marketIntelligence.confidenceLevel,
        sourceCount: marketIntelligence.marketSummary.sourceCount,
        duplicateDensity: marketIntelligence.marketSummary.duplicateDensity,
        priceSpreadPercent: marketIntelligence.priceAnalysis.priceSpreadPercent,
        priceAdvantagePercent: 12,
        buyScore: intelligence.decisionSupport.buyScore,
        waitScore: intelligence.decisionSupport.waitScore,
        opportunityScoreFromIntelligence: intelligence.opportunity.score,
        trendDirection: intelligence.trend.direction,
        trendChangePercent: intelligence.trend.changePercent,
        demandLevel: intelligence.demand.demandLevel,
        dataFreshness: result.dataFreshness,
        latestListingAgeDays: 0,
        sourceConcentration: duplicateSummary.duplicateItemCount / duplicateSummary.itemCount,
      }),
    ).toBeGreaterThanOrEqual(70);
  });

  it("returns a weighted risk score from the full context", () => {
    const { marketIntelligence, intelligence, duplicateSummary, result } = makeScenario({
      latestListingAt: "2026-06-01T00:00:00.000Z",
      marketIntelligence: {
        sampleSize: 4,
        confidenceScore: 42,
        confidenceLevel: "low",
        priceAnalysis: {
          sampleSize: 4,
          listingCount: 4,
          activeListingCount: 4,
          averagePrice: 22000,
          medianPrice: 22000,
          minPrice: 25000,
          maxPrice: 29000,
          priceRange: 4000,
          priceSpreadPercent: 42,
          marketValue: 22000,
        },
        marketSummary: {
          sourceCount: 1,
          duplicateDensity: 0.35,
          duplicateGroupCount: 2,
          duplicatePairCount: 2,
          duplicateItemCount: 2,
          confidenceAverage: 42,
          totalListingCount: 4,
          activeListingCount: 4,
          summary: "summary",
          highlights: [],
          warnings: [],
        },
      },
      duplicateSummary: {
        itemCount: 4,
        duplicateItemCount: 2,
        duplicatePairCount: 2,
        groupCount: 2,
        matchedGroupCount: 2,
        maxGroupSize: 2,
      },
    });

      expect(
      calculateOpportunityRiskScore(
        {
          sampleSize: marketIntelligence.sampleSize,
          confidenceScore: marketIntelligence.confidenceScore,
          confidenceLevel: marketIntelligence.confidenceLevel,
          sourceCount: marketIntelligence.marketSummary.sourceCount,
          duplicateDensity: marketIntelligence.marketSummary.duplicateDensity,
          priceSpreadPercent: marketIntelligence.priceAnalysis.priceSpreadPercent,
          priceAdvantagePercent: -12,
          buyScore: intelligence.decisionSupport.buyScore,
          waitScore: intelligence.decisionSupport.waitScore,
          opportunityScoreFromIntelligence: intelligence.opportunity.score,
          trendDirection: intelligence.trend.direction,
          trendChangePercent: intelligence.trend.changePercent,
          demandLevel: intelligence.demand.demandLevel,
          dataFreshness: result.dataFreshness,
          latestListingAgeDays: 35,
          sourceConcentration: duplicateSummary.duplicateItemCount / duplicateSummary.itemCount,
        },
        40,
      ),
    ).toBeGreaterThanOrEqual(58);
  });
});
