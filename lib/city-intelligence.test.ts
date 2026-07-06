import { describe, expect, it } from "vitest";
import {
  buildCityBrandDistribution,
  buildCityCatalog,
  buildCityFaqItems,
  buildCityJsonLd,
  normalizeCityName,
  normalizeCitySlug,
  resolveCitySlug,
} from "./city-intelligence";
import { buildMarketIntelligence } from "@/lib/market-intelligence";
import type { MarketIntelligenceListing } from "@/lib/market-intelligence";
import { buildOpportunityAnalysis } from "@/lib/opportunity-engine";
import { calculateProductIntelligence } from "@/lib/intelligence-engine";
import type { MarketPulseItem } from "@/lib/market-pulse";
import type { CityListingRow } from "./city-intelligence";

function makeListingRow(
  id: string,
  city: string,
  source: string,
  price: number,
  productId = "product-1",
): CityListingRow {
  return {
    id,
    product_id: productId,
    title: "iPhone 13",
    price,
    city,
    source,
    url: `https://example.com/${id}`,
    condition: "İkinci El",
    image_url: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-02T00:00:00.000Z",
    confidence_score: 90,
  };
}

function makeMarketIntelligence(sampleSize = 12) {
  const listings = Array.from({ length: sampleSize }, (_, index) => {
    const source = index % 3 === 0 ? "EasyCep" : index % 3 === 1 ? "Getmobil" : "Sahibinden";
    return {
      id: `listing-${index}`,
      title: "iPhone 13",
      price: 25000 + index * 100,
      source: source as MarketIntelligenceListing["source"],
      city: "İstanbul",
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
      productId: "city-istanbul",
      productName: "İstanbul",
      slug: "istanbul",
      url: "https://2elbul.com/city/istanbul",
      category: "Şehir",
      brand: "İstanbul",
      city: "İstanbul",
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

describe("city slug normalization", () => {
  it("normalizes Turkish city names into stable slugs", () => {
    expect(normalizeCitySlug("İstanbul")).toBe("istanbul");
    expect(normalizeCitySlug("Gaziantep")).toBe("gaziantep");
    expect(normalizeCitySlug("Şanlıurfa")).toBe("sanliurfa");
    expect(normalizeCitySlug("İzmir ")).toBe("izmir");
  });

  it("normalizes city labels across variant spellings via the alias map", () => {
    expect(normalizeCityName("İstanbul Avrupa")).toBe("İstanbul");
    expect(normalizeCityName("İstanbul Anadolu Yakası")).toBe("İstanbul");
    expect(normalizeCityName("Gazi Antep")).toBe("Gaziantep");
    expect(normalizeCityName("İzmit")).toBe("Kocaeli");
  });

  it("keeps unknown city labels intact and trimmed", () => {
    expect(normalizeCityName("Muğla")).toBe("Muğla");
    expect(normalizeCityName("  Trabzon  ")).toBe("Trabzon");
  });

  it("returns an empty string for blank city input", () => {
    expect(normalizeCityName("")).toBe("");
    expect(normalizeCityName("   ")).toBe("");
  });

  it("resolves a slug from a raw city string", () => {
    expect(resolveCitySlug("İstanbul Avrupa Yakası")).toBe("istanbul");
    expect(resolveCitySlug("Gaziantep")).toBe("gaziantep");
  });
});

describe("buildCityCatalog", () => {
  const rows = [
    makeListingRow("1", "İstanbul", "EasyCep", 24000),
    makeListingRow("2", "İstanbul Avrupa", "Getmobil", 25000),
    makeListingRow("3", "Ankara", "Sahibinden", 21000),
    makeListingRow("4", "İzmir", "EasyCep", 22000),
    makeListingRow("5", "Türkiye", "EasyCep", 19000),
  ];

  it("aggregates listings by normalized city slug", () => {
    const catalog = buildCityCatalog(rows);
    const istanbul = catalog.find((entry) => entry.slug === "istanbul");
    const ankara = catalog.find((entry) => entry.slug === "ankara");
    expect(istanbul?.listingCount).toBe(2);
    expect(istanbul?.label).toBe("İstanbul");
    expect(ankara?.listingCount).toBe(1);
  });

  it("sorts the catalog by listing count descending", () => {
    const catalog = buildCityCatalog(rows);
    expect(catalog[0].slug).toBe("istanbul");
    expect(catalog[1].listingCount).toBeLessThanOrEqual(catalog[0].listingCount);
  });

  it("skips demo listings when building the catalog", () => {
    const catalog = buildCityCatalog([
      ...rows,
      {
        ...makeListingRow("demo-1", "İstanbul", "demo bot", 99999),
        title: "demo ürün",
      },
    ]);
    const istanbul = catalog.find((entry) => entry.slug === "istanbul");
    expect(istanbul?.listingCount).toBe(2);
  });

  it("returns an empty catalog for an empty row list", () => {
    expect(buildCityCatalog([])).toEqual([]);
  });

  it("tracks the latest listing timestamp per city", () => {
    const catalog = buildCityCatalog(rows);
    const istanbul = catalog.find((entry) => entry.slug === "istanbul");
    expect(istanbul?.latestListingAt).toBe("2026-07-02T00:00:00.000Z");
  });
});

describe("buildCityFaqItems", () => {
  const marketIntelligence = makeMarketIntelligence();
  const opportunityAnalysis = makeOpportunityAnalysis();
  const faqItems = buildCityFaqItems({
    cityName: "İstanbul",
    listingCount: marketIntelligence.marketSummary.totalListingCount,
    productCount: 8,
    sourceCount: marketIntelligence.marketSummary.sourceCount,
    marketIntelligence,
    opportunityAnalysis,
  });

  it("produces five city-safe FAQ entries", () => {
    expect(faqItems).toHaveLength(5);
    faqItems.forEach((item) => {
      expect(item.question.length).toBeGreaterThan(10);
      expect(item.answer.length).toBeGreaterThan(20);
    });
  });

  it("mentions the city name in the FAQ copy", () => {
    expect(faqItems[0].question).toContain("İstanbul");
    expect(faqItems[0].answer).toContain("İstanbul");
    expect(faqItems.some((item) => item.answer.includes("programmatic SEO"))).toBe(true);
  });

  it("references listing and source counts in the FAQ copy", () => {
    const sourceFaq = faqItems.find((item) => item.question.includes("Kaynak"));
    expect(sourceFaq?.answer).toContain("kaynak");
  });
});

describe("buildCityJsonLd", () => {
  const jsonLd = buildCityJsonLd({
    cityName: "İstanbul",
    citySlug: "istanbul",
    cityUrl: "https://2elbul.com/city/istanbul",
    summary: "İstanbul için 12 ilan ile piyasa resmi çıkarıldı.",
    faqItems: [
      { question: "İstanbul şehir sayfası nasıl hazırlanıyor?", answer: "Açıklama." },
    ],
    topOpportunities: [topOpportunity],
  });

  it("emits CollectionPage, BreadcrumbList, FAQPage and ItemList documents", () => {
    const types = jsonLd.map((document) => document["@type"]);
    expect(types).toEqual(
      expect.arrayContaining(["CollectionPage", "BreadcrumbList", "FAQPage", "ItemList"]),
    );
  });

  it("builds a two-step breadcrumb schema with canonical ids", () => {
    const breadcrumb = jsonLd.find((document) => document["@type"] === "BreadcrumbList");
    const elements = (breadcrumb as { itemListElement: Array<{ name: string; position: number; item: string }> }).itemListElement;
    expect(elements).toHaveLength(2);
    expect(elements[0].name).toBe("Ana Sayfa");
    expect(elements[1].name).toBe("İstanbul");
    expect(elements[1].item).toBe("https://2elbul.com/city/istanbul");
  });

  it("describes the city as a Place in the CollectionPage about field", () => {
    const collection = jsonLd.find(
      (document) => document["@type"] === "CollectionPage",
    ) as { about: { "@type": string; name: string } };
    expect(collection.about["@type"]).toBe("Place");
    expect(collection.about.name).toBe("İstanbul");
  });

  it("emits FAQ schema mirroring the faq items", () => {
    const faq = jsonLd.find((document) => document["@type"] === "FAQPage") as {
      mainEntity: Array<{ name: string }>;
    };
    expect(faq.mainEntity[0].name).toContain("İstanbul");
  });

  it("emits ItemList only when opportunities exist", () => {
    const withItems = buildCityJsonLd({
      cityName: "İstanbul",
      citySlug: "istanbul",
      cityUrl: "https://2elbul.com/city/istanbul",
      summary: "Özet.",
      faqItems: [],
      topOpportunities: [topOpportunity],
    });
    expect(withItems.find((document) => document["@type"] === "ItemList")).toBeDefined();

    const withoutItems = buildCityJsonLd({
      cityName: "İstanbul",
      citySlug: "istanbul",
      cityUrl: "https://2elbul.com/city/istanbul",
      summary: "Özet.",
      faqItems: [],
      topOpportunities: [],
    });
    expect(
      withoutItems.find((document) => document["@type"] === "ItemList"),
    ).toBeUndefined();
  });
});

describe("buildCityBrandDistribution", () => {
  const products = [
    { id: "1", name: "iPhone 13 128 GB", slug: "iphone-13", category: "Telefon" },
    { id: "2", name: "Samsung Galaxy S22", slug: "samsung-galaxy-s22", category: "Telefon" },
    { id: "3", name: "iPhone 14 Pro", slug: "iphone-14-pro", category: "Telefon" },
    { id: "4", name: "Genel Mobilya", slug: "genel-mobilya", category: "Ev" },
  ];
  const listings = [
    {
      id: "l1",
      productId: "1",
      productName: "iPhone 13 128 GB",
      title: "iPhone 13",
      price: 24000,
      city: "İstanbul",
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
      city: "İstanbul",
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
      city: "İstanbul",
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
    const distribution = buildCityBrandDistribution(products, listings);
    const apple = distribution.find((brand) => brand.brandSlug === "apple");
    const samsung = distribution.find((brand) => brand.brandSlug === "samsung");
    expect(apple).toBeDefined();
    expect(apple?.listingCount).toBe(2);
    expect(apple?.productCount).toBe(2);
    expect(samsung?.listingCount).toBe(1);
    expect(apple?.share).toBeGreaterThan(samsung?.share ?? 0);
  });

  it("skips products without a detectable brand", () => {
    const distribution = buildCityBrandDistribution(products, listings);
    expect(distribution.find((brand) => brand.brandName === "Genel Mobilya")).toBeUndefined();
  });

  it("returns an empty list when no products match a brand", () => {
    expect(buildCityBrandDistribution([], [])).toEqual([]);
  });
});
