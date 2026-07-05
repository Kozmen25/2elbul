import { describe, expect, it } from "vitest";
import {
  averageConfidenceScore,
  buildSourceBreakdown,
  calculateAverage,
  formatCurrency,
  normalizeAnalysisTimestamp,
  toConfidenceLevel,
  toConfidenceResult,
  uniqueStrings,
  getActiveListingCount,
} from "./helpers";
import type { MarketIntelligenceListing } from "./types";

const makeListing = (
  overrides: Partial<MarketIntelligenceListing> = {},
): MarketIntelligenceListing => ({
  id: "1",
  title: "iPhone 13",
  price: 25000,
  source: "EasyCep",
  city: "Istanbul",
  condition: "İkinci El",
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
  ...overrides,
});

describe("market-intelligence helpers", () => {
  it("normalizes a Date input to ISO", () => {
    expect(
      normalizeAnalysisTimestamp(new Date("2026-06-05T12:34:56.000Z")),
    ).toBe("2026-06-05T12:34:56.000Z");
  });

  it("normalizes a date string to ISO", () => {
    expect(normalizeAnalysisTimestamp("2026-06-05")).toBe(
      "2026-06-05T00:00:00.000Z",
    );
  });

  it("deduplicates and trims strings", () => {
    expect(uniqueStrings([" EasyCep ", "Getmobil", "", null, "EasyCep"])).toEqual([
      "EasyCep",
      "Getmobil",
    ]);
  });

  it.each([
    [95, "very-high"],
    [85, "high"],
    [70, "medium"],
    [50, "low"],
    [49, "very-low"],
  ] as const)("maps %s to %s", (score, level) => {
    expect(toConfidenceLevel(score)).toBe(level);
  });

  it("returns null for an invalid confidence score", () => {
    expect(toConfidenceResult(null, ["ok"])).toBeNull();
  });

  it("builds a confidence result from score and reasons", () => {
    expect(toConfidenceResult(91, ["Model same"])).toEqual({
      score: 91,
      level: "high",
      reasons: ["Model same"],
      signals: {},
    });
  });

  it("returns null average for an empty list", () => {
    expect(calculateAverage([])).toBeNull();
  });

  it("calculates a rounded average", () => {
    expect(calculateAverage([10, 20, 31])).toBe(20);
  });

  it("aggregates sources with counts and prices", () => {
    const breakdown = buildSourceBreakdown([
      makeListing({ id: "1", source: "EasyCep", price: 20000 }),
      makeListing({ id: "2", source: "EasyCep", price: 22000 }),
      makeListing({ id: "3", source: "Getmobil", price: 24000 }),
    ]);

    expect(breakdown[0]?.source).toBe("EasyCep");
    expect(breakdown[0]?.listingCount).toBe(2);
    expect(breakdown[0]?.averagePrice).toBe(21000);
    expect(breakdown[0]?.share).toBeCloseTo(0.667, 3);
    expect(breakdown[1]?.source).toBe("Getmobil");
    expect(breakdown[1]?.lowestPrice).toBe(24000);
  });

  it("falls back to an unknown source bucket", () => {
    const breakdown = buildSourceBreakdown([
      makeListing({ id: "1", source: "   " as never, price: 20000 }),
    ]);

    expect(breakdown[0]?.source).toBe("Bilinmeyen kaynak");
    expect(breakdown[0]?.share).toBe(1);
  });

  it("counts missing status as active", () => {
    expect(
      getActiveListingCount([
        makeListing({ id: "1", status: "published" }),
        makeListing({ id: "2", status: "inactive" }),
        makeListing({ id: "3" }),
      ]),
    ).toBe(2);
  });

  it("formats Turkish Lira amounts", () => {
    const formatted = formatCurrency(12500);
    expect(formatted).toContain("12.500");
    expect(formatted).toContain("₺");
  });

  it("averages confidence scores when available", () => {
    expect(averageConfidenceScore([90, 80, null, undefined])).toBe(85);
  });
});
