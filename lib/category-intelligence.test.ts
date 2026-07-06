import { describe, expect, it } from "vitest";
import {
  CATEGORY_ROUTES,
  buildBrandDistribution,
  buildCategoryFaqItems,
  buildCategoryJsonLd,
  buildEmptyCategoryPageData,
  findCategoryRoute,
  matchProductToRoute,
  normalizeCategorySlug,
} from "./category-intelligence";
import { buildMarketIntelligence } from "@/lib/market-intelligence";
import type { MarketIntelligenceListing } from "@/lib/market-intelligence";
import { buildOpportunityAnalysis } from "@/lib/opportunity-engine";
import { calculateProductIntelligence } from "@/lib/intelligence-engine";
import type { MarketPulseItem } from "@/lib/market-pulse";

const phoneRoute = findCategoryRoute("telefon")!;
const consoleRoute = findCategoryRoute("konsol")!;
const computerRoute = findCategoryRoute("bilgisayar")!;
const vehicleRoute = findCategoryRoute("arac")!;
const realEstateRoute = findCategoryRoute("emlak")!;
const partsRoute = findCategoryRoute("yedek-parca")!;
const homeRoute = findCategoryRoute("ev-yasam")!;
const tvRoute = findCategoryRoute("tv-ses")!;

function makeMarketIntelligence(sampleSize = 12) {
  const listings = Array.from({ length: sampleSize }, (_, index) => {
    const source = index % 3 === 0 ? "EasyCep" : index % 3 === 1 ? "Getmobil" : "Sahibinden";
    return {
      id: `listing-${index}`,
      title: "iPhone 13",
      price: 25000 + index * 100,
      source: source as MarketIntelligenceListing["source"],
      city: "Istanbul",
      condition: "İkinci El" as MarketIntelligenceListing["condition"],
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-02T00:00:00.000Z",
      productId: "product-1",
      productName: "iPhone 13",
      status: "published",
      confidenceScore: 90,
      confidenceLevel: "high" as MarketIntelligenceListing["confidenceLevel"],
    };
  });
  const intelligence = calculateProductIntelligence({
    listings: listings.map((listing) => ({
      price: listing.price,
      createdAt: listing.createdAt,
    })),
  });
  return buildMarketIntelligence({
    scope: {
      productId: "category-telefon",
      productName: "Telefon",
      slug: "telefon",
      url: "https://2elbul.com/category/telefon",
      category: "Telefon",
      brand: "Telefon",
    },
    listings,
    intelligence,
    decisionInsight: null,
    duplicateSummary: null,
    analyzedAt: "2026-07-05T10:00:00.000Z",
  });
}

function makeOpportunityAnalysis() {
  const marketIntelligence = makeMarketIntelligence();
  return buildOpportunityAnalysis({
    marketIntelligence,
    intelligence: calculateProductIntelligence({
      listings: Array.from({ length: 12 }, (_, index) => ({
        price: 25000 + index * 100,
        createdAt: "2026-07-01T00:00:00.000Z",
      })),
    }),
    duplicateSummary: null,
    analyzedAt: marketIntelligence.analysisGeneratedAt,
    latestListingAt: "2026-07-05T10:00:00.000Z",
  });
}

const topOpportunity: MarketPulseItem = {
  productName: "iPhone 13",
  href: "/product/iphone-13",
  listingCount: 12,
  averagePrice: 25500,
  lowestPrice: 23000,
  opportunityLabel: "Güçlü fırsat",
  opportunityScore: 91,
  buyScore: 88,
  decisionLabel: "Şimdi Al",
  trendDirection: "falling",
  trendChangePercent: -7,
  searchCount: 18,
};

describe("category route registry", () => {
  it("exposes all eight required category slugs", () => {
    const slugs = CATEGORY_ROUTES.map((route) => route.slug).sort();
    expect(slugs).toEqual(
      [
        "arac",
        "bilgisayar",
        "emlak",
        "ev-yasam",
        "konsol",
        "telefon",
        "tv-ses",
        "yedek-parca",
      ].sort(),
    );
  });

  it("resolves known slugs regardless of casing/diacritics", () => {
    expect(findCategoryRoute("telefon")?.slug).toBe("telefon");
    expect(findCategoryRoute("Telefon")?.slug).toBe("telefon");
    expect(findCategoryRoute("TV-Ses")?.slug).toBe("tv-ses");
    expect(findCategoryRoute("yedek-parca")?.slug).toBe("yedek-parca");
  });

  it("returns null for unknown categories so the page can 404", () => {
    expect(findCategoryRoute("bilinmeyen-kategori")).toBeNull();
    expect(findCategoryRoute("")).toBeNull();
  });

  it("normalizes slug input consistently with the product slug helper", () => {
    expect(normalizeCategorySlug("TV & Ses")).toBe("tv-ses");
    expect(normalizeCategorySlug("Yedek Parça")).toBe("yedek-parca");
  });
});

