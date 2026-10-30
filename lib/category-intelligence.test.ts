import { describe, expect, it } from "vitest";
import {
  buildBrandDistribution,
  buildCategoryFaqItems,
  buildCategoryJsonLd,
  buildEmptyCategoryPageData,
  isCategoryAlias,
  normalizeCategorySlug,
  resolveCanonicalSlug,
  scopeFromCategory,
  type CategoryScope,
} from "./category-intelligence";
import type { Category } from "@/lib/categories";
import { buildMarketIntelligence } from "@/lib/market-intelligence";
import type { MarketIntelligenceListing } from "@/lib/market-intelligence";
import { calculateProductIntelligence } from "@/lib/intelligence-engine";
import type { MarketPulseItem } from "@/lib/market-pulse";

function makeCategory(overrides: Partial<Category> & Pick<Category, "id" | "slug" | "name">): Category {
  return {
    parentId: null,
    icon: null,
    shortDescription: `${overrides.name} ikinci el piyasa analizi`,
    longDescription: `${overrides.name} için ikinci el fiyat rehberi.`,
    expectedProductType: null,
    displayOrder: 0,
    isFallback: false,
    ...overrides,
  };
}

const phoneRoute: CategoryScope = {
  slug: "telefon",
  label: "Telefon",
  shortDescription: "Cep telefonu ikinci el piyasa analizi",
  longDescription: "iPhone, Samsung Galaxy ve diğer telefonlar için ikinci el fiyat rehberi.",
  expectedProductType: "primary_product",
  parent: null,
};
const consoleRoute: CategoryScope = {
  slug: "konsol",
  label: "Oyun Konsolu",
  shortDescription: "PlayStation, Xbox ve Nintendo ikinci el analizi",
  longDescription: "Oyun konsolları için ikinci el fiyat rehberi.",
  parent: null,
};
const laptopRoute: CategoryScope = {
  slug: "bilgisayar-laptop",
  label: "Laptop",
  shortDescription: "Laptop ikinci el piyasa analizi",
  longDescription: "Laptop için ikinci el fiyat rehberi.",
  parent: { slug: "bilgisayar", label: "Bilgisayar" },
};

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

describe("category slugs and aliases", () => {
  it("keeps canonical slugs unchanged regardless of casing/diacritics", () => {
    expect(normalizeCategorySlug("telefon")).toBe("telefon");
    expect(normalizeCategorySlug("Telefon")).toBe("telefon");
    expect(normalizeCategorySlug("TV-Ses")).toBe("tv-ses");
    expect(normalizeCategorySlug("Yedek Parça")).toBe("yedek-parca");
    expect(isCategoryAlias("telefon")).toBe(false);
  });

  it("redirects common Turkish aliases to canonical category slugs", () => {
    expect(resolveCanonicalSlug("cep-telefonu")).toBe("telefon");
    expect(resolveCanonicalSlug("Cep Telefonu")).toBe("telefon");
    expect(resolveCanonicalSlug("akilli-telefon")).toBe("telefon");
    expect(resolveCanonicalSlug("dizüstü bilgisayar")).toBe("bilgisayar-laptop");
    expect(resolveCanonicalSlug("playstation")).toBe("konsol-playstation");
    expect(resolveCanonicalSlug("araba")).toBe("arac-otomobil");
    expect(resolveCanonicalSlug("TV")).toBe("tv-ses");
    expect(resolveCanonicalSlug("telefon-aksesuari")).toBe("aksesuar");
    expect(isCategoryAlias("cep-telefonu")).toBe(true);
  });

  it("redirects old slugs derived from category display names", () => {
    expect(resolveCanonicalSlug("TV ve Ses Sistemleri")).toBe("tv-ses");
    expect(resolveCanonicalSlug("Ev ve Yaşam")).toBe("ev-yasam");
    expect(resolveCanonicalSlug("Oyun Konsolu")).toBe("konsol");
  });

  it("redirects removed duplicate subcategories to their surviving twin", () => {
    expect(resolveCanonicalSlug("bilgisayar-parcalari")).toBe("yedek-parca-bilgisayar");
    expect(resolveCanonicalSlug("aksesuar-kulaklik")).toBe("tv-ses-kulaklik");
  });
});

describe("scopeFromCategory", () => {
  const computer = makeCategory({ id: 2, slug: "bilgisayar", name: "Bilgisayar", expectedProductType: "primary_product" });
  const laptop = makeCategory({ id: 10, slug: "bilgisayar-laptop", name: "Laptop", parentId: 2 });

  it("describes a main category without a parent", () => {
    const scope = scopeFromCategory({ category: computer, parent: null, children: [laptop] });
    expect(scope).toMatchObject({ slug: "bilgisayar", label: "Bilgisayar", parent: null, expectedProductType: "primary_product" });
  });

  it("links a subcategory to its parent and inherits the expected product type", () => {
    const scope = scopeFromCategory({ category: laptop, parent: computer, children: [] });
    expect(scope.parent).toEqual({ slug: "bilgisayar", label: "Bilgisayar" });
    expect(scope.expectedProductType).toBe("primary_product");
  });
});

describe("buildCategoryFaqItems", () => {
  const marketIntelligence = makeMarketIntelligence();
  const faqItems = buildCategoryFaqItems({
    categoryName: "Telefon",
    marketIntelligence,
  });

  it("answers user-facing price questions with the category name", () => {
    expect(faqItems).toHaveLength(4);
    expect(faqItems[0].question).toBe("İkinci el Telefon fiyatları ne kadar?");
    faqItems.forEach((item) => {
      expect(item.answer.length).toBeGreaterThan(20);
    });
  });

  it("quotes live listing and price numbers instead of internal jargon", () => {
    expect(faqItems[0].answer).toContain("12 ilan");
    expect(faqItems[1].answer).toContain("25.000");
    const copy = faqItems.map((item) => `${item.question} ${item.answer}`).join(" ");
    expect(copy).not.toMatch(/programmatic SEO|Market Intelligence|Opportunity Engine|fallback|duplicate/i);
  });

  it("references the source count", () => {
    const sourceFaq = faqItems.find((item) => item.question.includes("platform"));
    expect(sourceFaq?.answer).toContain("3 farklı platform");
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

  it("puts the parent category into a subcategory's breadcrumb", () => {
    const documents = buildCategoryJsonLd({
      route: laptopRoute,
      categoryUrl: "https://2elbul.com/category/bilgisayar-laptop",
      summary: "Laptop özeti",
      faqItems: [],
      topOpportunities: [],
    });
    const breadcrumb = documents.find((document) => document["@type"] === "BreadcrumbList");
    const elements = (breadcrumb as { itemListElement: Array<{ name: string; position: number }> }).itemListElement;
    expect(elements.map((element) => element.name)).toEqual(["Ana Sayfa", "Bilgisayar", "Laptop"]);
    expect(elements.map((element) => element.position)).toEqual([1, 2, 3]);
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
