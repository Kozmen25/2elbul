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
  DecisionDashboardHero,
  ProductSummary,
} from "./page";

vi.mock("@/components/favorite-button", () => ({
  FavoriteButton: () => <button type="button">Favori</button>,
}));

vi.mock("@/components/follow-product-button", () => ({
  FollowProductButton: () => <button type="button">Ürünü takip et</button>,
}));

vi.mock("@/components/compare-button", () => ({
  CompareButton: () => <button type="button">Karşılaştır</button>,
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
  categoryPath: [{ slug: "telefon", label: "Telefon" }],
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
      "Güven yüksek",
      "52 ilan analiz edildi",
    ],
    warningSignals: ["Bekleme sinyali düşük"],
    positiveSignals: [
      "Piyasanın %12 altında",
      "Güven yüksek",
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
      marketIntelligence={intelligence}
      decisionInsight={decisionInsight}
      bestDealDiscount={12}
    />,
  );
}

function renderSummary(listing: Listing | null = makeListing()) {
  const priceStats =
    buildProductPriceStats([
      { productId: product.id, price: 23000 },
      { productId: product.id, price: 25000 },
      { productId: product.id, price: 28500 },
    ])[product.id] ?? null;

  return renderToStaticMarkup(
    <ProductSummary
      product={product}
      listing={listing}
      averagePrice={25000}
      listingCount={3}
      discountPercent={12}
      priceStats={priceStats}
      decisionLabel="Şimdi al"
      isFollowing={false}
      isFavorite={false}
      isAuthenticated={false}
      loginNext="/product/iphone-13"
    />,
  );
}

describe("DecisionDashboardHero", () => {
  it("renders the dashboard headline and opportunity score", () => {
    const html = renderHero();

    expect(html).toContain("AI Kararı");
    expect(html).toContain("88");
    expect(html).toContain("Şimdi al");
  });

  it("shows opportunity, risk and confidence signals", () => {
    const html = renderHero();

    expect(html).toContain("Güçlü fırsat mı?");
    expect(html).toContain("Risk:");
    expect(html).toContain("Güven skoru");
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
  });

  it("lists the sources once and drops the repeated technical blocks", () => {
    const html = renderHero();

    expect(html).toContain("Kullanılan kaynaklar");
    expect(html).toContain("EasyCep, Getmobil, Sahibinden");
    expect(html).not.toContain("EEAT notu");
    expect(html).not.toContain("Kaynak sinyalleri");
    expect(html).not.toContain("Duplicate yoğunluğu");
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

describe("ProductSummary", () => {
  it("leads with the product name, price, location, condition and source", () => {
    const html = renderSummary();

    expect(html).toContain("<h1");
    expect(html).toContain("iPhone 13");
    expect(html).toContain("₺23.000");
    expect(html).toContain("İstanbul");
    expect(html).toContain("İkinci El");
    expect(html).toContain("Sahibinden");
    expect(html).toContain("İlana git");
  });

  it("keeps the price context to one short line", () => {
    const html = renderSummary();

    expect(html).toContain("3 ilan");
    expect(html).toContain("ortalamanın %12 altında");
    expect(html).not.toContain("Karar odaklı");
  });

  it("links to the market analysis below instead of showing it", () => {
    const html = renderSummary();

    expect(html).toContain('href="#piyasa-analizi"');
    expect(html).toContain("Şimdi al");
    expect(html).not.toContain("Fırsat skoru");
  });

  it("renders the favorite and compare controls", () => {
    const html = renderSummary();

    expect(html).toContain("Favori");
    expect(html).toContain("Karşılaştır");
    expect(html).toContain("Ürünü takip et");
  });

  it("explains an empty product without a listing block", () => {
    const html = renderSummary(null);

    expect(html).toContain("<h1");
    expect(html).toContain("yayında ilan yok");
    expect(html).not.toContain("İlana git");
  });
});