describe("matchProductToRoute", () => {
  it("matches phone products by category and name keywords", () => {
    expect(matchProductToRoute("iPhone 13 128 GB", "Telefon", phoneRoute)).toBe(true);
    expect(matchProductToRoute("Samsung Galaxy S23", "Telefon", phoneRoute)).toBe(true);
    expect(matchProductToRoute("Xiaomi Redmi Note 12", "Cep Telefonu", phoneRoute)).toBe(true);
  });

  it("matches console products via playstation/ps5 keywords", () => {
    expect(matchProductToRoute("PlayStation 5 Slim", "Oyun Konsolu", consoleRoute)).toBe(true);
    expect(matchProductToRoute("Xbox Series X", null, consoleRoute)).toBe(true);
  });

  it("matches computer products via macbook/laptop keywords", () => {
    expect(matchProductToRoute("MacBook Air M2", "Bilgisayar", computerRoute)).toBe(true);
    expect(matchProductToRoute("Lenovo ThinkPad T14", null, computerRoute)).toBe(true);
  });

  it("matches vehicle and real estate routes by category keywords", () => {
    expect(matchProductToRoute("Volkswagen Golf", "Otomobil", vehicleRoute)).toBe(true);
    expect(matchProductToRoute("3+1 Daire", "Konut", realEstateRoute)).toBe(true);
  });

  it("matches yedek-parca and ev-yasam routes by keyword inclusion", () => {
    expect(matchProductToRoute("RTX 3060 Ekran Kartı", null, partsRoute)).toBe(true);
    expect(matchProductToRoute("Buzdolabı Çamaşır Makinesi", null, homeRoute)).toBe(true);
  });

  it("rejects products that hit exclude keywords for the route", () => {
    expect(matchProductToRoute("iPad Air", "Tablet", phoneRoute)).toBe(false);
    expect(matchProductToRoute("MacBook Pro", "Bilgisayar", phoneRoute)).toBe(false);
  });

  it("rejects products that match no keyword for the route", () => {
    expect(matchProductToRoute("Kedimama 10kg", "Diğer", phoneRoute)).toBe(false);
    expect(matchProductToRoute("Drone Mini", "Hobi", vehicleRoute)).toBe(false);
  });

  it("does not match tv-ses for unrelated long product names", () => {
    expect(matchProductToRoute("iPhone 13 128 GB", "Telefon", tvRoute)).toBe(false);
  });
});

describe("buildCategoryFaqItems", () => {
  const marketIntelligence = makeMarketIntelligence();
  const opportunityAnalysis = makeOpportunityAnalysis();
  const faqItems = buildCategoryFaqItems({
    categoryName: "Telefon",
    shortDescription: "Cep telefonu ikinci el piyasa analizi",
    listingCount: marketIntelligence.marketSummary.totalListingCount,
    productCount: 8,
    sourceCount: marketIntelligence.marketSummary.sourceCount,
    marketIntelligence,
    opportunityAnalysis,
  });

  it("produces five category-safe FAQ entries", () => {
    expect(faqItems).toHaveLength(5);
    faqItems.forEach((item) => {
      expect(item.question.length).toBeGreaterThan(10);
      expect(item.answer.length).toBeGreaterThan(20);
    });
  });

  it("keeps FAQ answers general and category-named", () => {
    expect(faqItems[0].question).toContain("Telefon");
    expect(faqItems[0].answer).toContain("Telefon");
    expect(faqItems.some((item) => item.answer.includes("programmatic SEO"))).toBe(true);
  });

  it("references listing and source counts in the FAQ copy", () => {
    const sourceFaq = faqItems.find((item) => item.question.includes("Kaynak"));
    expect(sourceFaq?.answer).toContain("kaynak");
  });
});

describe("buildCategoryJsonLd", () => {
  const jsonLd = buildCategoryJsonLd({
    route: phoneRoute,
    categoryUrl: "https://2elbul.com/category/telefon",
    summary: "Telefon için 12 ilan ile piyasa resmi çıkarıldı.",
    faqItems: [
      { question: "Telefon kategori sayfası nasıl hazırlanıyor?", answer: "Açıklama." },
    ],
    topOpportunities: [topOpportunity],
  });

  it("emits CollectionPage, BreadcrumbList, FAQPage and ItemList documents", () => {
    const types = jsonLd.map((document) => document["@type"]);
    expect(types).toEqual(
      expect.arrayContaining([
        "CollectionPage",
        "BreadcrumbList",
        "FAQPage",
        "ItemList",
      ]),
    );
  });

  it("builds a two-step breadcrumb schema with canonical ids", () => {
    const breadcrumb = jsonLd.find(
      (document) => document["@type"] === "BreadcrumbList",
    );
    expect(breadcrumb).toBeDefined();
    const elements = (breadcrumb as { itemListElement: Array<{ name: string; position: number; item: string }> }).itemListElement;
    expect(elements).toHaveLength(2);
    expect(elements[0].name).toBe("Ana Sayfa");
    expect(elements[1].name).toBe("Telefon");
    expect(elements[1].item).toBe("https://2elbul.com/category/telefon");
  });

  it("emits FAQ schema mirroring the faq items", () => {
    const faq = jsonLd.find((document) => document["@type"] === "FAQPage");
    expect(faq).toBeDefined();
    const entities = (faq as { mainEntity: Array<{ name: string }> }).mainEntity;
    expect(entities[0].name).toContain("Telefon");
  });

  it("emits ItemList only when opportunities exist", () => {
    const withItems = buildCategoryJsonLd({
      route: phoneRoute,
      categoryUrl: "https://2elbul.com/category/telefon",
      summary: "Özet.",
      faqItems: [],
      topOpportunities: [topOpportunity],
    });
    const itemList = withItems.find((document) => document["@type"] === "ItemList");
    expect(itemList).toBeDefined();

    const withoutItems = buildCategoryJsonLd({
      route: phoneRoute,
      categoryUrl: "https://2elbul.com/category/telefon",
      summary: "Özet.",
      faqItems: [],
      topOpportunities: [],
    });
    expect(withoutItems.find((document) => document["@type"] === "ItemList")).toBeUndefined();
  });
});

