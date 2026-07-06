import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CityPageData } from "@/lib/city-intelligence";
import { buildCityJsonLd } from "@/lib/city-intelligence";

const getCityPageDataMock = vi.hoisted(() => vi.fn());
const getBrandCatalogMock = vi.hoisted(() => vi.fn());
const getCategoryCatalogMock = vi.hoisted(() => vi.fn());

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/city-intelligence", async () => {
  const actual = await vi.importActual<typeof import("@/lib/city-intelligence")>(
    "@/lib/city-intelligence",
  );
  return {
    ...actual,
    getCityPageData: getCityPageDataMock,
  };
});

vi.mock("@/lib/brand-intelligence", () => ({
  getBrandCatalog: getBrandCatalogMock,
}));

vi.mock("@/lib/category-intelligence", () => ({
  getCategoryCatalog: getCategoryCatalogMock,
}));

const { default: CityPage, generateMetadata } = await import("./page");

const topOpportunity = {
  productName: "iPhone 13",
  href: "/product/iphone-13",
  listingCount: 12,
  averagePrice: 25500,
  lowestPrice: 23000,
  opportunityLabel: "Güçlü fırsat" as const,
  opportunityScore: 91,
  buyScore: 88,
  decisionLabel: "Şimdi Al" as const,
  trendDirection: "falling" as const,
  trendChangePercent: -7,
  searchCount: 18,
};

