import { describe, expect, it } from "vitest";
import { buildMarketPulse } from "./market-pulse";

const products = [
  { id: 1, name: "iPhone 13" },
  { id: 2, name: "Samsung S23" },
  { id: 3, name: "PlayStation 5" },
];

describe("buildMarketPulse", () => {
  it("sorts most searched products by search count", () => {
    const pulse = buildMarketPulse({
      products,
      listings: [
        { productId: 1, productName: "iPhone 13", price: 20000 },
        { productId: 2, productName: "Samsung S23", price: 25000 },
      ],
      searches: [
        { productId: 2 },
        { productId: 2 },
        { productId: 1 },
      ],
    });

    expect(pulse.mostSearchedProducts[0]?.productName).toBe("Samsung S23");
    expect(pulse.mostSearchedProducts[0]?.searchCount).toBe(2);
  });

  it("sorts most listed products by listing count", () => {
    const pulse = buildMarketPulse({
      products,
      listings: [
        { productId: 1, productName: "iPhone 13", price: 20000 },
        { productId: 1, productName: "iPhone 13", price: 21000 },
        { productId: 2, productName: "Samsung S23", price: 25000 },
      ],
    });

    expect(pulse.mostListedProducts[0]?.productName).toBe("iPhone 13");
    expect(pulse.mostListedProducts[0]?.listingCount).toBe(2);
  });

  it("selects products with high opportunity score", () => {
    const pulse = buildMarketPulse({
      products,
      listings: [
        { productId: 1, productName: "iPhone 13", price: 39000, createdAt: "2026-06-01" },
        { productId: 1, productName: "iPhone 13", price: 50000, createdAt: "2026-06-02" },
        { productId: 1, productName: "iPhone 13", price: 51000, createdAt: "2026-06-03" },
        { productId: 1, productName: "iPhone 13", price: 52000, createdAt: "2026-06-04" },
      ],
    });

    expect(pulse.topOpportunities[0]?.productName).toBe("iPhone 13");
    expect(pulse.topOpportunities[0]?.opportunityScore).toBeGreaterThan(0);
  });

  it("returns safe empty lists when there is not enough data", () => {
    const pulse = buildMarketPulse({
      products: [],
      listings: [],
      searches: [],
    });

    expect(pulse.mostSearchedProducts).toEqual([]);
    expect(pulse.mostListedProducts).toEqual([]);
    expect(pulse.topOpportunities).toEqual([]);
  });
});
