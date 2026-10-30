import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ListingPriceHistoryChart,
  PriceHistorySvg,
  type ListingPriceHistoryPoint,
} from "./listing-price-history-chart";

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function point(daysBack: number, average: number, lowest = average - 500, highest = average + 500, count = 2): ListingPriceHistoryPoint {
  return { date: daysAgo(daysBack), average, lowest, highest, count };
}

const recent = [point(20, 20000), point(10, 19000), point(0, 18000)];

describe("ListingPriceHistoryChart", () => {
  it("explains that history is still being collected with fewer than two days", () => {
    const html = renderToStaticMarkup(<ListingPriceHistoryChart points={[point(0, 20000)]} />);
    expect(html).toContain("Fiyat geçmişi birikiyor");
    expect(html).not.toContain("7 gün");
  });

  it("offers the 7/30/90 day and all-time ranges with 30 days selected when it can be drawn", () => {
    const html = renderToStaticMarkup(<ListingPriceHistoryChart points={recent} />);
    for (const label of ["7 gün", "30 gün", "90 gün", "Tümü"]) expect(html).toContain(label);
    expect(html).toMatch(/aria-pressed="true"[^>]*>30 gün/);
  });

  it("falls back to all-time when the last 30 days are too sparse", () => {
    const old = [point(200, 20000), point(150, 19000)];
    const html = renderToStaticMarkup(<ListingPriceHistoryChart points={old} />);
    expect(html).toMatch(/aria-pressed="true"[^>]*>Tümü/);
  });

  it("summarises the period: average, lowest, highest and change", () => {
    const html = renderToStaticMarkup(<ListingPriceHistoryChart points={recent} />);
    expect(html).toContain("Dönem ortalaması");
    expect(html).toContain("₺19.000"); // weighted average of equal counts
    expect(html).toContain("₺17.500"); // lowest
    expect(html).toContain("₺20.500"); // highest
    expect(html).toContain("↓ %10"); // 20000 -> 18000
    expect(html).toContain("6 fiyat kaydı");
  });
});

describe("PriceHistorySvg", () => {
  it("draws the average line, lowest line and the daily range band", () => {
    const html = renderToStaticMarkup(
      <PriceHistorySvg points={recent} width={600} activeIndex={null} onActiveChange={() => undefined} />,
    );
    expect(html).toContain('width="600"');
    expect(html).toContain('stroke="#3B66E0"');
    expect(html).toContain('stroke="#16a34a"');
    expect(html).toContain('fill-opacity="0.1"');
    expect(html).toContain("sol ve sağ ok tuşlarını");
    expect(html).not.toContain('role="status"');
  });

  it("shows the hovered day's values in a tooltip", () => {
    const html = renderToStaticMarkup(
      <PriceHistorySvg points={recent} width={600} activeIndex={1} onActiveChange={() => undefined} />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain("₺19.000");
    expect(html).toContain("En yüksek");
  });
});