const baseCityData = {
  citySlug: "istanbul",
  cityName: "İstanbul",
  cityUrl: "https://2elbul.com/city/istanbul",
  productCount: 8,
  listingCount: 12,
  marketIntelligence: {
    analysisGeneratedAt: "2026-07-05T10:00:00.000Z",
    sampleSize: 12,
    confidenceScore: 94,
    confidenceLevel: "high",
    confidenceReasons: ["İlan sayısı yeterli", "3 farklı kaynak doğruladı"],
    sourcesUsed: ["EasyCep", "Getmobil", "Sahibinden"],
    priceAnalysis: {
      averagePrice: 25500,
      medianPrice: 25000,
      minPrice: 23000,
      maxPrice: 28000,
      priceRange: 5000,
      priceSpreadPercent: 19.6,
      marketValue: 25400,
      listingCount: 12,
      activeListingCount: 11,
      sampleSize: 12,
    },
    marketSummary: {
      summary: "İstanbul için 12 ilan, 3 kaynak ile piyasa resmi çıkarıldı.",
      highlights: ["3 farklı kaynak", "Fiyat bandı dengeli"],
      warnings: [],
      sourceBreakdown: [
        {
          source: "EasyCep",
          listingCount: 5,
          share: 0.417,
          averagePrice: 25200,
          lowestPrice: 23000,
          highestPrice: 27000,
        },
        {
          source: "Getmobil",
          listingCount: 4,
          share: 0.333,
          averagePrice: 25500,
          lowestPrice: 24500,
          highestPrice: 26500,
        },
        {
          source: "Sahibinden",
          listingCount: 3,
          share: 0.25,
          averagePrice: 26000,
          lowestPrice: 25000,
          highestPrice: 28000,
        },
      ],
      totalListingCount: 12,
      activeListingCount: 11,
      sourceCount: 3,
      duplicateGroupCount: 1,
      duplicatePairCount: 2,
      duplicateItemCount: 3,
      duplicateDensity: 0.25,
      confidenceAverage: 91,
    },
    opportunity: {
      score: 90,
      label: "Güçlü fırsat",
      explanation: "Fiyat avantajlı.",
      action: "buy_now",
      discountPercent: 12,
    },
    structuredData: {
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: "İstanbul market intelligence",
      description: "İstanbul için 12 ilan ile piyasa resmi çıkarıldı.",
      url: "https://2elbul.com/city/istanbul",
      about: {
        "@type": "Product",
        name: "İstanbul",
      },
      additionalProperty: [],
    },
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
    reasons: ["Piyasanın altında", "Confidence yüksek"],
    warningSignals: ["Bekleme sinyali düşük"],
    positiveSignals: ["Piyasanın altında", "Confidence yüksek"],
    scoreGeneratedAt: "2026-07-05T10:00:00.000Z",
    scoreVersion: "opportunity-score-v1",
    dataFreshness: "fresh",
    sampleSize: 12,
    confidenceLevel: "high",
  },
  marketPulse: {
    mostSearchedProducts: [topOpportunity],
    mostListedProducts: [topOpportunity],
    topOpportunities: [topOpportunity],
    fallingPriceProducts: [topOpportunity],
    insufficientDataProducts: [],
  },
  duplicateSummary: {
    threshold: 70,
    itemCount: 12,
    groupCount: 1,
    matchedGroupCount: 1,
    duplicatePairCount: 2,
    duplicateItemCount: 3,
    maxGroupSize: 3,
    topGroups: [],
  },
  topOpportunities: [topOpportunity],
  popularProducts: [topOpportunity],
  latestListings: [
    {
      id: "listing-1",
      productId: "product-1",
      productName: "iPhone 13",
      title: "iPhone 13 128 GB",
      price: 23000,
      city: "İstanbul",
      source: "EasyCep",
      url: "https://example.com/listing-1",
      condition: "İkinci El",
      imageUrl: null,
      createdAt: "2026-07-05T09:30:00.000Z",
      updatedAt: "2026-07-05T10:00:00.000Z",
      confidenceScore: 95,
      confidenceLevel: "high",
    },
    {
      id: "listing-2",
      productId: "product-2",
      productName: "Samsung Galaxy S22",
      title: "Galaxy S22 256 GB",
      price: 21000,
      city: "İstanbul",
      source: "Getmobil",
      url: "https://example.com/listing-2",
      condition: "Yenilenmiş",
      imageUrl: null,
      createdAt: "2026-07-04T11:00:00.000Z",
      updatedAt: "2026-07-04T11:00:00.000Z",
      confidenceScore: 88,
      confidenceLevel: "high",
    },
  ],
  brandDistribution: [
    {
      brandSlug: "apple",
      brandName: "Apple",
      productCount: 5,
      listingCount: 8,
      share: 0.667,
    },
    {
      brandSlug: "samsung",
      brandName: "Samsung",
      productCount: 3,
      listingCount: 4,
      share: 0.333,
    },
  ],
  faqItems: [
    {
      question: "İstanbul şehir sayfası nasıl hazırlanıyor?",
      answer: "2ElBul şehir analizlerini bir araya toplar.",
    },
  ],
  jsonLd: buildCityJsonLd({
    cityName: "İstanbul",
    citySlug: "istanbul",
    cityUrl: "https://2elbul.com/city/istanbul",
    summary: "İstanbul için 12 ilan ile piyasa resmi çıkarıldı.",
    faqItems: [
      {
        question: "İstanbul şehir sayfası nasıl hazırlanıyor?",
        answer: "2ElBul şehir analizlerini bir araya toplar.",
      },
    ],
    topOpportunities: [topOpportunity],
  }),
} as unknown as CityPageData;

const insufficientCityData = {
  ...structuredClone(baseCityData),
  listingCount: 1,
  marketIntelligence: {
    ...structuredClone(baseCityData.marketIntelligence),
    sampleSize: 1,
    confidenceScore: 24,
    confidenceLevel: "low",
    confidenceReasons: ["Tek kaynak"],
    sourcesUsed: ["EasyCep"],
    priceAnalysis: {
      ...structuredClone(baseCityData.marketIntelligence.priceAnalysis),
      averagePrice: null,
      medianPrice: null,
      minPrice: null,
      maxPrice: null,
      priceRange: null,
      priceSpreadPercent: null,
      marketValue: null,
      listingCount: 1,
      activeListingCount: 1,
      sampleSize: 1,
    },
    marketSummary: {
      ...structuredClone(baseCityData.marketIntelligence.marketSummary),
      summary: "İstanbul için henüz yeterli piyasa verisi oluşmadı.",
      highlights: [],
      warnings: ["Örneklem küçük."],
      sourceBreakdown: [
        {
          source: "EasyCep",
          listingCount: 1,
          share: 1,
          averagePrice: 25500,
          lowestPrice: 25500,
          highestPrice: 25500,
        },
      ],
      totalListingCount: 1,
      activeListingCount: 1,
      sourceCount: 1,
      duplicateDensity: 0,
      confidenceAverage: 24,
    },
    opportunity: {
      ...structuredClone(baseCityData.marketIntelligence.opportunity),
      score: 22,
      label: "Veri yetersiz",
      action: "insufficient_data",
    },
  },
  opportunityAnalysis: {
    ...structuredClone(baseCityData.opportunityAnalysis),
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
    dataFreshness: "stale",
    sampleSize: 1,
    confidenceLevel: "low",
  },
  topOpportunities: [],
  popularProducts: [],
  latestListings: [],
  brandDistribution: [],
  faqItems: baseCityData.faqItems,
  jsonLd: buildCityJsonLd({
    cityName: "İstanbul",
    citySlug: "istanbul",
    cityUrl: "https://2elbul.com/city/istanbul",
    summary: "İstanbul için henüz yeterli piyasa verisi oluşmadı.",
    faqItems: baseCityData.faqItems,
    topOpportunities: [],
  }),
} as unknown as CityPageData;

