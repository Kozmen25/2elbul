import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CategoryPageData } from "@/lib/category-intelligence";
import { buildCategoryJsonLd } from "@/lib/category-intelligence";

const getCategoryPageDataMock = vi.hoisted(() => vi.fn());

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

vi.mock("@/lib/category-intelligence", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/category-intelligence")>(
      "@/lib/category-intelligence",
    );

  return {
    ...actual,
    getCategoryPageData: getCategoryPageDataMock,
  };
});

const { default: CategoryPage, generateMetadata } = await import("./page");

const phoneRoute = {
  slug: "telefon",
  label: "Telefon",
  shortDescription: "Cep telefonu ikinci el piyasa analizi",
  longDescription: "iPhone, Samsung Galaxy ve diğer telefonlar için ikinci el fiyat rehberi.",
  matchKeywords: ["telefon", "iphone"],
  excludeKeywords: ["tablet"],
};

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

const baseCategoryData = {
  categorySlug: "telefon",
  categoryName: "Telefon",
  categoryUrl: "https://2elbul.com/category/telefon",
  shortDescription: "Cep telefonu ikinci el piyasa analizi",
  longDescription:
    "iPhone, Samsung Galaxy ve diğer telefonlar için ikinci el fiyat rehberi.",
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
      summary: "Telefon için 12 ilan, 3 kaynak ile piyasa resmi çıkarıldı.",
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
      name: "Telefon market intelligence",
      description: "Telefon için 12 ilan ile piyasa resmi çıkarıldı.",
      url: "https://2elbul.com/category/telefon",
      about: {
        "@type": "Product",
        name: "Telefon",
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
      source: "EasyCep",
      city: "İstanbul",
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
      source: "Getmobil",
      city: "Ankara",
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
      question: "Telefon kategori sayfası nasıl hazırlanıyor?",
      answer: "2ElBul kategori analizlerini bir araya toplar.",
    },
  ],
  jsonLd: buildCategoryJsonLd({
    route: phoneRoute,
    categoryUrl: "https://2elbul.com/category/telefon",
    summary: "Telefon için 12 ilan ile piyasa resmi çıkarıldı.",
    faqItems: [
      {
        question: "Telefon kategori sayfası nasıl hazırlanıyor?",
        answer: "2ElBul kategori analizlerini bir araya toplar.",
      },
    ],
    topOpportunities: [topOpportunity],
  }),
} as unknown as CategoryPageData;

const insufficientCategoryData = {
  ...structuredClone(baseCategoryData),
  listingCount: 1,
  marketIntelligence: {
    ...structuredClone(baseCategoryData.marketIntelligence),
    sampleSize: 1,
    confidenceScore: 24,
    confidenceLevel: "low",
    confidenceReasons: ["Tek kaynak"],
    sourcesUsed: ["EasyCep"],
    priceAnalysis: {
      ...structuredClone(baseCategoryData.marketIntelligence.priceAnalysis),
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
      ...structuredClone(baseCategoryData.marketIntelligence.marketSummary),
      summary: "Telefon için henüz yeterli piyasa verisi oluşmadı.",
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
      ...structuredClone(baseCategoryData.marketIntelligence.opportunity),
      score: 22,
      label: "Veri yetersiz",
      action: "insufficient_data",
    },
  },
  opportunityAnalysis: {
    ...structuredClone(baseCategoryData.opportunityAnalysis),
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
  faqItems: baseCategoryData.faqItems,
  jsonLd: buildCategoryJsonLd({
    route: phoneRoute,
    categoryUrl: "https://2elbul.com/category/telefon",
    summary: "Telefon için henüz yeterli piyasa verisi oluşmadı.",
    faqItems: baseCategoryData.faqItems,
    topOpportunities: [],
  }),
} as unknown as CategoryPageData;

describe("category page metadata", () => {
  beforeEach(() => {
    getCategoryPageDataMock.mockReset();
  });

  it("uses the canonical category URL in metadata", async () => {
    getCategoryPageDataMock.mockResolvedValueOnce(baseCategoryData);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "telefon" }),
    });

    expect(metadata.title).toBe("Telefon ikinci el kategori analizi | 2ElBul");
    expect(metadata.alternates?.canonical).toBe(
      "https://2elbul.com/category/telefon",
    );
    expect(metadata.openGraph?.url).toBe("https://2elbul.com/category/telefon");
    expect(metadata.twitter).toBeDefined();
  });

  it("returns noindex metadata for an unknown category", async () => {
    getCategoryPageDataMock.mockResolvedValueOnce(null);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "bilinmeyen" }),
    });

    const robots = metadata.robots;
    expect(typeof robots).toBe("object");
    expect((robots as { index: boolean }).index).toBe(false);
    expect((robots as { follow: boolean }).follow).toBe(false);
  });
});

