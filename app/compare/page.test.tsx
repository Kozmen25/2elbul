import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ComparePageData } from "@/lib/compare-engine";
import { buildCompareDecision, buildCompareJsonLd } from "@/lib/compare-engine";
import { getAbsoluteUrl } from "@/lib/site-url";

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

const canonicalUrl = getAbsoluteUrl(
  `/compare?a=${encodeURIComponent("listing-1")}&b=${encodeURIComponent("listing-2")}`,
);

const candidateA = {
  key: "a" as const,
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
  confidenceLevel: "high" as const,
  opportunityScore: 88,
  opportunityLevel: "high" as const,
  riskLevel: "low" as const,
  recommendation: { action: "buy_now", label: "Şimdi al", description: "Fiyat avantajlı." },
  duplicateDensity: 0.05,
  sourceCount: 3,
  sampleSize: 12,
  dataFreshness: "fresh" as const,
  priceAdvantagePercent: 9,
  trendDirection: "falling" as const,
  trendChangePercent: -4,
};

const candidateB = {
  key: "b" as const,
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
  confidenceLevel: "medium" as const,
  opportunityScore: 70,
  opportunityLevel: "medium" as const,
  riskLevel: "medium" as const,
  recommendation: { action: "watch", label: "Takip et", description: "Sinyaller olumlu." },
  duplicateDensity: 0.18,
  sourceCount: 2,
  sampleSize: 10,
  dataFreshness: "recent" as const,
  priceAdvantagePercent: 3,
  trendDirection: "stable" as const,
  trendChangePercent: null,
};

const decision = buildCompareDecision(candidateA, candidateB);

const baseCompareData = {
  candidateA,
  candidateB,
  decision,
  jsonLd: buildCompareJsonLd({
    candidateA,
    candidateB,
    canonicalUrl,
  }),
  canonicalUrl,
} as unknown as ComparePageData;

const insufficientDecision = buildCompareDecision(
  { ...candidateA, sampleSize: 2 },
  candidateB,
);

const insufficientCompareData = {
  ...structuredClone(baseCompareData),
  candidateA: { ...structuredClone(candidateA), sampleSize: 2 },
  decision: insufficientDecision,
  jsonLd: buildCompareJsonLd({
    candidateA: { ...candidateA, sampleSize: 2 } as never,
    candidateB,
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
      searchParams: Promise.resolve({ a: "listing-1", b: "listing-2" }),
    });

    expect(metadata.title).toContain("iPhone 13");
    expect(metadata.title).toContain("Samsung Galaxy S22");
    expect(metadata.alternates?.canonical).toBe(canonicalUrl);
    expect(metadata.openGraph?.url).toBe(canonicalUrl);
  });

  it("returns noindex metadata when listings are missing", async () => {
    const metadata = await generateMetadata({
      searchParams: Promise.resolve({ a: undefined, b: undefined }),
    });

    const robots = metadata.robots;
    expect(typeof robots).toBe("object");
    expect((robots as { index: boolean }).index).toBe(false);
  });

  it("returns noindex metadata when the same listing id is selected twice", async () => {
    const metadata = await generateMetadata({
      searchParams: Promise.resolve({ a: "listing-1", b: "listing-1" }),
    });

    const robots = metadata.robots;
    expect((robots as { index: boolean }).index).toBe(false);
  });

  it("returns noindex metadata when compare data cannot be resolved", async () => {
    getComparePageDataMock.mockResolvedValueOnce(null);

    const metadata = await generateMetadata({
      searchParams: Promise.resolve({ a: "listing-1", b: "listing-2" }),
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
        searchParams: Promise.resolve({ a: "listing-1", b: "listing-2" }),
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
        searchParams: Promise.resolve({ a: "listing-1", b: "listing-2" }),
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
        searchParams: Promise.resolve({ a: "listing-1", b: "listing-2" }),
      }),
    );

    expect(html).toContain("WebPage");
    expect(html).toContain("BreadcrumbList");
    expect(html).toContain("ItemList");
  });

  it("renders the VS layout with both candidates", async () => {
    getComparePageDataMock.mockResolvedValueOnce(baseCompareData);

    const html = renderToStaticMarkup(
      await ComparePage({
        searchParams: Promise.resolve({ a: "listing-1", b: "listing-2" }),
      }),
    );

    expect(html).toContain("İlan A");
    expect(html).toContain("İlan B");
    expect(html).toContain("VS");
    expect(html).toContain("Bu ilanı incele");
  });

  it("renders the comparison table with every required signal", async () => {
    getComparePageDataMock.mockResolvedValueOnce(baseCompareData);

    const html = renderToStaticMarkup(
      await ComparePage({
        searchParams: Promise.resolve({ a: "listing-1", b: "listing-2" }),
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
        searchParams: Promise.resolve({ a: "listing-1", b: "listing-2" }),
      }),
    );

    expect(html).toContain("En iyi ilan");
    expect(html).toContain("Bu ilanı incele");
    expect(html).toContain("Ürün analizine git");
  });

  it("renders an empty state when no listings are provided", async () => {
    const html = renderToStaticMarkup(
      await ComparePage({
        searchParams: Promise.resolve({ a: undefined, b: undefined }),
      }),
    );

    expect(html).toContain("İki ilanı karşılaştır");
    expect(html).toContain("?a=&lt;ilanId&gt;&amp;b=&lt;ilanId&gt;");
  });

  it("warns when the same listing id is selected twice", async () => {
    const html = renderToStaticMarkup(
      await ComparePage({
        searchParams: Promise.resolve({ a: "listing-1", b: "listing-1" }),
      }),
    );

    expect(html).toContain("Aynı ilan ID iki kez seçildi");
  });

  it("renders a not found fallback when listings cannot be resolved", async () => {
    getComparePageDataMock.mockResolvedValueOnce(null);

    const html = renderToStaticMarkup(
      await ComparePage({
        searchParams: Promise.resolve({ a: "listing-1", b: "listing-2" }),
      }),
    );

    expect(html).toContain("İlanlar karşılaştırılamadı");
    expect(html).toContain("listing-1");
    expect(html).toContain("listing-2");
  });

  it("renders the insufficient data fallback in the decision card", async () => {
    getComparePageDataMock.mockResolvedValueOnce(insufficientCompareData);

    const html = renderToStaticMarkup(
      await ComparePage({
        searchParams: Promise.resolve({ a: "listing-1", b: "listing-2" }),
      }),
    );

    expect(html).toContain("Karar için yetersiz veri");
    expect(html).toContain("örneklem yetersiz");
  });

  it("regression: identical candidates render the tie state without a best deal CTA", async () => {
    const tiedDecision = buildCompareDecision(candidateA, {
      ...candidateA,
      key: "b" as const,
      listingId: "listing-2",
      productName: "iPhone 13",
    });
    const tiedData = {
      ...structuredClone(baseCompareData),
      candidateB: { ...structuredClone(candidateA), key: "b" as const, listingId: "listing-2" },
      decision: tiedDecision,
    } as unknown as ComparePageData;
    getComparePageDataMock.mockResolvedValueOnce(tiedData);

    const html = renderToStaticMarkup(
      await ComparePage({
        searchParams: Promise.resolve({ a: "listing-1", b: "listing-2" }),
      }),
    );

    expect(html).toContain("Başabaş");
    expect(html).not.toContain("En iyi ilan");
  });
});
