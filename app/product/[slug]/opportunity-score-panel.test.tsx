import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MarketIntelligence } from "@/lib/market-intelligence";
import type { OpportunityAnalysis } from "@/lib/opportunity-engine";
import { OpportunityScorePanel } from "./opportunity-score-panel";

const analyzedAt = "2026-07-05T10:30:00.000Z";

const baseMarketIntelligence: MarketIntelligence = {
  scope: {
    productId: "product-1",
    productName: "iPhone 13",
    slug: "iphone-13",
    url: "/product/iphone-13",
    category: "Telefon",
    brand: "Apple",
  },
  analysisGeneratedAt: analyzedAt,
  sampleSize: 52,
  confidenceScore: 92,
  confidenceLevel: "high",
  confidenceReasons: ["Model aynı", "Örneklem yeterli"],
  sourcesUsed: ["EasyCep", "Getmobil", "Sahibinden"],
  priceAnalysis: {
    averagePrice: 25000,
    medianPrice: 24500,
    minPrice: 23000,
    maxPrice: 27000,
    priceRange: 4000,
    priceSpreadPercent: 16,
    marketValue: 25000,
    listingCount: 52,
    activeListingCount: 49,
    sampleSize: 52,
  },
  marketSummary: {
    summary: "summary",
    highlights: ["Talep güçlü"],
    warnings: [],
    sourceBreakdown: [
      {
        source: "EasyCep",
        listingCount: 20,
        share: 0.385,
        averagePrice: 24800,
        lowestPrice: 24000,
        highestPrice: 25500,
      },
      {
        source: "Getmobil",
        listingCount: 18,
        share: 0.346,
        averagePrice: 25200,
        lowestPrice: 24500,
        highestPrice: 26000,
      },
      {
        source: "Sahibinden",
        listingCount: 14,
        share: 0.269,
        averagePrice: 25700,
        lowestPrice: 25000,
        highestPrice: 26500,
      },
    ],
    totalListingCount: 52,
    activeListingCount: 49,
    sourceCount: 3,
    duplicateGroupCount: 2,
    duplicatePairCount: 3,
    duplicateItemCount: 4,
    duplicateDensity: 0.08,
    confidenceAverage: 91,
  },
  opportunity: {
    score: 77,
    label: "Normal piyasa",
    explanation: "Fiyat avantajlı.",
    action: "buy_now",
    discountPercent: 12,
  },
  structuredData: {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "iPhone 13 market intelligence",
    description: "summary",
    url: "/product/iphone-13",
    about: {
      "@type": "Product",
      name: "iPhone 13",
      category: "Telefon",
      brand: {
        "@type": "Brand",
        name: "Apple",
      },
    },
    additionalProperty: [],
  },
};

const baseOpportunityAnalysis: OpportunityAnalysis = {
  opportunityScore: 88,
  opportunityLevel: "high",
  riskLevel: "low",
  recommendation: {
    action: "buy_now",
    label: "Şimdi al",
    description:
      "Fiyat avantajı güçlü, güven yüksek ve risk düşük. Şu an almak mantıklı görünüyor.",
  },
  reasons: [
    "Piyasanın %12 altında",
    "Confidence yüksek",
    "52 ilan analiz edildi",
  ],
  warningSignals: ["Bekleme sinyali güçlü"],
  positiveSignals: [
    "Piyasanın %12 altında",
    "Confidence yüksek",
    "52 ilan analiz edildi",
    "3 farklı kaynak doğruladı",
  ],
  scoreGeneratedAt: analyzedAt,
  scoreVersion: "opportunity-score-v1",
  dataFreshness: "fresh",
  sampleSize: 52,
  confidenceLevel: "high",
};

function makeOpportunityAnalysis(
  overrides: Partial<OpportunityAnalysis> = {},
): OpportunityAnalysis {
  return {
    ...structuredClone(baseOpportunityAnalysis),
    ...overrides,
    recommendation: {
      ...structuredClone(baseOpportunityAnalysis.recommendation),
      ...(overrides.recommendation ?? {}),
    },
    reasons: overrides.reasons ?? structuredClone(baseOpportunityAnalysis.reasons),
    warningSignals:
      overrides.warningSignals ?? structuredClone(baseOpportunityAnalysis.warningSignals),
    positiveSignals:
      overrides.positiveSignals ?? structuredClone(baseOpportunityAnalysis.positiveSignals),
  };
}

function makeMarketIntelligence(
  overrides: Partial<MarketIntelligence> = {},
): MarketIntelligence {
  return {
    ...structuredClone(baseMarketIntelligence),
    ...overrides,
    scope: {
      ...structuredClone(baseMarketIntelligence.scope),
      ...(overrides.scope ?? {}),
    },
    priceAnalysis: {
      ...structuredClone(baseMarketIntelligence.priceAnalysis),
      ...(overrides.priceAnalysis ?? {}),
    },
    marketSummary: {
      ...structuredClone(baseMarketIntelligence.marketSummary),
      ...(overrides.marketSummary ?? {}),
    },
    opportunity: {
      ...structuredClone(baseMarketIntelligence.opportunity),
      ...(overrides.opportunity ?? {}),
    },
    structuredData: {
      ...structuredClone(baseMarketIntelligence.structuredData),
      ...(overrides.structuredData ?? {}),
      about: {
        ...structuredClone(baseMarketIntelligence.structuredData.about),
        ...(overrides.structuredData?.about ?? {}),
      },
    },
  };
}