describe("buildEmptyCategoryPageData", () => {
  it("returns a fully-shaped fallback page without listings", () => {
    const empty = buildEmptyCategoryPageData(phoneRoute);
    expect(empty.categorySlug).toBe("telefon");
    expect(empty.productCount).toBe(0);
    expect(empty.listingCount).toBe(0);
    expect(empty.topOpportunities).toEqual([]);
    expect(empty.latestListings).toEqual([]);
    expect(empty.brandDistribution).toEqual([]);
    expect(empty.faqItems.length).toBeGreaterThan(0);
    expect(empty.jsonLd.length).toBeGreaterThan(0);
  });

  it("still emits breadcrumb and FAQ JSON-LD for empty category", () => {
    const empty = buildEmptyCategoryPageData(consoleRoute);
    const types = empty.jsonLd.map((document) => document["@type"]);
    expect(types).toContain("BreadcrumbList");
    expect(types).toContain("FAQPage");
    expect(types).not.toContain("ItemList");
  });
});

describe("buildBrandDistribution", () => {
  const products = [
    { id: "1", name: "iPhone 13 128 GB", slug: "iphone-13", category: "Telefon", createdAt: null },
    { id: "2", name: "Samsung Galaxy S22", slug: "samsung-galaxy-s22", category: "Telefon", createdAt: null },
    { id: "3", name: "iPhone 14 Pro", slug: "iphone-14-pro", category: "Telefon", createdAt: null },
    { id: "4", name: "Genel Mobilya", slug: "genel-mobilya", category: "Telefon", createdAt: null },
  ];
  const listings = [
    {
      id: "l1",
      productId: "1",
      productName: "iPhone 13 128 GB",
      title: "iPhone 13",
      price: 24000,
      city: "Istanbul",
      source: "EasyCep" as const,
      url: "https://example.com/1",
      condition: "İkinci El" as const,
      imageUrl: null,
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: null,
      confidenceScore: null,
      confidenceLevel: null,
    },
    {
      id: "l2",
      productId: "1",
      productName: "iPhone 13 128 GB",
      title: "iPhone 13",
      price: 25000,
      city: "Ankara",
      source: "Getmobil" as const,
      url: "https://example.com/2",
      condition: "İkinci El" as const,
      imageUrl: null,
      createdAt: "2026-07-02T00:00:00.000Z",
      updatedAt: null,
      confidenceScore: null,
      confidenceLevel: null,
    },
    {
      id: "l3",
      productId: "2",
      productName: "Samsung Galaxy S22",
      title: "Galaxy S22",
      price: 21000,
      city: "Izmir",
      source: "Sahibinden" as const,
      url: "https://example.com/3",
      condition: "İkinci El" as const,
      imageUrl: null,
      createdAt: "2026-07-03T00:00:00.000Z",
      updatedAt: null,
      confidenceScore: null,
      confidenceLevel: null,
    },
  ];

  it("groups listings by extracted brand and computes share", () => {
    const distribution = buildBrandDistribution(products, listings);
    const apple = distribution.find((brand) => brand.brandSlug === "apple");
    const samsung = distribution.find((brand) => brand.brandSlug === "samsung");
    expect(apple).toBeDefined();
    expect(apple?.listingCount).toBe(2);
    expect(apple?.productCount).toBe(2);
    expect(samsung?.listingCount).toBe(1);
    expect(apple?.share).toBeGreaterThan(samsung?.share ?? 0);
  });

  it("skips products without a detectable brand", () => {
    const distribution = buildBrandDistribution(products, listings);
    expect(distribution.find((brand) => brand.brandName === "Genel Mobilya")).toBeUndefined();
  });

  it("returns an empty list when no products match a brand", () => {
    expect(buildBrandDistribution([], [])).toEqual([]);
  });
});