describe("category page render", () => {
  beforeEach(() => {
    getCategoryPageDataMock.mockReset();
  });

  it("renders the decision focused category dashboard", async () => {
    getCategoryPageDataMock.mockResolvedValueOnce(baseCategoryData);

    const html = renderToStaticMarkup(
      await CategoryPage({
        params: Promise.resolve({ slug: "telefon" }),
      }),
    );

    expect(html).toContain("Telefon");
    expect(html).toContain("Kategori analizi");
    expect(html).toContain("En İyi Fırsatlar");
    expect(html).toContain("En Popüler Ürünler");
    expect(html).toContain("Son Eklenen İlanlar");
    expect(html).toContain("Kategorideki Markalar");
    expect(html).toContain("İlana Git");
    expect(html).toContain("Bu kategori sayfası yeterli veriyle oluşturuldu.");
  });

  it("emits breadcrumb, FAQ and ItemList JSON-LD scripts", async () => {
    getCategoryPageDataMock.mockResolvedValueOnce(baseCategoryData);

    const html = renderToStaticMarkup(
      await CategoryPage({
        params: Promise.resolve({ slug: "telefon" }),
      }),
    );

    expect(html).toContain("BreadcrumbList");
    expect(html).toContain("FAQPage");
    expect(html).toContain("ItemList");
    expect(html).toContain("CollectionPage");
  });

  it("renders the category stats (sample size, average, min, source count)", async () => {
    getCategoryPageDataMock.mockResolvedValueOnce(baseCategoryData);

    const html = renderToStaticMarkup(
      await CategoryPage({
        params: Promise.resolve({ slug: "telefon" }),
      }),
    );

    expect(html).toContain("Analiz edilen ilan");
    expect(html).toContain("Ortalama fiyat");
    expect(html).toContain("En düşük fiyat");
    expect(html).toContain("Kaynak sayısı");
    expect(html).toContain("Risk seviyesi");
  });

  it("renders popular products and opportunity cards", async () => {
    getCategoryPageDataMock.mockResolvedValueOnce(baseCategoryData);

    const html = renderToStaticMarkup(
      await CategoryPage({
        params: Promise.resolve({ slug: "telefon" }),
      }),
    );

    expect(html).toContain("iPhone 13");
    expect(html).toContain("Ürün detayına git");
    expect(html).toContain("Piyasa avantajı");
  });

  it("renders latest listings with source, city and external link", async () => {
    getCategoryPageDataMock.mockResolvedValueOnce(baseCategoryData);

    const html = renderToStaticMarkup(
      await CategoryPage({
        params: Promise.resolve({ slug: "telefon" }),
      }),
    );

    expect(html).toContain("Galaxy S22 256 GB");
    expect(html).toContain("https://example.com/listing-2");
    expect(html).toContain("İstanbul");
  });

  it("renders brand distribution with brand links and share bars", async () => {
    getCategoryPageDataMock.mockResolvedValueOnce(baseCategoryData);

    const html = renderToStaticMarkup(
      await CategoryPage({
        params: Promise.resolve({ slug: "telefon" }),
      }),
    );

    expect(html).toContain("/brand/apple");
    expect(html).toContain("/brand/samsung");
    expect(html).toContain("Apple");
    expect(html).toContain("Samsung");
  });

  it("renders internal links to market center and category search", async () => {
    getCategoryPageDataMock.mockResolvedValueOnce(baseCategoryData);

    const html = renderToStaticMarkup(
      await CategoryPage({
        params: Promise.resolve({ slug: "telefon" }),
      }),
    );

    expect(html).toContain("/market");
    expect(html).toContain("/search?q=");
  });

  it("renders safe fallbacks when the category has insufficient data", async () => {
    getCategoryPageDataMock.mockResolvedValueOnce(insufficientCategoryData);

    const html = renderToStaticMarkup(
      await CategoryPage({
        params: Promise.resolve({ slug: "telefon" }),
      }),
    );

    expect(html).toContain("Yetersiz veri");
    expect(html).toContain("Bu kategori için henüz yeterli fırsat sinyali oluşmadı.");
    expect(html).toContain("Bu kategori için henüz popüler ürün sinyali oluşmadı.");
    expect(html).toContain("Bu kategori için henüz yeni ilan bulunmuyor.");
    expect(html).toContain("Bu kategori için henüz marka dağılımı oluşmadı.");
  });

  it("renders the FAQ section with category-safe questions", async () => {
    getCategoryPageDataMock.mockResolvedValueOnce(baseCategoryData);

    const html = renderToStaticMarkup(
      await CategoryPage({
        params: Promise.resolve({ slug: "telefon" }),
      }),
    );

    expect(html).toContain("Sık sorulanlar");
    expect(html).toContain("Telefon kategori sayfası nasıl hazırlanıyor?");
  });

  it("throws notFound for unknown categories", async () => {
    getCategoryPageDataMock.mockResolvedValueOnce(null);

    await expect(
      CategoryPage({
        params: Promise.resolve({ slug: "bilinmeyen" }),
      }),
    ).rejects.toThrow();
  });
});
