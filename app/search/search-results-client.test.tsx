import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Listing } from "@/lib/listings";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/search",
  useRouter: () => ({
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/favorite-button", () => ({
  FavoriteButton: () => <button type="button" />,
}));

vi.mock("@/components/listing-image", () => ({
  ListingImage: () => <div />,
}));

vi.mock("./actions", () => ({
  recordSearch: vi.fn(),
}));

const {
  buildProductSummaries,
  buildSearchDecisionSummary,
  filterProductSummariesBySignal,
  getSignalLabel,
  parseQuickFilterOption,
  parseSortOption,
  parseViewOption,
  sortProductSummaries,
} = await import("./search-results-client");

describe("search-results decision mapping", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-06T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds market and opportunity metadata from the listing groups", () => {
    const summaries = buildProductSummaries(buildDecisionListings());
    const iphone = summaries.find((item) => item.productId === "iphone-13");

    expect(summaries).toHaveLength(2);
    expect(iphone).toBeTruthy();
    expect(iphone?.marketIntelligence.sampleSize).toBe(4);
    expect(iphone?.sourceCount).toBe(4);
    expect(iphone?.refurbishedListingCount).toBe(1);
    expect(iphone?.priceAdvantagePercent).not.toBeNull();
    expect(iphone?.marketIntelligence.analysisGeneratedAt).toBe(
      "2026-07-06T12:00:00.000Z",
    );
    expect(iphone?.marketIntelligence.structuredData.url).toBe(
      "https://2elbul.com/product/iphone-13-128-gb",
    );
    expect(iphone?.opportunityAnalysis.recommendation.action).not.toBe(
      "insufficient_data",
    );
  });

  it("keeps duplicate metadata in the market intelligence pipeline", () => {
    const summaries = buildProductSummaries(buildDuplicateListings());
    const product = summaries[0];

    expect(product?.marketIntelligence.marketSummary.duplicateGroupCount).toBeGreaterThan(0);
    expect(product?.marketIntelligence.marketSummary.duplicatePairCount).toBeGreaterThan(0);
  });

  it("returns a short fallback decision when the sample size is too small", () => {
    const tinySummaries = buildProductSummaries([
      makeListing({
        id: "tiny-1",
        productId: "tiny",
        productName: "Test Ürün",
        title: "Test Ürün 1",
        price: 1200,
        createdAt: "2026-07-05T10:00:00.000Z",
      }),
      makeListing({
        id: "tiny-2",
        productId: "tiny",
        productName: "Test Ürün",
        title: "Test Ürün 2",
        price: 1300,
        createdAt: "2026-07-05T11:00:00.000Z",
      }),
    ]);

    expect(buildSearchDecisionSummary(tinySummaries[0] ?? null)).toBe(
      "Bu ürün için henüz yeterli piyasa verisi oluşmadı.",
    );
  });

  it.each([
    ["all", "Tümü"],
    ["strong-opportunities", "Güçlü Fırsatlar"],
    ["low-risk", "Risk Düşük"],
    ["high-confidence", "Confidence Yüksek"],
    ["newly-added", "Yeni Eklenenler"],
    ["falling-price", "Fiyatı Düşenler"],
    ["refurbished", "Yenilenmiş"],
  ] as const)("maps quick filter labels for %s", (value, expected) => {
    expect(getSignalLabel(value)).toBe(expected);
  });

  it.each([
    [null, "all"],
    ["strong-opportunities", "strong-opportunities"],
    ["low-risk", "low-risk"],
    ["high-confidence", "high-confidence"],
    ["newly-added", "newly-added"],
    ["falling-price", "falling-price"],
    ["refurbished", "refurbished"],
  ] as const)("parses quick filters safely", (value, expected) => {
    expect(parseQuickFilterOption(value)).toBe(expected);
  });

  it.each([
    [null, "ai-recommended"],
    ["ai-recommended", "ai-recommended"],
    ["best-opportunity", "best-opportunity"],
    ["most-reliable", "most-reliable"],
    ["lowest-risk", "lowest-risk"],
    ["newest", "newest"],
    ["price-asc", "price-asc"],
    ["most-listings", "most-listings"],
    ["confidence", "confidence"],
  ] as const)("parses sort options safely", (value, expected) => {
    expect(parseSortOption(value)).toBe(expected);
  });

  it.each([
    [null, "products"],
    ["products", "products"],
    ["listings", "listings"],
    ["both", "both"],
    ["unknown", "products"],
  ] as const)("parses view options safely", (value, expected) => {
    expect(parseViewOption(value)).toBe(expected);
  });

  it.each([
    ["ai-recommended", "iphone-13"],
    ["best-opportunity", "iphone-13"],
    ["most-reliable", "iphone-13"],
    ["lowest-risk", "iphone-13"],
    ["newest", "iphone-13"],
    ["price-asc", "galaxy-a54"],
    ["most-listings", "iphone-13"],
    ["confidence", "iphone-13"],
  ] as const)("sorts summaries by %s", (sort, expectedProductId) => {
    const summaries = buildProductSummaries(buildDecisionListings());
    const sorted = sortProductSummaries(summaries, sort);

    expect(sorted[0]?.productId).toBe(expectedProductId);
  });

  it.each([
    ["strong-opportunities", ["iphone-13"]],
    ["low-risk", ["iphone-13", "galaxy-a54"]],
    ["high-confidence", ["iphone-13"]],
    ["newly-added", ["iphone-13"]],
    ["falling-price", ["galaxy-a54"]],
    ["refurbished", ["iphone-13"]],
  ] as const)("filters summaries by %s", (signal, expectedProductIds) => {
    const summaries = buildProductSummaries(buildDecisionListings());
    const filtered = filterProductSummariesBySignal(summaries, signal);

    expect(filtered.map((item) => item.productId)).toEqual(expectedProductIds);
  });
});

