import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BrandPageData } from "@/lib/brand-intelligence";
import { buildBrandJsonLd } from "@/lib/brand-intelligence";

const getBrandPageDataMock = vi.hoisted(() => vi.fn());

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

vi.mock("@/lib/brand-intelligence", async () => {
  const actual = await vi.importActual<typeof import("@/lib/brand-intelligence")>(
    "@/lib/brand-intelligence",
  );

  return {
    ...actual,
    getBrandPageData: getBrandPageDataMock,
  };
});

const { default: BrandPage, generateMetadata } = await import("./page");

describe("brand page", () => {
  beforeEach(() => {
    getBrandPageDataMock.mockReset();
  });

  it("uses the canonical brand URL in metadata", async () => {
    getBrandPageDataMock.mockResolvedValueOnce(baseBrandData);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "msi" }),
    });

    expect(metadata.title).toBe("MSI ikinci el marka analizi | 2ElBul");
    expect(metadata.alternates?.canonical).toBe("https://2elbul.com/brand/msi");
    expect(metadata.openGraph?.url).toBe("https://2elbul.com/brand/msi");
  });

  it("renders the decision focused brand dashboard", async () => {
    getBrandPageDataMock.mockResolvedValueOnce(baseBrandData);

    const html = renderToStaticMarkup(
      await BrandPage({
        params: Promise.resolve({ slug: "msi" }),
      }),
    );

    expect(html).toContain("MSI");
    expect(html).toContain("En İyi Fırsatlar");
    expect(html).toContain("En Popüler Ürünler");
    expect(html).toContain("Son Eklenen İlanlar");
    expect(html).toContain("İlana Git");
    expect(html).toContain("Bu marka sayfası yeterli veriyle oluşturuldu.");
    expect(html).toContain("BreadcrumbList");
    expect(html).toContain("FAQPage");
    expect(html).toContain("ItemList");
  });

  it("renders safe fallbacks when the brand has insufficient data", async () => {
    getBrandPageDataMock.mockResolvedValueOnce(insufficientBrandData);

    const html = renderToStaticMarkup(
      await BrandPage({
        params: Promise.resolve({ slug: "msi" }),
      }),
    );

    expect(html).toContain("Yetersiz veri");
    expect(html).toContain("Bu marka için henüz yeterli fırsat sinyali oluşmadı.");
    expect(html).toContain("Bu marka için henüz popüler ürün sinyali oluşmadı.");
    expect(html).toContain("Bu marka için henüz yeni ilan bulunmuyor.");
  });
});

const topOpportunity = {
  productName: "MSI Katana 15",
  href: "/product/msi-katana-15",
  listingCount: 4,
  averagePrice: 34999,
  lowestPrice: 32999,
  opportunityLabel: "Güçlü fırsat" as const,
  opportunityScore: 91,
  buyScore: 88,
  decisionLabel: "Şimdi Al" as const,
  trendDirection: "falling" as const,
  trendChangePercent: -7,
  searchCount: 18,
};

