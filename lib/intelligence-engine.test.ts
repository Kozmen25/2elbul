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
    expect(result.recommendation.action).toBe("wait");
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
    expect(result.recommendation.action).toBe("buy_now");
  });

  it("marks high demand when search interest is high", () => {
    const result = calculateProductIntelligence({
      listings: [{ price: 20000 }, { price: 21000 }, { price: 22000 }],
      demand: { searchCount: 30, recentSearchCount: 9 },
    });

    expect(result.demand.demandLevel).toBe("high");
  });
});
