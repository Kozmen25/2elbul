import { describe, expect, it } from "vitest";
import { buildSourceComparison, type SourceOfferInput } from "@/lib/source-comparison";

function offer(id: string, source: string, price: number, createdAt = "2026-10-01"): SourceOfferInput {
  return { id, source, price, url: `https://${source}/${id}`, city: "İstanbul", condition: "İkinci El", createdAt };
}

describe("buildSourceComparison", () => {
  it("returns one row per source, cheapest first, with the gap to the best", () => {
    const rows = buildSourceComparison([
      offer("1", "Sahibinden", 25000),
      offer("2", "Sahibinden", 27000),
      offer("3", "Letgo", 24000),
      offer("4", "EasyCep", 26400),
    ]);
    expect(rows.map((row) => row.source)).toEqual(["Letgo", "Sahibinden", "EasyCep"]);
    expect(rows[0]).toMatchObject({ isBest: true, aboveBestPercent: 0, lowestPrice: 24000, listingCount: 1 });
    expect(rows[1]).toMatchObject({ listingCount: 2, lowestPrice: 25000, averagePrice: 26000, aboveBestPercent: 4.2 });
    expect(rows[2].aboveBestPercent).toBe(10);
    expect(rows[1].cheapest.id).toBe("1");
  });

  it("counts duplicate copies as offers of their own platform", () => {
    // The same item posted on two platforms: both platforms still show their price.
    const rows = buildSourceComparison([offer("a", "Sahibinden", 25000), offer("b", "Letgo", 25200)]);
    expect(rows.map((row) => [row.source, row.lowestPrice])).toEqual([["Sahibinden", 25000], ["Letgo", 25200]]);
  });

  it("has nothing to compare with a single source or no valid price", () => {
    expect(buildSourceComparison([offer("1", "Sahibinden", 25000), offer("2", "Sahibinden", 26000)])).toEqual([]);
    expect(buildSourceComparison([offer("1", "Sahibinden", 25000), offer("2", "Letgo", 0)])).toEqual([]);
    expect(buildSourceComparison([])).toEqual([]);
  });

  it("orders ties by source name and marks every tied platform as best", () => {
    const rows = buildSourceComparison([offer("1", "Letgo", 25000), offer("2", "EasyCep", 25000), offer("3", "Getmobil", 26000)]);
    expect(rows.map((row) => row.source)).toEqual(["EasyCep", "Letgo", "Getmobil"]);
    expect(rows.map((row) => row.isBest)).toEqual([true, true, false]);
  });
});
