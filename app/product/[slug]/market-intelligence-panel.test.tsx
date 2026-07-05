import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { calculateProductIntelligence } from "@/lib/intelligence-engine";
import { buildMarketIntelligence } from "@/lib/market-intelligence";
import { toConfidenceResult } from "@/lib/market-intelligence/helpers";
import type { MarketIntelligenceListing } from "@/lib/market-intelligence";
import {
  formatMarketConfidenceLevel,
  formatMarketIntelligenceSources,
  formatMarketIntelligenceTimestamp,
  MarketIntelligencePanel,
} from "./market-intelligence-panel";

const analyzedAt = "2026-07-05T10:30:00.000Z";

const scope = {
  productId: "product-1",
  productName: "iPhone 13",
  slug: "iphone-13",
  url: "/product/iphone-13",
  category: "Telefon",
  brand: "Apple",
};

function makeListing(
  id: string,
  source: string,
  price: number,
): MarketIntelligenceListing {
  return {
    id,
    title: "iPhone 13 128 GB",
    price,
    source: source as MarketIntelligenceListing["source"],
    city: "Istanbul",
    condition: "İkinci El",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-02T00:00:00.000Z",
    productId: scope.productId,
    productName: scope.productName,
    status: "published",
    confidenceScore: 90,
    confidenceLevel: "high",
    sourceReliability: 92,
  };
}

function buildRichMarketIntelligence() {
  const listings = [
    makeListing("1", "EasyCep", 24500),
    makeListing("2", "Getmobil", 25500),
    makeListing("3", "Sahibinden", 26500),
  ];
  const intelligence = calculateProductIntelligence({
    listings: listings.map((listing) => ({
      price: listing.price,
      createdAt: listing.createdAt,
    })),
    priceHistory: [
      { price: 28000, recordedAt: "2026-05-01T00:00:00.000Z" },
      { price: 26000, recordedAt: "2026-06-01T00:00:00.000Z" },
      { price: 25000, recordedAt: "2026-07-01T00:00:00.000Z" },
    ],
    demand: {
      searchCount: 30,
      recentSearchCount: 9,
    },
  });

  return buildMarketIntelligence({
    scope,
    listings,
    intelligence,
    decisionInsight: {
      confidence: toConfidenceResult(92, ["Model aynı"]),
      smartPrice: {
        summary: "Piyasa bandı dengeli.",
        details: ["Fiyatlar birbirine yakın."],
        warnings: [],
      },
    },
    analyzedAt,
  });
}

function buildEmptyMarketIntelligence() {
  return buildMarketIntelligence({
    scope,
    listings: [],
    analyzedAt,
  });
}

describe("market intelligence helpers", () => {
  it("maps very-high confidence to Turkish label", () => {
    expect(formatMarketConfidenceLevel("very-high")).toBe("Çok yüksek");
  });

  it("maps high confidence to Turkish label", () => {
    expect(formatMarketConfidenceLevel("high")).toBe("Yüksek");
  });

  it("maps medium confidence to Turkish label", () => {
    expect(formatMarketConfidenceLevel("medium")).toBe("Orta");
  });

  it("maps low confidence to Turkish label", () => {
    expect(formatMarketConfidenceLevel("low")).toBe("Düşük");
  });

  it("maps very-low confidence to Turkish label", () => {
    expect(formatMarketConfidenceLevel("very-low")).toBe("Çok düşük");
  });

  it("joins sources with commas", () => {
    expect(formatMarketIntelligenceSources([" EasyCep ", "Getmobil", "Sahibinden"])).toBe(
      "EasyCep, Getmobil, Sahibinden",
    );
  });

  it("falls back when no sources are available", () => {
    expect(formatMarketIntelligenceSources([])).toBe("Henüz kaynak yok");
  });

  it("formats the analysis timestamp for display", () => {
    const formatted = formatMarketIntelligenceTimestamp(analyzedAt);
    expect(formatted).toContain("2026");
    expect(formatted).not.toBe("—");
  });

  it("returns a fallback for invalid timestamps", () => {
    expect(formatMarketIntelligenceTimestamp("invalid")).toBe("—");
  });
});

describe("MarketIntelligencePanel", () => {
  it("renders the market intelligence panel with the key metrics", () => {
    const marketIntelligence = buildRichMarketIntelligence();
    const html = renderToStaticMarkup(
      <MarketIntelligencePanel marketIntelligence={marketIntelligence} />,
    );

    expect(html).toContain("Piyasa Zekâsı");
    expect(html).toContain("Market Intelligence");
    expect(html).toContain("Piyasa ortalaması");
    expect(html).toContain("En düşük fiyat");
    expect(html).toContain("En yüksek fiyat");
    expect(html).toContain("Medyan fiyat");
    expect(html).toContain("Aktif ilan sayısı");
    expect(html).toContain("Örneklem büyüklüğü");
    expect(html).toContain("Güven seviyesi");
    expect(html).toContain("Fırsat skoru");
  });

  it("renders the EEAT copy for sample size, sources and update time", () => {
    const marketIntelligence = buildRichMarketIntelligence();
    const html = renderToStaticMarkup(
      <MarketIntelligencePanel marketIntelligence={marketIntelligence} />,
    );

    expect(html).toContain("Bu analiz 3 ilan üzerinden oluşturuldu.");
    expect(html).toContain("Kullanılan kaynaklar");
    expect(html).toContain("EasyCep, Getmobil, Sahibinden");
    expect(html).toContain("Son güncelleme:");
  });

  it("shows the translated confidence level in the panel", () => {
    const marketIntelligence = buildRichMarketIntelligence();
    const html = renderToStaticMarkup(
      <MarketIntelligencePanel marketIntelligence={marketIntelligence} />,
    );

    expect(html).toContain(
      formatMarketConfidenceLevel(marketIntelligence.confidenceLevel),
    );
  });

  it("shows the insufficient data fallback for an empty dataset", () => {
    const marketIntelligence = buildEmptyMarketIntelligence();
    const html = renderToStaticMarkup(
      <MarketIntelligencePanel marketIntelligence={marketIntelligence} />,
    );

    expect(html).toContain("Yetersiz veri");
    expect(html).toContain("Bu ürün için henüz yeterli ilan verisi yok.");
    expect(html).toContain("Henüz kaynak yok");
  });

  it("keeps the responsive grid classes on the metrics panel", () => {
    const marketIntelligence = buildRichMarketIntelligence();
    const html = renderToStaticMarkup(
      <MarketIntelligencePanel marketIntelligence={marketIntelligence} />,
    );

    expect(html).toContain("min-[420px]:grid-cols-2");
    expect(html).toContain("xl:grid-cols-4");
    expect(html).toContain("lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]");
  });
});
