import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ComparePageData } from "@/lib/compare-engine";
import { buildCompareDecision, buildCompareJsonLd } from "@/lib/compare-engine";
import { getAbsoluteUrl } from "@/lib/site-url";

vi.mock("@/lib/supabase", () => ({
  createSupabaseClient: () => null,
}));

const getComparePageDataMock = vi.hoisted(() => vi.fn());

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

vi.mock("@/components/listing-image", () => ({
  ListingImage: ({ alt }: { alt: string }) => (
    <img alt={alt} src="/products/placeholder.svg" />
  ),
}));

vi.mock("@/lib/compare-engine", async () => {
  const actual = await vi.importActual<typeof import("@/lib/compare-engine")>(
    "@/lib/compare-engine",
  );
  return {
    ...actual,
    getComparePageData: getComparePageDataMock,
  };
});

const { default: ComparePage, generateMetadata } = await import("./page");

const canonicalUrl = getAbsoluteUrl("/compare?ids=listing-1,listing-2");

const candidate0 = {
  key: 0,
  listingId: "listing-1",
  productName: "iPhone 13",
  productSlug: "iphone-13",
  productUrl: getAbsoluteUrl("/product/iphone-13"),
  title: "iPhone 13 128 GB",
  price: 24000,
  city: "İstanbul",
  source: "EasyCep",
  url: "https://example.com/listing-1",
  condition: "İkinci El",
  imageUrl: null,
  createdAt: "2026-07-01T00:00:00.000Z",
  averagePrice: 26000,
  medianPrice: 25500,
  minPrice: 23000,
  confidenceScore: 90,
  confidenceLevel: "high",
  opportunityScore: 88,
  opportunityLevel: "high",
  riskLevel: "low",
  recommendation: { action: "buy_now", label: "Şimdi al", description: "Fiyat avantajlı." },
  duplicateDensity: 0.05,
  sourceCount: 3,
  sampleSize: 12,
  dataFreshness: "fresh",
  priceAdvantagePercent: 9,
  trendDirection: "falling",
  trendChangePercent: -4,
  productType: null,
} as const;

const candidate1 = {
  key: 1,
  listingId: "listing-2",
  productName: "Samsung Galaxy S22",
  productSlug: "samsung-galaxy-s22",
  productUrl: getAbsoluteUrl("/product/samsung-galaxy-s22"),
  title: "Galaxy S22 256 GB",
  price: 26000,
  city: "Ankara",
  source: "Getmobil",
  url: "https://example.com/listing-2",
  condition: "Yenilenmiş",
  imageUrl: null,
  createdAt: "2026-07-02T00:00:00.000Z",
  averagePrice: 27500,
  medianPrice: 27000,
  minPrice: 25000,
  confidenceScore: 78,
  confidenceLevel: "medium",
  opportunityScore: 70,
  opportunityLevel: "medium",
  riskLevel: "medium",
  recommendation: { action: "watch", label: "Takip et", description: "Sinyaller olumlu." },
  duplicateDensity: 0.18,
  sourceCount: 2,
  sampleSize: 10,
  dataFreshness: "recent",
  priceAdvantagePercent: 3,
  trendDirection: "stable",
  trendChangePercent: null,
  productType: null,
} as const;

const decision = buildCompareDecision([candidate0, candidate1]);

const baseCompareData = {
  candidates: [candidate0, candidate1],
  decision,
  jsonLd: buildCompareJsonLd({ candidates: [candidate0, candidate1], canonicalUrl }),
  canonicalUrl,
} as unknown as ComparePageData;

const insufficientDecision = buildCompareDecision([
  { ...candidate0, sampleSize: 2 },
  candidate1,
]);

const insufficientCompareData = {
  ...structuredClone(baseCompareData),
  candidates: [
    { ...structuredClone(candidate0), sampleSize: 2 },
    candidate1,
  ],
  decision: insufficientDecision,
  jsonLd: buildCompareJsonLd({
    candidates: [
      { ...candidate0, sampleSize: 2 } as never,
      candidate1,
    ],
    canonicalUrl,
  }),
} as unknown as ComparePageData;