const baseBrandData = {
  brandSlug: "msi",
  brandName: "MSI",
  brandUrl: "https://2elbul.com/brand/msi",
  productCount: 4,
  listingCount: 12,
  marketIntelligence: {
    analysisGeneratedAt: "2026-07-05T10:00:00.000Z",
    sampleSize: 12,
    confidenceScore: 94,
    confidenceLevel: "high",
    confidenceReasons: ["İlan sayısı yeterli", "3 farklı kaynak doğruladı"],
    sourcesUsed: ["EasyCep", "Getmobil", "Sahibinden"],
    priceAnalysis: {
      averagePrice: 34999,
      medianPrice: 34500,
      minPrice: 32999,
      maxPrice: 37999,
      priceRange: 5000,
      priceSpreadPercent: 14.3,
      marketValue: 34800,
      listingCount: 12,
      activeListingCount: 11,
      sampleSize: 12,
    },
    marketSummary: {
      summary: "MSI için piyasa özeti.",
      highlights: ["3 farklı kaynak", "Fiyat bandı dengeli"],
      warnings: [],
      sourceBreakdown: [
        {
          source: "EasyCep",
          listingCount: 5,
          share: 0.417,
          averagePrice: 34500,
          lowestPrice: 32999,
          highestPrice: 36000,
        },
        {
          source: "Getmobil",
          listingCount: 4,
          share: 0.333,
          averagePrice: 35000,
          lowestPrice: 34000,
          highestPrice: 36500,
        },
        {
          source: "Sahibinden",
          listingCount: 3,
          share: 0.25,
          averagePrice: 35500,
          lowestPrice: 34999,
          highestPrice: 37999,
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
      name: "MSI market intelligence",
      description: "MSI için piyasa özeti.",
      url: "https://2elbul.com/brand/msi",
      about: {
        "@type": "Product",
        name: "MSI",
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
      productName: "MSI Katana 15",
      title: "MSI Katana 15 16GB 512GB",
      price: 32999,
      source: "EasyCep",
      city: "İstanbul",
      url: "https://example.com/msi-1",
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
      productName: "MSI Thin GF63",
      title: "MSI Thin GF63 16GB 512GB",
      price: 35999,
      source: "Getmobil",
      city: "Ankara",
      url: "https://example.com/msi-2",
      condition: "Yenilenmiş",
      imageUrl: null,
      createdAt: "2026-07-04T11:00:00.000Z",
      updatedAt: "2026-07-04T11:00:00.000Z",
      confidenceScore: 88,
      confidenceLevel: "high",
    },
  ],
  faqItems: [
    {
      question: "MSI marka sayfası nasıl hazırlanıyor?",
      answer: "2ElBul brand analysis.",
    },
  ],
  jsonLd: buildBrandJsonLd({
    brandName: "MSI",
    brandUrl: "https://2elbul.com/brand/msi",
    summary: "MSI için piyasa özeti.",
    faqItems: [
      {
        question: "MSI marka sayfası nasıl hazırlanıyor?",
        answer: "2ElBul brand analysis.",
      },
    ],
    topOpportunities: [topOpportunity],
  }),
} as unknown as BrandPageData;

const insufficientBrandData = {
  ...structuredClone(baseBrandData),
  listingCount: 1,
  marketIntelligence: {
    ...structuredClone(baseBrandData.marketIntelligence),
    sampleSize: 1,
    confidenceScore: 24,
    confidenceLevel: "low",
    confidenceReasons: ["Tek kaynak"],
    sourcesUsed: ["EasyCep"],
    priceAnalysis: {
      ...structuredClone(baseBrandData.marketIntelligence.priceAnalysis),
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
      ...structuredClone(baseBrandData.marketIntelligence.marketSummary),
      summary: "Henüz yeterli piyasa verisi oluşmadı.",
      highlights: [],
      warnings: ["Örneklem küçük."],
      sourceBreakdown: [
        {
          source: "EasyCep",
          listingCount: 1,
          share: 1,
          averagePrice: 34999,
          lowestPrice: 34999,
          highestPrice: 34999,
        },
      ],
      totalListingCount: 1,
      activeListingCount: 1,
      sourceCount: 1,
      duplicateDensity: 0,
      confidenceAverage: 24,
    },
    opportunity: {
      ...structuredClone(baseBrandData.marketIntelligence.opportunity),
      score: 22,
      label: "Veri yetersiz",
      action: "insufficient_data",
    },
  },
  opportunityAnalysis: {
    ...structuredClone(baseBrandData.opportunityAnalysis),
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
  faqItems: baseBrandData.faqItems,
  jsonLd: buildBrandJsonLd({
    brandName: "MSI",
    brandUrl: "https://2elbul.com/brand/msi",
    summary: "Henüz yeterli piyasa verisi oluşmadı.",
    faqItems: baseBrandData.faqItems,
    topOpportunities: [],
  }),
} as unknown as BrandPageData;
