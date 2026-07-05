import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HomeListing, PriceOpportunity } from "@/lib/home-data";
import type { MarketPulseItem } from "@/lib/market-pulse";

const mocks = vi.hoisted(() => ({
  getHomeDataMock: vi.fn(),
}));

vi.mock("@/lib/home-data", () => ({
  getHomeData: mocks.getHomeDataMock,
}));

vi.mock("@/components/search-bar", () => ({
  SearchBar: () => <div data-testid="search-bar" />,
}));

vi.mock("@/components/listing-image", () => ({
  ListingImage: () => <div data-testid="listing-image" />,
}));

vi.mock("@/components/favorite-button", () => ({
  FavoriteButton: () => <button type="button" data-testid="favorite-button" />,
}));

vi.mock("@/components/price-alert-form", () => ({
  PriceAlertForm: () => <div data-testid="price-alert-form" />,
}));

const { default: Home } = await import("./page");

describe("Home page", () => {
  beforeEach(() => {
    mocks.getHomeDataMock.mockReset();
  });

  it("renders the decision hero and the compact homepage sections", async () => {
    mocks.getHomeDataMock.mockResolvedValue(buildHomeData());

    const html = renderToStaticMarkup(await Home());

    expect(html).toContain("AI Kararı");
    expect(html).toContain("iPhone 15 Pro");
    expect(html).toContain("Fırsat skoru");
    expect(html).toContain("Şimdi Al");
    expect(html).toContain("Bu öneri 18 ilan, 3 kaynak ve 12 arama sinyali üzerinden hesaplandı.");
    expect(html).toContain("En iyi fırsatlar");
    expect(html).toContain("Piyasa Nabzı");
    expect(html).toContain("Son eklenen ilanlar");
    expect(html).toContain("Kategoriler");
    expect(html).toContain("Kaynaklara göre ilanlar");
    expect(html).toContain("Güven ağı");
    expect(html).toContain("md:hidden");
    expect(html).toContain("fixed inset-x-3 bottom-3");
    expect(html).not.toContain("Hızlı Keşif");
    expect(html).not.toContain("Yenilenmiş cihazlar");
    expect(html).not.toContain("Popüler ürünler");
    expect(html).not.toContain("Popüler kategoriler");
  });

  it("renders the fallback decision card when there is no top opportunity", async () => {
    mocks.getHomeDataMock.mockResolvedValue(
      buildHomeData({
        marketPulse: {
          ...baseHomeData.marketPulse,
          topOpportunities: [],
        },
      }),
    );

    const html = renderToStaticMarkup(await Home());

    expect(html).toContain("Yeterli veri oluşunca karar sinyali burada görünecek.");
    expect(html).toContain("Kaynaklar ve ilanlar çoğaldıkça 2ElBul");
  });

  it("keeps the market pulse compact to three visible signals per group", async () => {
    mocks.getHomeDataMock.mockResolvedValue(buildHomeData());

    const html = renderToStaticMarkup(await Home());

    expect(html).toContain("3 sinyal");
    expect(html).toContain("En çok arananlar");
    expect(html).toContain("En çok ilanı olanlar");
    expect(html).toContain("Fiyatı düşenler");
  });
});

function buildHomeData(overrides: Partial<typeof baseHomeData> = {}) {
  return structuredClone({
    ...baseHomeData,
    ...overrides,
    marketPulse: {
      ...baseHomeData.marketPulse,
      ...(overrides.marketPulse ?? {}),
    },
  });
}