function renderPanel(
  opportunityAnalysis: OpportunityAnalysis = baseOpportunityAnalysis,
  marketIntelligence: MarketIntelligence = baseMarketIntelligence,
) {
  return renderToStaticMarkup(
    <OpportunityScorePanel
      opportunityAnalysis={opportunityAnalysis}
      marketIntelligence={marketIntelligence}
    />,
  );
}

describe("OpportunityScorePanel", () => {
  it("renders the main opportunity score and decision summary", () => {
    const html = renderPanel();

    expect(html).toContain("Fırsat Skoru");
    expect(html).toContain("88");
    expect(html).toContain("Şimdi al");
    expect(html).toContain("Risk seviyesi");
  });

  it("shows the buy_now recommendation label correctly", () => {
    const html = renderPanel(
      makeOpportunityAnalysis({
        recommendation: {
          action: "buy_now",
          label: "Şimdi al",
          description: "Alım için güçlü sinyal.",
        },
      }),
    );

    expect(html).toContain("Şimdi al");
    expect(html).toContain("Alım için güçlü sinyal.");
  });

  it("shows the watch recommendation label correctly", () => {
    const html = renderPanel(
      makeOpportunityAnalysis({
        recommendation: {
          action: "watch",
          label: "Takip et",
          description: "Sinyaller olumlu ama izlemek mantıklı.",
        },
      }),
    );

    expect(html).toContain("Takip et");
    expect(html).toContain("izlemek mantıklı");
  });

  it("shows the wait recommendation label correctly", () => {
    const html = renderPanel(
      makeOpportunityAnalysis({
        recommendation: {
          action: "wait",
          label: "Bekle",
          description: "Daha net fiyat sinyali beklenmeli.",
        },
      }),
    );

    expect(html).toContain("Bekle");
    expect(html).toContain("Daha net fiyat sinyali");
  });

  it("shows the avoid recommendation label correctly", () => {
    const html = renderPanel(
      makeOpportunityAnalysis({
        recommendation: {
          action: "avoid",
          label: "Uzak dur",
          description: "Risk sinyalleri ağır basıyor.",
        },
      }),
    );

    expect(html).toContain("Uzak dur");
    expect(html).toContain("Risk sinyalleri ağır basıyor.");
  });

  it("shows the insufficient data fallback clearly", () => {
    const html = renderPanel(
      makeOpportunityAnalysis({
        sampleSize: 1,
        confidenceLevel: "low",
        recommendation: {
          action: "insufficient_data",
          label: "Veri yetersiz",
          description: "Daha fazla ilan gerekiyor.",
        },
      }),
      makeMarketIntelligence({
        sampleSize: 1,
        confidenceLevel: "low",
        confidenceScore: 30,
        sourcesUsed: ["EasyCep"],
        marketSummary: {
          ...structuredClone(baseMarketIntelligence.marketSummary),
          sourceCount: 1,
          totalListingCount: 1,
          activeListingCount: 1,
        },
      }),
    );

    expect(html).toContain("Yetersiz veri");
    expect(html).toContain("daha fazla ilan ve kaynak gerekiyor");
    expect(html).toContain("Veri yetersiz");
  });

  it("renders positive signals as explanatory chips", () => {
    const html = renderPanel(
      makeOpportunityAnalysis({
        positiveSignals: ["Piyasanın %12 altında", "52 ilan analiz edildi"],
      }),
    );

    expect(html).toContain("Pozitif sinyaller");
    expect(html).toContain("Piyasanın %12 altında");
    expect(html).toContain("52 ilan analiz edildi");
  });

  it("renders warning signals as explanatory chips", () => {
    const html = renderPanel(
      makeOpportunityAnalysis({
        warningSignals: ["Tek kaynak", "Veri eski"],
      }),
    );

    expect(html).toContain("Uyarı sinyalleri");
    expect(html).toContain("Tek kaynak");
    expect(html).toContain("Veri eski");
  });

  it("shows the risk level badge", () => {
    const html = renderPanel(
      makeOpportunityAnalysis({
        riskLevel: "very-high",
      }),
    );

    expect(html).toContain("Risk seviyesi");
    expect(html).toContain("Çok yüksek");
  });

  it("shows sample size and confidence level metadata", () => {
    const html = renderPanel(
      makeOpportunityAnalysis({
        confidenceLevel: "medium",
      }),
    );

    expect(html).toContain("Örneklem büyüklüğü");
    expect(html).toContain("52");
    expect(html).toContain("Güven seviyesi");
    expect(html).toContain("Orta");
  });

  it("shows the generation timestamp and source explanation", () => {
    const html = renderPanel();

    expect(html).toContain("Skor üretim zamanı");
    expect(html).toContain("Kullanılan kaynaklar");
    expect(html).toContain("Bu öneri 52 ilan ve 3 kaynak üzerinden hesaplandı.");
  });

  it("lists the used sources", () => {
    const html = renderPanel();

    expect(html).toContain("EasyCep, Getmobil, Sahibinden");
  });

  it("keeps the responsive grid classes intact", () => {
    const html = renderPanel();

    expect(html).toContain("lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]");
    expect(html).toContain("sm:grid-cols-4");
    expect(html).toContain("lg:grid-cols-2");
  });
});