describe("compare page metadata", () => {
  beforeEach(() => {
    getComparePageDataMock.mockReset();
  });

  it("uses the canonical compare URL in metadata", async () => {
    getComparePageDataMock.mockResolvedValueOnce(baseCompareData);

    const metadata = await generateMetadata({
      searchParams: Promise.resolve({ ids: "listing-1,listing-2" }),
    });

    expect(metadata.title).toContain("iPhone 13");
    expect(metadata.title).toContain("Samsung Galaxy S22");
    expect(metadata.alternates?.canonical).toBe(canonicalUrl);
    expect(metadata.openGraph?.url).toBe(canonicalUrl);
  });

  it("returns noindex metadata when listings are missing", async () => {
    const metadata = await generateMetadata({
      searchParams: Promise.resolve({ ids: undefined }),
    });

    const robots = metadata.robots;
    expect(typeof robots).toBe("object");
    expect((robots as { index: boolean }).index).toBe(false);
  });

  it("returns noindex metadata when the same listing id is selected twice", async () => {
    const metadata = await generateMetadata({
      searchParams: Promise.resolve({ ids: "listing-1,listing-1" }),
    });

    const robots = metadata.robots;
    expect((robots as { index: boolean }).index).toBe(false);
  });

  it("returns noindex metadata when compare data cannot be resolved", async () => {
    getComparePageDataMock.mockResolvedValueOnce(null);

    const metadata = await generateMetadata({
      searchParams: Promise.resolve({ ids: "listing-1,listing-2" }),
    });

    const robots = metadata.robots;
    expect((robots as { index: boolean }).index).toBe(false);
  });
});