function buildDecisionListings(): Listing[] {
  return [
    makeListing({
      id: "iphone-1",
      productId: "iphone-13",
      productName: "iPhone 13 128 GB",
      title: "iPhone 13 128 GB temiz",
      price: 32000,
      source: "EasyCep",
      city: "İstanbul",
      condition: "İkinci El",
      createdAt: "2026-07-01T10:00:00.000Z",
    }),
    makeListing({
      id: "iphone-2",
      productId: "iphone-13",
      productName: "iPhone 13 128 GB",
      title: "iPhone 13 128 GB kutulu",
      price: 24000,
      source: "Getmobil",
      city: "Ankara",
      condition: "Yeni gibi",
      createdAt: "2026-07-03T10:00:00.000Z",
    }),
    makeListing({
      id: "iphone-3",
      productId: "iphone-13",
      productName: "iPhone 13 128 GB",
      title: "iPhone 13 128 GB pil sağlığı %92",
      price: 31900,
      source: "Sahibinden",
      city: "İzmir",
      condition: "İyi",
      createdAt: "2026-07-05T10:00:00.000Z",
    }),
    makeListing({
      id: "iphone-4",
      productId: "iphone-13",
      productName: "iPhone 13 128 GB",
      title: "iPhone 13 128 GB yenilenmiş",
      price: 31800,
      source: "Satarız",
      city: "Bursa",
      condition: "Yenilenmiş",
      createdAt: "2026-07-06T08:00:00.000Z",
    }),
    makeListing({
      id: "galaxy-1",
      productId: "galaxy-a54",
      productName: "Samsung Galaxy A54",
      title: "Samsung Galaxy A54 128 GB",
      price: 20000,
      source: "Sahibinden",
      city: "Ankara",
      condition: "İkinci El",
      createdAt: "2026-06-20T10:00:00.000Z",
    }),
    makeListing({
      id: "galaxy-2",
      productId: "galaxy-a54",
      productName: "Samsung Galaxy A54",
      title: "Samsung Galaxy A54 128 GB",
      price: 19500,
      source: "Sahibinden",
      city: "Ankara",
      condition: "İkinci El",
      createdAt: "2026-06-21T10:00:00.000Z",
    }),
    makeListing({
      id: "galaxy-3",
      productId: "galaxy-a54",
      productName: "Samsung Galaxy A54",
      title: "Samsung Galaxy A54 128 GB",
      price: 19000,
      source: "Sahibinden",
      city: "Ankara",
      condition: "İkinci El",
      createdAt: "2026-06-22T10:00:00.000Z",
    }),
  ];
}

function buildDuplicateListings(): Listing[] {
  return [
    makeListing({
      id: "dup-1",
      productId: "duplicate-iphone",
      productName: "iPhone 12",
      title: "iPhone 12 64 GB",
      price: 21000,
      source: "Sahibinden",
      city: "İstanbul",
      condition: "İkinci El",
      createdAt: "2026-07-06T08:00:00.000Z",
    }),
    makeListing({
      id: "dup-2",
      productId: "duplicate-iphone",
      productName: "iPhone 12",
      title: "iPhone 12 64 GB",
      price: 21000,
      source: "Sahibinden",
      city: "İstanbul",
      condition: "İkinci El",
      createdAt: "2026-07-06T09:00:00.000Z",
    }),
    makeListing({
      id: "dup-3",
      productId: "duplicate-iphone",
      productName: "iPhone 12",
      title: "iPhone 12 64 GB temiz",
      price: 20900,
      source: "EasyCep",
      city: "İstanbul",
      condition: "İkinci El",
      createdAt: "2026-07-06T10:00:00.000Z",
    }),
  ];
}

function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: "listing-1",
    productName: "iPhone 13 128 GB",
    title: "iPhone 13 128 GB temiz",
    price: 26000,
    city: "İstanbul",
    source: "Sahibinden",
    url: "https://example.com/listing-1",
    condition: "İkinci El",
    imageUrl: null,
    createdAt: "2026-07-06T07:00:00.000Z",
    ...overrides,
  };
}
