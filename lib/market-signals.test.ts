import { describe, expect, it } from "vitest";
import { buildMarketSignals, type HistoryRecord, type SignalListing } from "@/lib/market-signals";

const now = new Date("2026-10-10T12:00:00Z");
const day = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86400_000).toISOString();
const listing = (id: number, productId: number, price: number): SignalListing => ({ id, productId, title: `l${id}`, price, source: "Sahibinden", url: `https://x/${id}` });

const products = [
  { id: 1, name: "iPhone 13", slug: "iphone-13" },
  { id: 2, name: "PS5", slug: "ps5" },
  { id: 3, name: "Nadir Ürün", slug: null },
];
const markets = new Map([[1, { average: 25000, count: 6 }], [2, { average: 20000, count: 5 }]]);

describe("buildMarketSignals", () => {
  const listings = [
    listing(1, 1, 25000), listing(2, 1, 21000), listing(3, 1, 12000), listing(4, 1, 24000),
    listing(5, 2, 17000), listing(6, 2, 20000), listing(7, 3, 5000),
  ];
  const history: HistoryRecord[] = [
    { productId: 1, price: 26000, recordedAt: day(20) }, { productId: 1, price: 22000, recordedAt: day(1) },
    { productId: 2, price: 20000, recordedAt: day(20) }, { productId: 2, price: 20200, recordedAt: day(1) },
  ];
  const signals = buildMarketSignals({ listings, markets, products, history, followCounts: new Map([[1, 4], [2, 9]]), now });

  it("lists good deals by how far below the market they are, without the suspicious ones", () => {
    expect(signals.opportunities.map((s) => s.id)).toEqual([2, 5]);
    expect(signals.opportunities[0]).toMatchObject({ productName: "iPhone 13", differencePercent: -16 });
    expect(signals.opportunities[1]).toMatchObject({ productName: "PS5", differencePercent: -15 });
  });

  it("separates prices at least 40% below the market", () => {
    expect(signals.suspicious.map((s) => s.id)).toEqual([3]);
    expect(signals.suspiciousTotal).toBe(1);
  });

  it("finds products whose daily average prices are falling", () => {
    expect(signals.falling).toEqual([
      { productId: 1, name: "iPhone 13", slug: "iphone-13", value: -15.4, note: "19 günde %15,4 düştü" },
    ]);
  });

  it("finds products with too few live listings", () => {
    // PS5 has a market (5 listings in the stats) but only 2 are live right now.
    expect(signals.thinData.map((s) => [s.name, s.value])).toEqual([["Nadir Ürün", 1], ["PS5", 2]]);
  });

  it("ranks the most followed products", () => {
    expect(signals.mostFollowed.map((s) => [s.name, s.value])).toEqual([["PS5", 9], ["iPhone 13", 4]]);
  });

  it("makes no price judgement for a product without a market", () => {
    expect(signals.opportunities.concat(signals.suspicious).some((s) => s.productId === 3)).toBe(false);
  });
});
