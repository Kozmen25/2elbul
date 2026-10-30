import { describe, expect, it } from "vitest";
import {
  calculateOpportunityRating,
  calculatePriceTrend,
  classifyPricePosition,
  defaultHistoryRange,
  nearestPointIndex,
  selectHistoryRange,
  summarizeHistoryRange,
} from "@/lib/price-insights";

const today = new Date("2026-10-10T12:00:00Z");

function point(date: string, average: number, lowest = average - 100, highest = average + 100, count = 1) {
  return { date, average, lowest, highest, count };
}

describe("selectHistoryRange", () => {
  const points = [
    point("2026-07-01", 100),
    point("2026-09-20", 100),
    point("2026-10-03", 100),
    point("2026-10-04", 100),
    point("2026-10-10", 100),
  ];

  it("keeps only the last N days, today included", () => {
    expect(selectHistoryRange(points, 7, today).map((p) => p.date)).toEqual(["2026-10-04", "2026-10-10"]);
    expect(selectHistoryRange(points, 30, today).map((p) => p.date)).toEqual([
      "2026-09-20",
      "2026-10-03",
      "2026-10-04",
      "2026-10-10",
    ]);
  });

  it("returns everything for null and never pads a short range with older days", () => {
    expect(selectHistoryRange(points, null, today)).toHaveLength(5);
    expect(selectHistoryRange([point("2026-01-01", 1)], 7, today)).toEqual([]);
  });
});

describe("defaultHistoryRange", () => {
  it("uses 30 days when it can be drawn, otherwise everything", () => {
    expect(defaultHistoryRange([point("2026-10-01", 1), point("2026-10-05", 1)], today)).toBe("30");
    expect(defaultHistoryRange([point("2026-05-01", 1), point("2026-05-05", 1)], today)).toBe("all");
    expect(defaultHistoryRange([], today)).toBe("all");
  });
});

describe("summarizeHistoryRange", () => {
  it("weights the average by record count and reports the extremes", () => {
    const summary = summarizeHistoryRange([
      point("2026-10-01", 1000, 900, 1200, 1),
      point("2026-10-02", 2000, 1800, 2400, 3),
    ]);
    expect(summary).toMatchObject({
      average: 1750,
      lowest: 900,
      highest: 2400,
      firstDate: "2026-10-01",
      lastDate: "2026-10-02",
      recordCount: 4,
    });
  });

  it("computes the change from the first to the last day, one decimal", () => {
    expect(summarizeHistoryRange([point("a", 20000), point("b", 18900)])?.changePercent).toBe(-5.5);
    expect(summarizeHistoryRange([point("a", 100), point("b", 150)])?.changePercent).toBe(50);
  });

  it("has no change for a single day and no summary for no data", () => {
    expect(summarizeHistoryRange([point("a", 100)])?.changePercent).toBeNull();
    expect(summarizeHistoryRange([])).toBeNull();
  });
});

describe("nearestPointIndex", () => {
  it("maps a horizontal position to the closest point and clamps outside the plot", () => {
    expect(nearestPointIndex(50, 5, 50, 250)).toBe(0);
    expect(nearestPointIndex(250, 5, 50, 250)).toBe(4);
    expect(nearestPointIndex(150, 5, 50, 250)).toBe(2);
    expect(nearestPointIndex(-20, 5, 50, 250)).toBe(0);
    expect(nearestPointIndex(900, 5, 50, 250)).toBe(4);
    expect(nearestPointIndex(10, 1, 50, 250)).toBe(0);
  });
});

describe("classifyPricePosition", () => {
  it.each([
    [-60, "suspicious"],
    [-40, "suspicious"],
    [-20, "great"],
    [-15, "great"],
    [-9, "below"],
    [0, "normal"],
    [10, "normal"],
    [18, "expensive"],
    [25, "expensive"],
    [40, "very_expensive"],
  ] as const)("%s%% from the market is %s", (difference, expected) => {
    expect(classifyPricePosition(difference)).toBe(expected);
  });
});

describe("calculateOpportunityRating", () => {
  it("uses the same bands as the price badges", () => {
    // baseline 25000: 23200 is -7.2% => "below" => İyi Fırsat (was "Harika Fırsat" before the bands were unified)
    expect(calculateOpportunityRating(23200, 25000, 6)).toMatchObject({ label: "İyi Fırsat", percent: 7, suspicious: false });
    expect(calculateOpportunityRating(20000, 25000, 6).label).toBe("Harika Fırsat");
    expect(calculateOpportunityRating(25000, 25000, 6).label).toBe("Normal");
    expect(calculateOpportunityRating(29000, 25000, 6).label).toBe("Pahalı");
  });

  it("flags prices far below the market instead of calling them a great deal", () => {
    expect(calculateOpportunityRating(12000, 25000, 6)).toMatchObject({ label: "Dikkat", suspicious: true });
  });

  it("makes no judgement from fewer than three comparable listings", () => {
    expect(calculateOpportunityRating(10000, 25000, 2)).toMatchObject({ label: "Normal", percent: 0 });
    expect(calculateOpportunityRating(10000, null, 9).label).toBe("Normal");
  });
});

describe("calculatePriceTrend", () => {
  const today = new Date("2026-10-10T12:00:00Z");

  it("compares first and last daily average inside the window", () => {
    const trend = calculatePriceTrend(
      [
        { date: "2026-10-01", average: 20000 },
        { date: "2026-10-05", average: 19000 },
        { date: "2026-10-10", average: 18000 },
      ],
      30,
      today,
    );
    expect(trend).toEqual({ direction: "falling", changePercent: -10, spanDays: 9 });
  });

  it("only looks at the requested window", () => {
    const points = [
      { date: "2026-09-01", average: 30000 },
      { date: "2026-10-06", average: 20000 },
      { date: "2026-10-10", average: 20400 },
    ];
    expect(calculatePriceTrend(points, 7, today)).toEqual({ direction: "stable", changePercent: 2, spanDays: 4 });
    expect(calculatePriceTrend(points, 90, today)?.direction).toBe("falling");
  });

  it("calls moves under 4% stable and reports rises", () => {
    expect(calculatePriceTrend([{ date: "2026-10-08", average: 100 }, { date: "2026-10-10", average: 103 }], 7, today)?.direction).toBe("stable");
    expect(calculatePriceTrend([{ date: "2026-10-08", average: 100 }, { date: "2026-10-10", average: 106 }], 7, today)?.direction).toBe("rising");
  });

  it("has no trend without two days in the window", () => {
    expect(calculatePriceTrend([{ date: "2026-10-10", average: 100 }], 7, today)).toBeNull();
    expect(calculatePriceTrend([{ date: "2026-01-01", average: 100 }, { date: "2026-01-02", average: 90 }], 7, today)).toBeNull();
    expect(calculatePriceTrend([], 7, today)).toBeNull();
  });
});
