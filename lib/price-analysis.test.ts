import { describe, expect, it } from "vitest";
import { analyzeListingPrice, buildProductPriceStats } from "@/lib/price-analysis";
import { calculateOpportunityRating } from "@/lib/price-insights";

const points = (prices: number[], productId = "p1") => prices.map((price) => ({ productId, price }));

describe("buildProductPriceStats", () => {
  it("counts every priced listing and keeps the raw extremes", () => {
    const stats = buildProductPriceStats(points([20000, 22000, 24000, 26000]))["p1"];
    expect(stats).toMatchObject({ count: 4, min: 20000, max: 26000, average: 23000 });
  });

  it("does not let one absurd listing drag the average", () => {
    const stats = buildProductPriceStats(points([24000, 24500, 25000, 25500, 26000, 400000]))["p1"];
    expect(stats.max).toBe(400000);
    expect(stats.average).toBeLessThan(26000);
  });

  it("ignores invalid prices and groups by product", () => {
    const stats = buildProductPriceStats([
      ...points([100, 200, 300], "a"),
      { productId: "b", price: 0 },
      { productId: "b", price: "abc" },
      { productId: null, price: 500 },
    ]);
    expect(Object.keys(stats)).toEqual(["a"]);
  });
});

describe("analyzeListingPrice", () => {
  const stats = buildProductPriceStats(points([24000, 25000, 25500, 26000, 27000, 27900]))["p1"];

  it("labels a listing by its distance from the market average", () => {
    expect(analyzeListingPrice(stats.average, stats).label).toBe("Normal fiyat");
    expect(analyzeListingPrice(stats.average * 0.9, stats).label).toBe("Piyasanın altında");
    expect(analyzeListingPrice(stats.average * 0.8, stats).label).toBe("Çok iyi fırsat");
    expect(analyzeListingPrice(stats.average * 1.2, stats).label).toBe("Pahalı");
    expect(analyzeListingPrice(stats.average * 1.5, stats).label).toBe("Çok pahalı");
  });

  it("calls a price far below the market suspicious, not a great deal", () => {
    expect(analyzeListingPrice(stats.average * 0.5, stats).label).toBe("Şüpheli ucuz");
  });

  it("needs at least three listings to judge", () => {
    const thin = buildProductPriceStats(points([20000, 21000]))["p1"];
    expect(analyzeListingPrice(20000, thin).label).toBe("Yetersiz veri");
    expect(analyzeListingPrice(20000, null).label).toBe("Yetersiz veri");
  });

  it("agrees with the star rating for every price", () => {
    const labelMap: Record<string, string> = {
      "Şüpheli ucuz": "Dikkat",
      "Çok iyi fırsat": "Harika Fırsat",
      "Piyasanın altında": "İyi Fırsat",
      "Normal fiyat": "Normal",
      Pahalı: "Pahalı",
      "Çok pahalı": "Pahalı",
    };
    for (const factor of [0.4, 0.6, 0.8, 0.9, 1, 1.08, 1.2, 1.4]) {
      const price = Math.round(stats.average * factor);
      const badge = analyzeListingPrice(price, stats).label;
      const rating = calculateOpportunityRating(price, stats.average, stats.count).label;
      expect(rating, `price factor ${factor}`).toBe(labelMap[badge]);
    }
  });
});