describe("compare page render", () => {
  beforeEach(() => {
    getComparePageDataMock.mockReset();
  });

  it("renders the AI decision card recommending candidate A", async () => {
    getComparePageDataMock.mockResolvedValueOnce(baseCompareData);

    const html = renderToStaticMarkup(
      await ComparePage({
        searchParams: Promise.resolve({ ids: "listing-1,listing-2" }),
      }),
    );

    expect(html).toContain("AI Kararı");
    expect(html).toContain("Hangisini almalısın?");
    expect(html).toContain("Önerilen ilan");
    expect(html).toContain("iPhone 13");
    expect(html).toContain("Samsung Galaxy S22");
    expect(html).toContain("Önerilen ilanı incele");
  });

  it("lists the winning reasons in the decision card", async () => {
    getComparePageDataMock.mockResolvedValueOnce(baseCompareData);

    const html = renderToStaticMarkup(
      await ComparePage({
        searchParams: Promise.resolve({ ids: "listing-1,listing-2" }),
      }),
    );

    expect(html).toContain("Opportunity skoru daha yüksek");
    expect(html).toContain("Confidence daha yüksek");
    expect(html).toContain("Risk seviyesi daha düşük");
    expect(html).toContain("Duplicate yoğunluğu daha düşük");
    expect(html).toContain("Daha düşük fiyat");
  });

  it("emits WebPage, BreadcrumbList and ItemList JSON-LD scripts", async () => {
    getComparePageDataMock.mockResolvedValueOnce(baseCompareData);

    const html = renderToStaticMarkup(
      await ComparePage({
        searchParams: Promise.resolve({ ids: "listing-1,listing-2" }),
      }),
    );

    expect(html).toContain("WebPage");
    expect(html).toContain("BreadcrumbList");
    expect(html).toContain("ItemList");
  });

  it("renders the N-column grid with 2 candidates (no VS divider)", async () => {
    getComparePageDataMock.mockResolvedValueOnce(baseCompareData);

    const html = renderToStaticMarkup(
      await ComparePage({
        searchParams: Promise.resolve({ ids: "listing-1,listing-2" }),
      }),
    );

    expect(html).toContain("İlan 1");
    expect(html).toContain("İlan 2");
    expect(html).not.toContain("VS");
    expect(html).toContain("Bu ilanı incele");
  });

  it("renders the comparison table with every required signal", async () => {
    getComparePageDataMock.mockResolvedValueOnce(baseCompareData);

    const html = renderToStaticMarkup(
      await ComparePage({
        searchParams: Promise.resolve({ ids: "listing-1,listing-2" }),
      }),
    );

    expect(html).toContain("Karşılaştırma tablosu");
    expect(html).toContain("Fiyat");
    expect(html).toContain("Risk");
    expect(html).toContain("Confidence");
    expect(html).toContain("Opportunity");
    expect(html).toContain("Kaynak");
    expect(html).toContain("Duplicate");
    expect(html).toContain("Fiyat avantajı");
    expect(html).toContain("Trend");
    expect(html).toContain("Data Freshness");
    expect(html).toContain("Recommendation");
  });

  it("renders the best deal CTA for the recommended candidate", async () => {
    getComparePageDataMock.mockResolvedValueOnce(baseCompareData);

    const html = renderToStaticMarkup(
      await ComparePage({
        searchParams: Promise.resolve({ ids: "listing-1,listing-2" }),
      }),
    );

    expect(html).toContain("En iyi ilan");
    expect(html).toContain("Bu ilanı incele");
    expect(html).toContain("Ürün analizine git");
  });

  it("renders an empty state when no listings are provided", async () => {
    const html = renderToStaticMarkup(
      await ComparePage({
        searchParams: Promise.resolve({ ids: undefined }),
      }),
    );

    expect(html).toContain("İlanları karşılaştır");
    expect(html).toContain("?ids=ilanId1,ilanId2");
  });

  it("warns when the same listing id is selected twice", async () => {
    const html = renderToStaticMarkup(
      await ComparePage({
        searchParams: Promise.resolve({ ids: "listing-1,listing-1" }),
      }),
    );

    expect(html).toContain("Aynı ilan ID tekrar ediyor");
  });

  it("renders a not found fallback when listings cannot be resolved", async () => {
    getComparePageDataMock.mockResolvedValueOnce(null);

    const html = renderToStaticMarkup(
      await ComparePage({
        searchParams: Promise.resolve({ ids: "listing-1,listing-2" }),
      }),
    );

    expect(html).toContain("İlanlar karşılaştırılamadı");
    expect(html).toContain("listing-1, listing-2");
  });

  it("renders the insufficient data fallback in the decision card", async () => {
    getComparePageDataMock.mockResolvedValueOnce(insufficientCompareData);

    const html = renderToStaticMarkup(
      await ComparePage({
        searchParams: Promise.resolve({ ids: "listing-1,listing-2" }),
      }),
    );

    expect(html).toContain("Karar için yetersiz veri");
    expect(html).toContain("örneklem yetersiz");
  });

  it("regression: identical candidates render the tie state without a best deal CTA", async () => {
    const tiedDecision = buildCompareDecision([
      candidate0,
      { ...candidate0, key: 1, listingId: "listing-2", productName: "iPhone 13" },
    ]);
    const tiedData = {
      ...structuredClone(baseCompareData),
      candidates: [
        candidate0,
        { ...structuredClone(candidate0), key: 1, listingId: "listing-2" },
      ],
      decision: tiedDecision,
    } as unknown as ComparePageData;
    getComparePageDataMock.mockResolvedValueOnce(tiedData);

    const html = renderToStaticMarkup(
      await ComparePage({
        searchParams: Promise.resolve({ ids: "listing-1,listing-2" }),
      }),
    );

    expect(html).toContain("Başabaş");
    expect(html).not.toContain("En iyi ilan");
  });

  it("backward compat: ?a=&b= query params still work", async () => {
    getComparePageDataMock.mockResolvedValueOnce(baseCompareData);

    const html = renderToStaticMarkup(
      await ComparePage({
        searchParams: Promise.resolve({ a: "listing-1", b: "listing-2" }),
      }),
    );

    expect(html).toContain("İlan 1");
    expect(html).toContain("İlan 2");
    expect(html).toContain("iPhone 13");
    expect(html).toContain("Samsung Galaxy S22");
  });

  it("renders 3 candidates in a grid", async () => {
    const candidate2 = {
      key: 2,
      listingId: "listing-3",
      productName: "Google Pixel 8",
      productSlug: "google-pixel-8",
      productUrl: getAbsoluteUrl("/product/google-pixel-8"),
      title: "Pixel 8 128 GB",
      price: 22000,
      city: "İzmir",
      source: "Mediamarkt",
      url: "https://example.com/listing-3",
      condition: "Yeni",
      imageUrl: null,
      createdAt: "2026-07-03T00:00:00.000Z",
      averagePrice: 23500,
      medianPrice: 23000,
      minPrice: 21000,
      confidenceScore: 70,
      confidenceLevel: "medium",
      opportunityScore: 65,
      opportunityLevel: "medium",
      riskLevel: "medium",
      recommendation: { action: "watch", label: "Takip et", description: "Orta sinyaller." },
      duplicateDensity: 0.1,
      sourceCount: 2,
      sampleSize: 8,
      dataFreshness: "recent",
      priceAdvantagePercent: 6,
      trendDirection: "falling",
      trendChangePercent: -2,
      productType: null,
    } as const;

    const canonicalUrl3 = getAbsoluteUrl("/compare?ids=listing-1,listing-2,listing-3");
    const threeData = {
      candidates: [candidate0, candidate1, candidate2],
      decision: buildCompareDecision([candidate0, candidate1, candidate2]),
      jsonLd: buildCompareJsonLd({ candidates: [candidate0, candidate1, candidate2], canonicalUrl: canonicalUrl3 }),
      canonicalUrl: canonicalUrl3,
    } as unknown as ComparePageData;
    getComparePageDataMock.mockResolvedValueOnce(threeData);

    const html = renderToStaticMarkup(
      await ComparePage({
        searchParams: Promise.resolve({ ids: "listing-1,listing-2,listing-3" }),
      }),
    );

    expect(html).toContain("İlan 1");
    expect(html).toContain("İlan 2");
    expect(html).toContain("İlan 3");
    expect(html).toContain("Google Pixel 8");
    expect(html).toContain("iPhone 13");
    expect(html).toContain("Samsung Galaxy S22");
  });

  it("renders 4 candidates in a grid", async () => {
    const candidate2 = {
      key: 2,
      listingId: "listing-3",
      productName: "Google Pixel 8",
      productSlug: "google-pixel-8",
      productUrl: getAbsoluteUrl("/product/google-pixel-8"),
      title: "Pixel 8 128 GB",
      price: 22000,
      city: "İzmir",
      source: "Mediamarkt",
      url: "https://example.com/listing-3",
      condition: "Yeni",
      imageUrl: null,
      createdAt: "2026-07-03T00:00:00.000Z",
      averagePrice: 23500,
      medianPrice: 23000,
      minPrice: 21000,
      confidenceScore: 70,
      confidenceLevel: "medium",
      opportunityScore: 65,
      opportunityLevel: "medium",
      riskLevel: "medium",
      recommendation: { action: "watch", label: "Takip et", description: "Orta sinyaller." },
      duplicateDensity: 0.1,
      sourceCount: 2,
      sampleSize: 8,
      dataFreshness: "recent",
      priceAdvantagePercent: 6,
      trendDirection: "falling",
      trendChangePercent: -2,
      productType: null,
    } as const;

    const candidate3 = {
      key: 3,
      listingId: "listing-4",
      productName: "Xiaomi Redmi Note 12",
      productSlug: "xiaomi-redmi-note-12",
      productUrl: getAbsoluteUrl("/product/xiaomi-redmi-note-12"),
      title: "Redmi Note 12 256 GB",
      price: 18000,
      city: "Bursa",
      source: "Teknosa",
      url: "https://example.com/listing-4",
      condition: "İkinci El",
      imageUrl: null,
      createdAt: "2026-07-04T00:00:00.000Z",
      averagePrice: 19500,
      medianPrice: 19000,
      minPrice: 17500,
      confidenceScore: 60,
      confidenceLevel: "medium",
      opportunityScore: 55,
      opportunityLevel: "medium",
      riskLevel: "high",
      recommendation: { action: "wait", label: "Bekle", description: "Daha iyi fırsat olabilir." },
      duplicateDensity: 0.25,
      sourceCount: 1,
      sampleSize: 6,
      dataFreshness: "stale",
      priceAdvantagePercent: 8,
      trendDirection: "stable",
      trendChangePercent: null,
      productType: null,
    } as const;

    const canonicalUrl4 = getAbsoluteUrl("/compare?ids=listing-1,listing-2,listing-3,listing-4");
    const fourData = {
      candidates: [candidate0, candidate1, candidate2, candidate3],
      decision: buildCompareDecision([candidate0, candidate1, candidate2, candidate3]),
      jsonLd: buildCompareJsonLd({ candidates: [candidate0, candidate1, candidate2, candidate3], canonicalUrl: canonicalUrl4 }),
      canonicalUrl: canonicalUrl4,
    } as unknown as ComparePageData;
    getComparePageDataMock.mockResolvedValueOnce(fourData);

    const html = renderToStaticMarkup(
      await ComparePage({
        searchParams: Promise.resolve({ ids: "listing-1,listing-2,listing-3,listing-4" }),
      }),
    );

    expect(html).toContain("İlan 1");
    expect(html).toContain("İlan 2");
    expect(html).toContain("İlan 3");
    expect(html).toContain("İlan 4");
    expect(html).toContain("Xiaomi Redmi Note 12");
  });
});