describe("city page metadata", () => {
  beforeEach(() => {
    getCityPageDataMock.mockReset();
  });

  it("uses the canonical city URL in metadata", async () => {
    getCityPageDataMock.mockResolvedValueOnce(baseCityData);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "istanbul" }),
    });

    expect(metadata.title).toBe("İstanbul ikinci el piyasa analizi | 2ElBul");
    expect(metadata.alternates?.canonical).toBe("https://2elbul.com/city/istanbul");
    expect(metadata.openGraph?.url).toBe("https://2elbul.com/city/istanbul");
  });

  it("returns noindex metadata for an unknown city", async () => {
    getCityPageDataMock.mockResolvedValueOnce(null);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "bilinmeyen-sehir" }),
    });

    const robots = metadata.robots;
    expect(typeof robots).toBe("object");
    expect((robots as { index: boolean }).index).toBe(false);
    expect((robots as { follow: boolean }).follow).toBe(false);
  });
});

describe("city page render", () => {
  beforeEach(() => {
    getCityPageDataMock.mockReset();
    getBrandCatalogMock.mockReset();
    getCategoryCatalogMock.mockReset();
    getBrandCatalogMock.mockResolvedValue([
      { slug: "apple", name: "Apple", productCount: 5, latestProductAt: null },
    ]);
    getCategoryCatalogMock.mockResolvedValue([
      { slug: "telefon", label: "Telefon", productCount: 8, latestListingAt: null },
    ]);
  });

  it("renders the decision focused city dashboard", async () => {
    getCityPageDataMock.mockResolvedValueOnce(baseCityData);

    const html = renderToStaticMarkup(
      await CityPage({
        params: Promise.resolve({ slug: "istanbul" }),
      }),
    );

    expect(html).toContain("İstanbul");
    expect(html).toContain("Şehir analizi");
    expect(html).toContain("Karar özeti");
    expect(html).toContain("En İyi Fırsatlar");
    expect(html).toContain("En Popüler Ürünler");
    expect(html).toContain("Son Eklenen İlanlar");
    expect(html).toContain("Şehirdeki Markalar");
    expect(html).toContain("Bu şehir sayfası yeterli veriyle oluşturuldu.");
  });

  it("emits breadcrumb, FAQ, CollectionPage and ItemList JSON-LD scripts", async () => {
    getCityPageDataMock.mockResolvedValueOnce(baseCityData);

    const html = renderToStaticMarkup(
      await CityPage({
        params: Promise.resolve({ slug: "istanbul" }),
      }),
    );

    expect(html).toContain("BreadcrumbList");
    expect(html).toContain("FAQPage");
    expect(html).toContain("ItemList");
    expect(html).toContain("CollectionPage");
    expect(html).toContain("\"@type\":\"Place\"");
  });

  it("renders the decision dashboard stats (active listings, average, min, median, source, confidence)", async () => {
    getCityPageDataMock.mockResolvedValueOnce(baseCityData);

    const html = renderToStaticMarkup(
      await CityPage({
        params: Promise.resolve({ slug: "istanbul" }),
      }),
    );

    expect(html).toContain("Aktif ilan");
    expect(html).toContain("Ortalama fiyat");
    expect(html).toContain("En düşük fiyat");
    expect(html).toContain("Medyan fiyat");
    expect(html).toContain("Kaynak sayısı");
    expect(html).toContain("Confidence");
    expect(html).toContain("Risk seviyesi");
    expect(html).toContain("Son güncelleme");
  });

  it("renders popular products and opportunity cards with product links", async () => {
    getCityPageDataMock.mockResolvedValueOnce(baseCityData);

    const html = renderToStaticMarkup(
      await CityPage({
        params: Promise.resolve({ slug: "istanbul" }),
      }),
    );

    expect(html).toContain("iPhone 13");
    expect(html).toContain("Ürün detayına git");
    expect(html).toContain("Piyasa avantajı");
  });

  it("renders latest listings with source, city and external link", async () => {
    getCityPageDataMock.mockResolvedValueOnce(baseCityData);

    const html = renderToStaticMarkup(
      await CityPage({
        params: Promise.resolve({ slug: "istanbul" }),
      }),
    );

    expect(html).toContain("Galaxy S22 256 GB");
    expect(html).toContain("https://example.com/listing-2");
    expect(html).toContain("İlana Git");
  });

  it("renders brand distribution with brand links and share bars", async () => {
    getCityPageDataMock.mockResolvedValueOnce(baseCityData);

    const html = renderToStaticMarkup(
      await CityPage({
        params: Promise.resolve({ slug: "istanbul" }),
      }),
    );

    expect(html).toContain("/brand/apple");
    expect(html).toContain("/brand/samsung");
    expect(html).toContain("Apple");
    expect(html).toContain("Samsung");
  });

  it("renders internal links to market, search, brand and category pages", async () => {
    getCityPageDataMock.mockResolvedValueOnce(baseCityData);

    const html = renderToStaticMarkup(
      await CityPage({
        params: Promise.resolve({ slug: "istanbul" }),
      }),
    );

    expect(html).toContain("/market");
    expect(html).toContain("/search?q=");
    expect(html).toContain("/brand/apple");
    expect(html).toContain("/category/telefon");
  });

  it("renders safe fallbacks when the city has insufficient data", async () => {
    getCityPageDataMock.mockResolvedValueOnce(insufficientCityData);

    const html = renderToStaticMarkup(
      await CityPage({
        params: Promise.resolve({ slug: "istanbul" }),
      }),
    );

    expect(html).toContain("Yetersiz veri");
    expect(html).toContain("Bu şehir için henüz yeterli fırsat sinyali oluşmadı.");
    expect(html).toContain("Bu şehir için henüz popüler ürün sinyali oluşmadı.");
    expect(html).toContain("Bu şehir için henüz yeni ilan bulunmuyor.");
    expect(html).toContain("Bu şehir için henüz marka dağılımı oluşmadı.");
  });

  it("renders the FAQ section with city-safe questions", async () => {
    getCityPageDataMock.mockResolvedValueOnce(baseCityData);

    const html = renderToStaticMarkup(
      await CityPage({
        params: Promise.resolve({ slug: "istanbul" }),
      }),
    );

    expect(html).toContain("Sık sorulanlar");
    expect(html).toContain("İstanbul şehir sayfası nasıl hazırlanıyor?");
  });

  it("renders the Market Intelligence summary and Opportunity signals", async () => {
    getCityPageDataMock.mockResolvedValueOnce(baseCityData);

    const html = renderToStaticMarkup(
      await CityPage({
        params: Promise.resolve({ slug: "istanbul" }),
      }),
    );

    expect(html).toContain("Market Intelligence özeti");
    expect(html).toContain("3 farklı kaynak");
    expect(html).toContain("Confidence Özeti");
  });

  it("throws notFound for unknown cities", async () => {
    getCityPageDataMock.mockResolvedValueOnce(null);

    await expect(
      CityPage({
        params: Promise.resolve({ slug: "bilinmeyen-sehir" }),
      }),
    ).rejects.toThrow();
  });
});
