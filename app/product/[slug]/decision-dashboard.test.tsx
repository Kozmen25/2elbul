import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Listing } from "@/lib/listings";
import { buildProductPriceStats } from "@/lib/price-analysis";
import type {
  ProductDecisionInsight,
  ProductDetailMarketIntelligence,
  ProductRecord,
} from "@/lib/product-detail";
import {
  BestDealCard,
  DecisionDashboardHero,
} from "./page";

vi.mock("@/components/favorite-button", () => ({
  FavoriteButton: () => <button type="button">Favori</button>,
}));

vi.mock("@/components/listing-image", () => ({
  ListingImage: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

const analyzedAt = "2026-07-05T10:30:00.000Z";

const product: ProductRecord = {
  id: "product-1",
  name: "iPhone 13",
  slug: "iphone-13",
  category: "Telefon",
};

const decisionInsight: ProductDecisionInsight = {
  confidence: {
    score: 92,
    level: "Yüksek güven",
    description: "Bu ürün için fiyat verisi tutarlı ve karar desteği güçlü.",
    reasons: ["Model aynı", "Örneklem yeterli"],
    warnings: [],
    className: "border-green-200 bg-green-50 text-green-700",
  },
  smartPrice: {
    summary: "iPhone 13 için ortalama ikinci el fiyat ₺25.000.",
    details: ["Fiyatlar birbirine yakın."],
    warnings: [],
  },
};

const marketIntelligence: ProductDetailMarketIntelligence = {
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
    summary: "Talep güçlü, fiyat bandı dengeli.",
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
  opportunityAnalysis: {
    opportunityScore: 88,
    opportunityLevel: "high",
    riskLevel: "low",
    recommendation: {
      action: "buy_now",
      label: "Şimdi al",
      description: "Fiyat avantajı güçlü, güven yüksek.",
    },
    reasons: [
      "Piyasanın %12 altında",
      "Confidence yüksek",
      "52 ilan analiz edildi",
    ],
    warningSignals: ["Bekleme sinyali düşük"],
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
  },
  structuredData: {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "iPhone 13 market intelligence",
    description: "Talep güçlü, fiyat bandı dengeli.",
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

const insufficientMarketIntelligence: ProductDetailMarketIntelligence = {
  ...structuredClone(marketIntelligence),
  sampleSize: 1,
  confidenceScore: 28,
  confidenceLevel: "low",
  confidenceReasons: ["Tek kaynak"],
  sourcesUsed: ["EasyCep"],
  priceAnalysis: {
    ...structuredClone(marketIntelligence.priceAnalysis),
    averagePrice: 0,
    medianPrice: 0,
    minPrice: 0,
    maxPrice: 0,
    priceRange: 0,
    priceSpreadPercent: 0,
    marketValue: 0,
    listingCount: 1,
    activeListingCount: 1,
    sampleSize: 1,
  },
  marketSummary: {
    ...structuredClone(marketIntelligence.marketSummary),
    summary: "Henüz yeterli piyasa verisi oluşmadı.",
    sourceCount: 1,
    totalListingCount: 1,
    activeListingCount: 1,
    duplicateDensity: 0,
    sourceBreakdown: [
      {
        source: "EasyCep",
        listingCount: 1,
        share: 1,
        averagePrice: 28500,
        lowestPrice: 28500,
        highestPrice: 28500,
      },
    ],
  },
  opportunityAnalysis: {
    ...structuredClone(marketIntelligence.opportunityAnalysis),
    opportunityScore: 22,
    opportunityLevel: "low",
    riskLevel: "high",
    recommendation: {
      action: "insufficient_data",
      label: "Veri yetersiz",
      description: "Daha fazla ilan gerekiyor.",
    },
    reasons: ["Tek kaynak"],
    warningSignals: ["Tek kaynak"],
    positiveSignals: [],
    scoreGeneratedAt: analyzedAt,
    dataFreshness: "stale",
    sampleSize: 1,
    confidenceLevel: "low",
  },
  structuredData: {
    ...structuredClone(marketIntelligence.structuredData),
    additionalProperty: [],
  },
};

function makeListing(): Listing {
  return {
    id: "listing-1",
    productId: "product-1",
    title: "iPhone 13 128 GB",
    productName: "iPhone 13",
    price: 23000,
    city: "İstanbul",
    source: "Sahibinden" as Listing["source"],
    url: "https://example.com/listing/1",
    condition: "İkinci El" as Listing["condition"],
    imageUrl: null,
    createdAt: "2026-07-04T09:00:00.000Z",
    updatedAt: "2026-07-05T10:00:00.000Z",
  };
}

function renderHero(
  intelligence: ProductDetailMarketIntelligence = marketIntelligence,
) {
  return renderToStaticMarkup(
    <DecisionDashboardHero
      product={product}
      marketIntelligence={intelligence}
      decisionInsight={decisionInsight}
      bestDealDiscount={12}
    />,
  );
}

function renderBestDeal(listing: Listing | null = makeListing()) {
  const priceStats =
    buildProductPriceStats([
      { productId: product.id, price: 23000 },
      { productId: product.id, price: 25000 },
      { productId: product.id, price: 28500 },
    ])[product.id] ?? null;

  return renderToStaticMarkup(
    <BestDealCard
      listing={listing}
      averagePrice={25000}
      discountPercent={12}
      priceStats={priceStats}
      isFavorite={false}
      isAuthenticated={false}
      loginNext="/product/iphone-13"
    />,
  );
}

describe("DecisionDashboardHero", () => {
  it("renders the dashboard headline and opportunity score", () => {
    const html = renderHero();

    expect(html).toContain("Karar paneli");
    expect(html).toContain("AI Kararı");
    expect(html).toContain("88");
    expect(html).toContain("Şimdi al");
  });

  it("shows opportunity, risk and confidence signals", () => {
    const html = renderHero();

    expect(html).toContain("Güçlü fırsat mı?");
    expect(html).toContain("Risk:");
    expect(html).toContain("Confidence skoru");
    expect(html).toContain("Confidence seviyesi");
  });

  it("shows the key price metrics on the first screen", () => {
    const html = renderHero();

    expect(html).toContain("Ortalama fiyat");
    expect(html).toContain("En düşük fiyat");
    expect(html).toContain("Medyan fiyat");
    expect(html).toContain("Fiyat avantajı");
  });

  it("shows sample size, source count and last update", () => {
    const html = renderHero();

    expect(html).toContain("Örneklem");
    expect(html).toContain("Kaynak sayısı");
    expect(html).toContain("Son güncelleme");
    expect(html).toContain("Bu analiz 52 ilan üzerinden oluşturuldu.");
  });

  it("shows the source list and EEAT note", () => {
    const html = renderHero();

    expect(html).toContain("Kullanılan kaynaklar");
    expect(html).toContain("EasyCep, Getmobil, Sahibinden");
    expect(html).toContain("EEAT notu");
  });

  it("renders the responsive dashboard classes", () => {
    const html = renderHero();

    expect(html).toContain("lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]");
    expect(html).toContain("sm:grid-cols-3");
    expect(html).toContain("sm:grid-cols-2");
  });

  it("shows the insufficient data fallback", () => {
    const html = renderHero(insufficientMarketIntelligence);

    expect(html).toContain("Yetersiz veri");
    expect(html).toContain("karar notu daha fazla ilan geldikçe otomatik olarak güçlenecek");
  });
});

describe("BestDealCard", () => {
  it("renders the featured best listing and CTA", () => {
    const html = renderBestDeal();

    expect(html).toContain("En iyi ilan");
    expect(html).toContain("En avantajlı ilan");
    expect(html).toContain("iPhone 13 128 GB");
    expect(html).toContain("İlana git");
  });

  it("shows the price advantage copy", () => {
    const html = renderBestDeal();

    expect(html).toContain("Ortalama fiyata göre %12 daha ucuz.");
    expect(html).toContain("₺23.000");
  });

  it("renders the compact favorite control in the featured card", () => {
    const html = renderBestDeal();

    expect(html).toContain("Favori");
  });

  it("renders a fallback when no featured listing exists", () => {
    const html = renderBestDeal(null);

    expect(html).toContain("Henüz ilan yok");
    expect(html).toContain("en düşük fiyatlı seçenek burada görünecek");
  });

  it("keeps the featured card responsive classes", () => {
    const html = renderBestDeal();

    expect(html).toContain("rounded-3xl border border-[#ff6b00]/20 bg-[#fff7f1]");
    expect(html).toContain("orange-button flex-1 py-3");
  });
});
