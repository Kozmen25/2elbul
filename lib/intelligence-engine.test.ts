import { describe, expect, it } from "vitest";
import { calculateProductIntelligence } from "./intelligence-engine";

describe("calculateProductIntelligence", () => {
  it("returns insufficient data for products with too few listings", () => {
    const result = calculateProductIntelligence({
      listings: [{ price: 20000 }, { price: 21000 }],
    });

    expect(result.opportunity.label).toBe("Veri yetersiz");
    expect(result.recommendation.action).toBe("insufficient_data");
    expect(result.marketValue.listingCount).toBe(2);
  });

  it("detects a strong opportunity below the average", () => {
    const result = calculateProductIntelligence({
      listings: [
        { price: 40000, createdAt: "2026-06-01" },
        { price: 50000, createdAt: "2026-06-02" },
        { price: 51000, createdAt: "2026-06-03" },
        { price: 52000, createdAt: "2026-06-04" },
        { price: 53000, createdAt: "2026-06-05" },
      ],
      // A calm price history: without history there is no trend signal at all.
      priceHistory: [
        { price: 50500, recordedAt: "2026-06-01" },
        { price: 50800, recordedAt: "2026-06-03" },
        { price: 50600, recordedAt: "2026-06-05" },
      ],
      now: new Date("2026-06-06"),
      demand: { searchCount: 12, recentSearchCount: 4 },
    });

    expect(result.opportunity.label).toBe("Güçlü fırsat");
    expect(result.opportunity.score).toBeGreaterThanOrEqual(70);
    expect(result.decisionSupport.buyScore).toBeGreaterThan(result.decisionSupport.waitScore);
  });

  it("recommends waiting when the trend is falling", () => {
    const result = calculateProductIntelligence({
      listings: [{ price: 46000 }, { price: 47000 }, { price: 48000 }],
      priceHistory: [
        { price: 56000, recordedAt: "2026-06-01" },
        { price: 50000, recordedAt: "2026-06-15" },
        { price: 46000, recordedAt: "2026-06-30" },
      ],
      now: new Date("2026-06-30"),
      demand: { searchCount: 10, recentSearchCount: 3 },
    });

    expect(result.trend.direction).toBe("falling");
    expect(result.trend.strengthLabel).toBe("Güçlü düşüş");
    expect(result.recommendation.action).toBe("wait");
    expect(result.decisionSupport.label).toBe("Bekle");
  });

  it("recommends buy now for stable market with a cheap listing", () => {
    const result = calculateProductIntelligence({
      listings: [
        { price: 44000, createdAt: "2026-06-01" },
        { price: 52000, createdAt: "2026-06-02" },
        { price: 53000, createdAt: "2026-06-03" },
        { price: 54000, createdAt: "2026-06-04" },
      ],
      priceHistory: [
        { price: 52000, recordedAt: "2026-06-01" },
        { price: 52500, recordedAt: "2026-06-15" },
        { price: 52200, recordedAt: "2026-06-30" },
      ],
      now: new Date("2026-06-30"),
      demand: { searchCount: 18, recentSearchCount: 5 },
    });

    expect(result.trend.direction).toBe("stable");
    expect(result.trend.strengthLabel).toBe("Stabil");
    expect(result.recommendation.action).toBe("buy_now");
    expect(result.decisionSupport.label).toBe("Şimdi Al");
  });

  it("marks high demand when search interest is high", () => {
    const result = calculateProductIntelligence({
      listings: [
        { price: 20000 },
        { price: 20500 },
        { price: 21000 },
        { price: 21500 },
        { price: 22000 },
        { price: 22500 },
        { price: 23000 },
      ],
      demand: { searchCount: 30, recentSearchCount: 9 },
    });

    expect(result.demand.demandLevel).toBe("high");
    expect(result.decisionSupport.liquidityLevel).toBe("high");
  });

  it("marks volatile markets with higher volatility score", () => {
    const result = calculateProductIntelligence({
      listings: [
        { price: 25000 },
        { price: 52000 },
        { price: 56000 },
        { price: 90000 },
      ],
      demand: { searchCount: 4, recentSearchCount: 1 },
    });

    expect(result.decisionSupport.volatilityLevel).toBe("high");
    expect(result.decisionSupport.label).not.toBe("Şimdi Al");
  });

  it("keeps decision support as low data when data is insufficient", () => {
    const result = calculateProductIntelligence({
      listings: [{ price: 30000 }],
    });

    expect(result.decisionSupport.label).toBe("Veri Az");
    expect(result.decisionSupport.buyScore).toBe(0);
  });

  it("marks low liquidity when listings and demand are limited", () => {
    const result = calculateProductIntelligence({
      listings: [{ price: 20000 }, { price: 20500 }, { price: 21000 }],
      demand: { searchCount: 1, recentSearchCount: 0 },
      now: new Date("2026-07-03T10:00:00.000Z"),
    });

    expect(result.decisionSupport.liquidityLevel).toBe("low");
  });
});

describe("trend source", () => {
  const listings = [{ price: 44000 }, { price: 52000 }, { price: 53000 }, { price: 54000 }];
  const now = new Date("2026-06-30");

  it("has no trend without price history, even when listing dates would suggest one", () => {
    const result = calculateProductIntelligence({
      listings: listings.map((listing, index) => ({ ...listing, createdAt: `2026-06-0${index + 1}` })),
      now,
    });
    expect(result.trend.direction).toBe("unknown");
    expect(result.trend.changePercent).toBeNull();
  });

  it("compares daily averages, not the first and last raw record of different listings", () => {
    // Day 1: a 30000 and a 70000 listing (average 50000). Day 2: 49000 and 51000
    // (average 50000). Raw first-to-last would read +70%; the market did not move.
    const result = calculateProductIntelligence({
      listings,
      priceHistory: [
        { price: 30000, recordedAt: "2026-06-10T08:00:00Z" },
        { price: 70000, recordedAt: "2026-06-10T09:00:00Z" },
        { price: 49000, recordedAt: "2026-06-20T08:00:00Z" },
        { price: 51000, recordedAt: "2026-06-20T09:00:00Z" },
      ],
      now,
    });
    expect(result.trend.direction).toBe("stable");
    expect(result.trend.changePercent).toBe(0);
  });

  it("ignores history older than the trend window", () => {
    const result = calculateProductIntelligence({
      listings,
      priceHistory: [
        { price: 90000, recordedAt: "2026-01-01" },
        { price: 40000, recordedAt: "2026-01-20" },
      ],
      now,
    });
    expect(result.trend.direction).toBe("unknown");
  });
});
