import { describe, expect, it } from "vitest";
import { evaluateProductFollow } from "@/lib/product-follows/rules";

describe("evaluateProductFollow", () => {
  it("only records a baseline for a fresh follow", () => {
    expect(evaluateProductFollow({ baseline: null, currentPrice: 20000, lowestIsNewListing: false })).toEqual({
      outcome: { kind: "unchanged" },
      nextBaseline: 20000,
    });
  });

  it("reports a drop of at least 5% and moves the baseline down", () => {
    expect(evaluateProductFollow({ baseline: 20000, currentPrice: 18000, lowestIsNewListing: false })).toEqual({
      outcome: { kind: "price_drop", previousPrice: 20000, dropPercent: 10 },
      nextBaseline: 18000,
    });
  });

  it("reports a new listing when it set the new low", () => {
    const result = evaluateProductFollow({
      baseline: 20000,
      currentPrice: 18000,
      lowestIsNewListing: true,
      marketAverage: 22000,
    });
    expect(result.outcome).toEqual({ kind: "new_listing", price: 18000, belowMarketPercent: 18.2, dropPercent: 10 });
    expect(result.nextBaseline).toBe(18000);
  });

  it("reports a favourably priced new listing even when the lowest price barely moves", () => {
    const result = evaluateProductFollow({
      baseline: 20000,
      currentPrice: 19600, // only -2%: not a drop
      lowestIsNewListing: true,
      newListing: { price: 19600 },
      marketAverage: 22000,
    });
    expect(result.outcome).toEqual({ kind: "new_listing", price: 19600, belowMarketPercent: 10.9, dropPercent: null });
    expect(result.nextBaseline).toBe(20000);
  });

  it("ignores a new listing that is not clearly below the market", () => {
    const base = { baseline: 20000, currentPrice: 20000, lowestIsNewListing: false, marketAverage: 22000 };
    expect(evaluateProductFollow({ ...base, newListing: { price: 21500 } }).outcome.kind).toBe("unchanged"); // 2.3% under
    expect(evaluateProductFollow({ ...base, newListing: { price: 23000 } }).outcome.kind).toBe("unchanged"); // above market
    expect(evaluateProductFollow({ ...base, newListing: { price: 15000 }, marketAverage: null }).outcome.kind).toBe("unchanged");
  });

  it("prefers the price drop over the new-listing rule when both apply", () => {
    const result = evaluateProductFollow({
      baseline: 20000,
      currentPrice: 17000,
      lowestIsNewListing: false,
      newListing: { price: 18000 },
      marketAverage: 22000,
    });
    expect(result.outcome.kind).toBe("price_drop");
  });

  it("keeps small dips and lets them add up", () => {
    const first = evaluateProductFollow({ baseline: 20000, currentPrice: 19500, lowestIsNewListing: false });
    expect(first).toEqual({ outcome: { kind: "unchanged" }, nextBaseline: 20000 });
    const second = evaluateProductFollow({ baseline: first.nextBaseline, currentPrice: 18900, lowestIsNewListing: false });
    expect(second.outcome.kind).toBe("price_drop");
  });

  it("follows the price up so a later drop is measured from the higher price", () => {
    const up = evaluateProductFollow({ baseline: 20000, currentPrice: 24000, lowestIsNewListing: false });
    expect(up).toEqual({ outcome: { kind: "unchanged" }, nextBaseline: 24000 });
    expect(
      evaluateProductFollow({ baseline: up.nextBaseline, currentPrice: 22000, lowestIsNewListing: false }).outcome.kind,
    ).toBe("price_drop");
  });

  it("never notifies for accessories and spare parts", () => {
    expect(
      evaluateProductFollow({
        baseline: 20000,
        currentPrice: 10000,
        lowestIsNewListing: true,
        newListing: { price: 10000 },
        marketAverage: 22000,
        suppressDrop: true,
      }),
    ).toEqual({ outcome: { kind: "unchanged" }, nextBaseline: 20000 });
  });
});