const baseHomeData = {
  priceOpportunities: [
    makePriceOpportunity({
      id: "op-1",
      title: "iPhone 15 Pro 256 GB",
      price: 57900,
      averagePrice: 63400,
      discountRate: 9,
    }),
    makePriceOpportunity({
      id: "op-2",
      title: "Samsung Galaxy S24 128 GB",
      productName: "Samsung Galaxy S24",
      price: 41900,
      averagePrice: 46900,
      discountRate: 11,
      source: "Getmobil",
    }),
  ],
  last24HourListings: [
    makeListing({
      id: "listing-1",
      title: "iPhone 15 Pro 256 GB temiz kullanılmış",
      price: 58900,
      source: "Sahibinden",
      city: "İstanbul",
    }),
    makeListing({
      id: "listing-2",
      title: "Samsung Galaxy S24 hızlı teslimat",
      productName: "Samsung Galaxy S24",
      price: 42900,
      source: "EasyCep",
      city: "Ankara",
    }),
  ],
  sourceSummary: [
    { source: "Sahibinden", listingCount: 42 },
    { source: "EasyCep", listingCount: 18 },
    { source: "Getmobil", listingCount: 11 },
    { source: "Letgo", listingCount: 0 },
    { source: "Facebook Marketplace", listingCount: 0 },
  ],
  popularProducts: [
    { productName: "iPhone 15 Pro", searchCount: 128 },
    { productName: "Samsung Galaxy S24", searchCount: 94 },
    { productName: "MacBook Air M2", searchCount: 77 },
  ],
  marketPulse: {
    mostSearchedProducts: [
      makePulseItem({
        productName: "iPhone 15 Pro",
        searchCount: 128,
        listingCount: 18,
        averagePrice: 63400,
        lowestPrice: 57900,
        opportunityScore: 92,
        buyScore: 88,
        decisionLabel: "Şimdi Al",
        trendDirection: "falling",
        trendChangePercent: -8,
      }),
      makePulseItem({
        productName: "Samsung Galaxy S24",
        searchCount: 94,
        listingCount: 16,
        averagePrice: 46900,
        lowestPrice: 42900,
        opportunityScore: 85,
        buyScore: 80,
        decisionLabel: "Takip Et",
        trendDirection: "stable",
        trendChangePercent: 0,
      }),
      makePulseItem({
        productName: "MacBook Air M2",
        searchCount: 77,
        listingCount: 13,
        averagePrice: 38900,
        lowestPrice: 35900,
        opportunityScore: 79,
        buyScore: 74,
        decisionLabel: "Bekle",
        trendDirection: "falling",
        trendChangePercent: -5,
      }),
    ],
    mostListedProducts: [
      makePulseItem({
        productName: "MacBook Air M2",
        searchCount: 54,
        listingCount: 31,
        averagePrice: 38900,
        lowestPrice: 35900,
        opportunityScore: 78,
        buyScore: 70,
        decisionLabel: "Takip Et",
        trendDirection: "stable",
        trendChangePercent: 0,
      }),
      makePulseItem({
        productName: "iPhone 15 Pro",
        searchCount: 128,
        listingCount: 18,
        averagePrice: 63400,
        lowestPrice: 57900,
        opportunityScore: 92,
        buyScore: 88,
        decisionLabel: "Şimdi Al",
        trendDirection: "falling",
        trendChangePercent: -8,
      }),
      makePulseItem({
        productName: "Samsung Galaxy S24",
        searchCount: 94,
        listingCount: 16,
        averagePrice: 46900,
        lowestPrice: 42900,
        opportunityScore: 85,
        buyScore: 80,
        decisionLabel: "Takip Et",
        trendDirection: "rising",
        trendChangePercent: 4,
      }),
    ],
    topOpportunities: [
      makePulseItem({
        productName: "iPhone 15 Pro",
        searchCount: 12,
        listingCount: 18,
        averagePrice: 63400,
        lowestPrice: 57900,
        opportunityScore: 92,
        buyScore: 88,
        decisionLabel: "Şimdi Al",
        trendDirection: "falling",
        trendChangePercent: -8,
      }),
    ],
    fallingPriceProducts: [
      makePulseItem({
        productName: "Samsung Galaxy S24",
        searchCount: 94,
        listingCount: 16,
        averagePrice: 46900,
        lowestPrice: 42900,
        opportunityScore: 85,
        buyScore: 80,
        decisionLabel: "Takip Et",
        trendDirection: "falling",
        trendChangePercent: -14,
      }),
      makePulseItem({
        productName: "MacBook Air M2",
        searchCount: 77,
        listingCount: 13,
        averagePrice: 38900,
        lowestPrice: 35900,
        opportunityScore: 79,
        buyScore: 74,
        decisionLabel: "Bekle",
        trendDirection: "falling",
        trendChangePercent: -9,
      }),
      makePulseItem({
        productName: "iPhone 15 Pro",
        searchCount: 128,
        listingCount: 18,
        averagePrice: 63400,
        lowestPrice: 57900,
        opportunityScore: 92,
        buyScore: 88,
        decisionLabel: "Şimdi Al",
        trendDirection: "falling",
        trendChangePercent: -8,
      }),
    ],
    insufficientDataProducts: [],
  },
  error: "",
};

function makeListing(overrides: Partial<HomeListing> = {}): HomeListing {
  return {
    id: "listing-1",
    productName: "iPhone 15 Pro",
    title: "iPhone 15 Pro 256 GB",
    price: 57900,
    city: "İstanbul",
    source: "Sahibinden",
    url: "https://example.com/listing-1",
    condition: "İkinci El" as HomeListing["condition"],
    imageUrl: null,
    createdAt: "2026-07-05T08:15:00.000Z",
    ...overrides,
  };
}

function makePriceOpportunity(overrides: Partial<PriceOpportunity> = {}): PriceOpportunity {
  return {
    ...makeListing(),
    averagePrice: 63400,
    discountRate: 9,
    ...overrides,
  } as PriceOpportunity;
}

function makePulseItem(overrides: Partial<MarketPulseItem> = {}): MarketPulseItem {
  return {
    productName: "iPhone 15 Pro",
    href: "/product/iphone-15-pro",
    listingCount: 18,
    averagePrice: 63400,
    lowestPrice: 57900,
    opportunityLabel: "Güçlü fırsat",
    opportunityScore: 92,
    buyScore: 88,
    decisionLabel: "Şimdi Al",
    trendDirection: "falling",
    trendChangePercent: -8,
    searchCount: 12,
    ...overrides,
  };
}
