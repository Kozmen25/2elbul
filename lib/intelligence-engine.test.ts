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
