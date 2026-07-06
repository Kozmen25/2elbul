import { cache } from "react";
import type { ConfidenceLevel } from "@/lib/confidence-engine";
import type { ListingCondition, ListingSource } from "@/lib/listings";
import { isMissingStatusColumn } from "@/lib/listing-status";
import { calculateProductIntelligence } from "@/lib/intelligence-engine";
import { buildMarketIntelligence, type MarketIntelligence, type MarketIntelligenceListing } from "@/lib/market-intelligence";
import { toConfidenceResult, toConfidenceLevel } from "@/lib/market-intelligence/helpers";
import { buildMarketPulse, type MarketPulse, type MarketPulseItem } from "@/lib/market-pulse";
import { formatBrandDisplayName, extractBrand } from "@/lib/normalization";
import { createProductSlug } from "@/lib/product-slug";
import { getAbsoluteUrl } from "@/lib/site-url";
import { isPublicDemoListing, isPublicDemoProductName } from "@/lib/public-data-cleanup";
import { createSupabaseClient } from "@/lib/supabase";
import {
  buildProductDecisionInsight,
  resolveProductDetailDuplicateSummary,
} from "@/lib/product-detail";
import {
  buildOpportunityAnalysis,
  type OpportunityAnalysis,
} from "@/lib/opportunity-engine";
import type { DuplicateBatchSummary } from "@/lib/product-matcher";

export type CityCatalogEntry = {
  slug: string;
  label: string;
  listingCount: number;
  latestListingAt: string | null;
};

export type CityProductRecord = {
  id: string;
  name: string;
  slug: string;
  category: string | null;
};

export type CitySearchEventRecord = {
  productId: string | number | null;
  createdAt: string | null;
};

export type CitySearchDemandRecord = {
  query: string | null;
  normalizedQuery: string | null;
  createdAt: string | null;
};

export type CityListingRecord = {
  id: string;
  productId: string;
  productName: string;
  title: string;
  price: number;
  city: string;
  source: ListingSource;
  url: string;
  condition: ListingCondition;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string | null;
  confidenceScore: number | null;
  confidenceLevel: ConfidenceLevel | null;
};

export type CityBrandDistributionEntry = {
  brandSlug: string;
  brandName: string;
  productCount: number;
  listingCount: number;
  share: number;
};

export type CityFaqItem = {
  question: string;
  answer: string;
};

export type CityCollectionPageJsonLd = {
  "@context": "https://schema.org";
  "@type": "CollectionPage";
  name: string;
  description: string;
  url: string;
  about: {
    "@type": "Place";
    name: string;
  };
  breadcrumb: {
    "@id": string;
  };
};

export type CityBreadcrumbJsonLd = {
  "@context": "https://schema.org";
  "@type": "BreadcrumbList";
  "@id": string;
  itemListElement: Array<{
    "@type": "ListItem";
    position: number;
    name: string;
    item: string;
  }>;
};

export type CityFaqJsonLd = {
  "@context": "https://schema.org";
  "@type": "FAQPage";
  "@id": string;
  mainEntity: Array<{
    "@type": "Question";
    name: string;
    acceptedAnswer: {
      "@type": "Answer";
      text: string;
    };
  }>;
};

export type CityItemListJsonLd = {
  "@context": "https://schema.org";
  "@type": "ItemList";
  "@id": string;
  name: string;
  itemListOrder: "https://schema.org/ItemListOrderDescending";
  itemListElement: Array<{
    "@type": "ListItem";
    position: number;
    name: string;
    url: string;
    item: {
      "@type": "Product";
      name: string;
      url: string;
    };
  }>;
};

export type CityJsonLdDocument =
  | CityCollectionPageJsonLd
  | CityBreadcrumbJsonLd
  | CityFaqJsonLd
  | CityItemListJsonLd;

export type CityPageData = {
  citySlug: string;
  cityName: string;
  cityUrl: string;
  productCount: number;
  listingCount: number;
  marketIntelligence: MarketIntelligence;
  opportunityAnalysis: OpportunityAnalysis;
  duplicateSummary: DuplicateBatchSummary;
  marketPulse: MarketPulse;
  topOpportunities: MarketPulseItem[];
  popularProducts: MarketPulseItem[];
  latestListings: CityListingRecord[];
  brandDistribution: CityBrandDistributionEntry[];
  faqItems: CityFaqItem[];
  jsonLd: CityJsonLdDocument[];
};

type ProductRow = {
  id: string | number;
  name: string;
  slug?: string | null;
  category?: string | null;
};

export type CityListingRow = {
  id: string | number;
  product_id: string | number | null;
  title: string | null;
  price: string | number | null;
  city: string | null;
  source: string | null;
  url: string | null;
  condition: string | null;
  image_url?: string | null;
  created_at: string | null;
  updated_at?: string | null;
  confidence_score?: string | number | null;
};

const CITY_LISTING_LIMIT = 2000;
const CITY_LISTING_BATCH_SIZE = 100;
const SEARCH_LIMIT = 1000;
const MIN_CITY_LISTINGS = 1;

const CITY_ALIAS_MAP: Record<string, string> = {
  istanbul: "İstanbul",
  "istanbul-avrupa": "İstanbul",
  "istanbul-anadolu": "İstanbul",
  "istanbul-avr": "İstanbul",
  "istanbul-anad": "İstanbul",
  "istanbul-avrupa-yakasi": "İstanbul",
  "istanbul-anadolu-yakasi": "İstanbul",
  ankara: "Ankara",
  izmir: "İzmir",
  bursa: "Bursa",
  antalya: "Antalya",
  konya: "Konya",
  kocaeli: "Kocaeli",
  "gazi-antep": "Gaziantep",
  gaziantep: "Gaziantep",
  "san-liurfa": "Şanlıurfa",
  sanliurfa: "Şanlıurfa",
  "kir-sehir": "Kırşehir",
  kirsehir: "Kırşehir",
  eskisehir: "Eskişehir",
  "eski-sehir": "Eskişehir",
};

export function normalizeCitySlug(input: string): string {
  return createProductSlug(input);
}

export function normalizeCityName(input: string): string {
  if (!input) return "";
  const trimmed = input.trim();
  if (!trimmed) return "";

  const slugKey = normalizeCitySlug(trimmed);
  if (CITY_ALIAS_MAP[slugKey]) return CITY_ALIAS_MAP[slugKey];

  const lowercased = trimmed.toLocaleLowerCase("tr-TR");
  if (lowercased.includes("istanbul")) return "İstanbul";
  if (lowercased.includes("ankara")) return "Ankara";
  if (lowercased.includes("izmir")) return "İzmir";
  if (lowercased.includes("bursa")) return "Bursa";
  if (lowercased.includes("antalya")) return "Antalya";
  if (lowercased.includes("konya")) return "Konya";
  if (lowercased.includes("kocaeli") || lowercased.includes("izmit")) return "Kocaeli";
  if (lowercased.includes("gaziantep") || lowercased.includes("gazi antep")) return "Gaziantep";

  return trimmed.replace(/\s+/g, " ");
}

export function resolveCitySlug(input: string): string {
  return normalizeCitySlug(normalizeCityName(input));
}

export const getCityCatalog = cache(async (): Promise<CityCatalogEntry[]> => {
  const supabase = createSupabaseClient();
  if (!supabase) return [];

  const rows = await fetchAllCityListingRows(supabase);
  return buildCityCatalog(rows);
});

export function buildCityCatalog(rows: CityListingRow[]): CityCatalogEntry[] {
  const aggregate = new Map<
    string,
    { label: string; listingCount: number; latestListingAt: string | null }
  >();

  for (const row of rows) {
    if (!row.city || isPublicDemoListing({ title: row.title, source: row.source, url: row.url })) {
      continue;
    }
    const label = normalizeCityName(String(row.city));
    if (!label) continue;
    const slug = normalizeCitySlug(label);
    const current = aggregate.get(slug) ?? {
      label,
      listingCount: 0,
      latestListingAt: null,
    };
    current.listingCount += 1;
    current.latestListingAt = chooseLatestTimestamp(
      current.latestListingAt,
      row.updated_at ?? row.created_at ?? null,
    );
    aggregate.set(slug, current);
  }

  return [...aggregate.entries()]
    .map(([slug, entry]) => ({
      slug,
      label: entry.label,
      listingCount: entry.listingCount,
      latestListingAt: entry.latestListingAt,
    }))
    .filter((entry) => entry.listingCount >= MIN_CITY_LISTINGS)
    .sort(
      (a, b) =>
        b.listingCount - a.listingCount ||
        a.label.localeCompare(b.label, "tr"),
    );
}

export const getCityPageData = cache(
  async (citySlug: string): Promise<CityPageData | null> => {
    const slug = normalizeCitySlug(citySlug);
    const supabase = createSupabaseClient();
    if (!supabase) return null;

    const listingRows = await fetchAllCityListingRows(supabase);
    const cityRows = listingRows.filter(
      (row) =>
        row.city &&
        normalizeCitySlug(normalizeCityName(String(row.city))) === slug,
    );

    if (!cityRows.length) return null;

    const cityName = normalizeCityName(String(cityRows[0].city));
    const productIds = [
      ...new Set(
        cityRows
          .map((row) => (row.product_id == null ? null : String(row.product_id)))
          .filter((value): value is string => value !== null),
      ),
    ];

    const productRecords = await fetchCityProducts(supabase, productIds);
    const productLookup = new Map(productRecords.map((product) => [product.id, product]));
    const cityProducts = productRecords.filter((product) =>
      productIds.includes(product.id),
    );

    const searchEvents = await fetchSearchEvents(supabase);
    const searchDemands = await fetchSearchDemands(supabase);
    const listings = buildCityListings(cityRows, productLookup, cityName);

    if (!listings.length) return null;

    return buildCityPageDataFromRecords({
      citySlug: slug,
      cityName,
      products: cityProducts,
      listings,
      searchEvents,
      searchDemands,
    });
  },
);

function buildCityPageDataFromRecords({
  citySlug,
  cityName,
  products,
  listings,
  searchEvents,
  searchDemands,
}: {
  citySlug: string;
  cityName: string;
  products: CityProductRecord[];
  listings: CityListingRecord[];
  searchEvents: CitySearchEventRecord[];
  searchDemands: CitySearchDemandRecord[];
}): CityPageData {
  const cityUrl = getAbsoluteUrl(`/city/${citySlug}`);
  const latestListingAt = getLatestListingTimestamp(listings);
  const duplicateSummary = resolveProductDetailDuplicateSummary(
    listings.map((listing) => ({
      id: listing.id,
      title: listing.title,
      price: listing.price,
      source: listing.source,
      condition: listing.condition,
    })),
  );
  const intelligence = calculateProductIntelligence({
    listings: listings.map((listing) => ({
      price: listing.price,
      createdAt: listing.createdAt,
    })),
  });
  const decisionInsight = buildProductDecisionInsight(
    cityName,
    listings.map((listing) => ({
      id: listing.id,
      productId: listing.productId,
      title: listing.title,
      productName: listing.productName,
      price: listing.price,
      city: listing.city,
      source: listing.source,
      url: listing.url,
      condition: listing.condition,
      imageUrl: listing.imageUrl,
      createdAt: listing.createdAt,
      updatedAt: listing.updatedAt,
    })),
    [],
  );
  const marketIntelligence = buildMarketIntelligence({
    scope: {
      productId: `city-${citySlug}`,
      productName: cityName,
      slug: citySlug,
      url: cityUrl,
      category: "Şehir",
      brand: cityName,
      city: cityName,
    },
    listings: listings.map((listing) => ({
      id: listing.id,
      title: listing.title,
      price: listing.price,
      source: listing.source,
      city: listing.city,
      condition: listing.condition,
      createdAt: listing.createdAt,
      updatedAt: listing.updatedAt,
      productId: listing.productId,
      productName: listing.productName,
      status: "published",
      confidenceScore: listing.confidenceScore,
      confidenceLevel: listing.confidenceLevel,
    })),
    intelligence,
    decisionInsight: {
      confidence: toConfidenceResult(
        decisionInsight.confidence.score,
        decisionInsight.confidence.reasons,
      ),
      smartPrice: decisionInsight.smartPrice,
    },
    duplicateSummary,
    analyzedAt: latestListingAt ?? new Date(),
  });
  const opportunityAnalysis = buildOpportunityAnalysis({
    marketIntelligence,
    intelligence,
    duplicateSummary,
    analyzedAt: marketIntelligence.analysisGeneratedAt,
    latestListingAt,
  });
  const marketPulse = buildMarketPulse({
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
    })),
    listings: listings.map((listing) => ({
      productId: listing.productId,
      productName: listing.productName,
      price: listing.price,
      createdAt: listing.createdAt,
    })),
    searches: buildCitySearches(searchEvents, searchDemands),
  });
  const topOpportunities = marketPulse.topOpportunities.slice(0, 6);
  const popularProducts =
    marketPulse.mostSearchedProducts.length > 0
      ? marketPulse.mostSearchedProducts.slice(0, 6)
      : marketPulse.mostListedProducts.slice(0, 6);
  const latestListings = [...listings]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
        a.productName.localeCompare(b.productName, "tr"),
    )
    .slice(0, 6);
  const brandDistribution = buildCityBrandDistribution(products, listings);
  const faqItems = buildCityFaqItems({
    cityName,
    listingCount: marketIntelligence.marketSummary.totalListingCount,
    productCount: products.length,
    sourceCount: marketIntelligence.marketSummary.sourceCount,
    marketIntelligence,
    opportunityAnalysis,
  });
  const jsonLd = buildCityJsonLd({
    cityName,
    citySlug,
    cityUrl,
    summary: marketIntelligence.marketSummary.summary,
    faqItems,
    topOpportunities: topOpportunities.length > 0 ? topOpportunities : popularProducts,
  });

  return {
    citySlug,
    cityName,
    cityUrl,
    productCount: products.length,
    listingCount: marketIntelligence.marketSummary.totalListingCount,
    marketIntelligence,
    opportunityAnalysis,
    duplicateSummary,
    marketPulse,
    topOpportunities,
    popularProducts,
    latestListings,
    brandDistribution,
    faqItems,
    jsonLd,
  };
}

export function buildCityBrandDistribution(
  products: CityProductRecord[],
  listings: CityListingRecord[],
): CityBrandDistributionEntry[] {
  const productBrand = new Map(products.map((product) => [product.id, extractBrand(product.name)]));
  const aggregate = new Map<
    string,
    { productCount: number; listingCount: number }
  >();

  for (const product of products) {
    const brandSlug = productBrand.get(product.id);
    if (!brandSlug) continue;
    const current = aggregate.get(brandSlug) ?? { productCount: 0, listingCount: 0 };
    current.productCount += 1;
    aggregate.set(brandSlug, current);
  }

  for (const listing of listings) {
    const brandSlug = productBrand.get(listing.productId);
    if (!brandSlug) continue;
    const current = aggregate.get(brandSlug) ?? { productCount: 0, listingCount: 0 };
    current.listingCount += 1;
    aggregate.set(brandSlug, current);
  }

  const totalListings = listings.length || 1;

  return [...aggregate.entries()]
    .map(([brandSlug, entry]) => ({
      brandSlug,
      brandName: formatBrandDisplayName(brandSlug) ?? brandSlug,
      productCount: entry.productCount,
      listingCount: entry.listingCount,
      share: roundShare(entry.listingCount / totalListings),
    }))
    .sort(
      (a, b) =>
        b.listingCount - a.listingCount ||
        b.productCount - a.productCount ||
        a.brandName.localeCompare(b.brandName, "tr"),
    )
    .slice(0, 8);
}

export function buildCityFaqItems({
  cityName,
  listingCount,
  productCount,
  sourceCount,
  marketIntelligence,
  opportunityAnalysis,
}: {
  cityName: string;
  listingCount: number;
  productCount: number;
  sourceCount: number;
  marketIntelligence: MarketIntelligence;
  opportunityAnalysis: OpportunityAnalysis;
}): CityFaqItem[] {
  const listingText =
    listingCount > 0
      ? `${listingCount.toLocaleString("tr-TR")} ilan`
      : "henüz yeterli ilan";
  const sourceText =
    sourceCount > 0
      ? `${sourceCount.toLocaleString("tr-TR")} kaynak`
      : "kaynak çeşitliliği oluşmadan";

  return [
    {
      question: `${cityName} şehir sayfası nasıl hazırlanıyor?`,
      answer: `2ElBul, ${cityName} ilanlarını ve bu ilanlara bağlı ürünleri tek yerde toplar. Market Intelligence, Opportunity Engine ve Product Matcher çıktıları birlikte kullanılarak ${cityName} ikinci el piyasa resmi çıkarılır.`,
    },
    {
      question: `${cityName} ilanlarında en iyi fırsatlar nasıl seçiliyor?`,
      answer: `Fırsat skoru, risk seviyesi, confidence ve duplicate yoğunluğu birlikte değerlendirilir. Bu sayfada ${cityName} için en güçlü sinyaller öne çıkarılır.`,
    },
    {
      question: "Yetersiz veri ne zaman gösterilir?",
      answer: `${cityName} için ${listingText} oluştuğunda ve yeterli karşılaştırma kurulamadığında güvenli fallback gösterilir; karar notu veri çoğaldıkça otomatik güçlenir.`,
    },
    {
      question: "Kaynak sayısı neden önemli?",
      answer: `${sourceText} analiz yapmak fiyat bandını daha güvenilir hale getirir. ${marketIntelligence.sampleSize.toLocaleString("tr-TR")} ilan üzerinden üretilen kararlar daha dengeli olur.`,
    },
    {
      question: "Bu sayfa SEO için neden uygun?",
      answer: `${cityName} sayfası şehir bazlı, kanonik ve tekrar üretilebilir bir analiz katmanı sunar. Bu yapı programmatic SEO için ölçeklenebilir bir temel oluşturur.`,
    },
  ];
}

export function buildCityJsonLd({
  cityName,
  citySlug,
  cityUrl,
  summary,
  faqItems,
  topOpportunities,
}: {
  cityName: string;
  citySlug: string;
  cityUrl: string;
  summary: string;
  faqItems: CityFaqItem[];
  topOpportunities: MarketPulseItem[];
}): CityJsonLdDocument[] {
  const breadcrumbId = `${cityUrl}#breadcrumb`;
  const faqId = `${cityUrl}#faq`;
  const itemListId = `${cityUrl}#top-opportunities`;

  const documents: CityJsonLdDocument[] = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `${cityName} ikinci el piyasa analizi`,
      description: summary,
      url: cityUrl,
      about: {
        "@type": "Place",
        name: cityName,
      },
      breadcrumb: {
        "@id": breadcrumbId,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "@id": breadcrumbId,
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Ana Sayfa",
          item: getAbsoluteUrl("/"),
        },
        {
          "@type": "ListItem",
          position: 2,
          name: cityName,
          item: cityUrl,
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "@id": faqId,
      mainEntity: faqItems.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.answer,
        },
      })),
    },
  ];

  if (topOpportunities.length > 0) {
    documents.push({
      "@context": "https://schema.org",
      "@type": "ItemList",
      "@id": itemListId,
      name: `${cityName} için en iyi fırsatlar`,
      itemListOrder: "https://schema.org/ItemListOrderDescending",
      itemListElement: topOpportunities.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.productName,
        url: getAbsoluteUrl(item.href),
        item: {
          "@type": "Product",
          name: item.productName,
          url: getAbsoluteUrl(item.href),
        },
      })),
    });
  }

  return documents;
}

function buildCityListings(
  rows: CityListingRow[],
  productLookup: Map<string, CityProductRecord>,
  cityName: string,
): CityListingRecord[] {
  return rows
    .map((row) => {
      const productId = row.product_id == null ? null : String(row.product_id);
      if (!productId) return null;

      const product = productLookup.get(productId);
      if (!product || !row.title || !row.city || !row.source || !row.url || !row.condition) {
        return null;
      }

      if (
        isPublicDemoListing({
          title: row.title,
          productName: product.name,
          source: row.source,
          url: row.url,
        })
      ) {
        return null;
      }

      const price = Number(row.price);
      if (!Number.isFinite(price) || price <= 0) return null;

      const confidenceScore = normalizeScore(row.confidence_score);

      return {
        id: String(row.id),
        productId,
        productName: product.name,
        title: String(row.title),
        price,
        city: cityName,
        source: row.source as ListingSource,
        url: String(row.url),
        condition: row.condition as ListingCondition,
        imageUrl: row.image_url ? String(row.image_url) : null,
        createdAt: String(row.created_at),
        updatedAt: row.updated_at ? String(row.updated_at) : null,
        confidenceScore,
        confidenceLevel: confidenceScore !== null ? toConfidenceLevel(confidenceScore) : null,
      };
    })
    .filter((listing): listing is CityListingRecord => listing !== null);
}

function normalizeScore(value: unknown) {
  if (value == null || value === "") return null;
  const score = typeof value === "number" ? value : Number(value);
  return Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : null;
}

function roundShare(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 1000) / 1000;
}

function chooseLatestTimestamp(current: string | null, candidate: string | null) {
  if (!candidate) return current;
  if (!current) return candidate;

  const currentTime = new Date(current).getTime();
  const candidateTime = new Date(candidate).getTime();
  if (!Number.isFinite(candidateTime)) return current;
  if (!Number.isFinite(currentTime) || candidateTime > currentTime) return candidate;
  return current;
}

function getLatestListingTimestamp(listings: CityListingRecord[]) {
  let latest: string | null = null;
  for (const listing of listings) {
    latest = chooseLatestTimestamp(latest, listing.updatedAt ?? listing.createdAt);
  }
  return latest;
}

async function fetchAllCityListingRows(
  supabase: NonNullable<ReturnType<typeof createSupabaseClient>>,
): Promise<CityListingRow[]> {
  let useStatusColumn = true;
  let useUpdatedAtColumn = true;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const columns = [
      "id",
      "product_id",
      "title",
      "price",
      "city",
      "source",
      "url",
      "condition",
      "image_url",
      "created_at",
      "confidence_score",
      ...(useUpdatedAtColumn ? ["updated_at"] : []),
      ...(useStatusColumn ? ["status"] : []),
    ].join(", ");

    let query = supabase
      .from("listings")
      .select(columns)
      .order("created_at", { ascending: false })
      .limit(CITY_LISTING_LIMIT);
    if (useStatusColumn) {
      query = query.in("status", ["published", "active"]);
    }

    const result = await query;
    if (!result.error) {
      return (result.data ?? []) as unknown as CityListingRow[];
    }

    if (useUpdatedAtColumn && isMissingListingUpdatedAtColumn(result.error)) {
      useUpdatedAtColumn = false;
      continue;
    }

    if (useStatusColumn && isMissingStatusColumn(result.error)) {
      useStatusColumn = false;
      continue;
    }

    console.error("City listing query failed:", result.error);
    return [];
  }

  return [];
}

async function fetchCityProducts(
  supabase: NonNullable<ReturnType<typeof createSupabaseClient>>,
  productIds: string[],
): Promise<CityProductRecord[]> {
  if (!productIds.length) return [];

  let includeCategory = true;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const columns = includeCategory
      ? "id, name, slug, category"
      : "id, name, slug";
    const result = await supabase
      .from("products")
      .select(columns)
      .in("id", productIds);

    if (result.error) {
      if (includeCategory && isMissingProductCategoryColumn(result.error)) {
        includeCategory = false;
        continue;
      }
      console.error("City product query failed:", result.error);
      return [];
    }

    return ((result.data ?? []) as unknown as ProductRow[])
      .filter((row) => !isPublicDemoProductName(String(row.name)))
      .map((row) => ({
        id: String(row.id),
        name: String(row.name),
        slug: row.slug ? String(row.slug) : createProductSlug(String(row.name)),
        category: "category" in row && row.category ? String(row.category) : null,
      }));
  }

  return [];
}

async function fetchSearchEvents(
  supabase: NonNullable<ReturnType<typeof createSupabaseClient>>,
) {
  const result = await supabase
    .from("search_events")
    .select("product_id, created_at")
    .order("created_at", { ascending: false })
    .limit(SEARCH_LIMIT);

  if (result.error) {
    console.error("City search events query failed:", result.error);
    return [] as CitySearchEventRecord[];
  }

  return ((result.data ?? []) as Array<{
    product_id: string | number | null;
    created_at: string | null;
  }>).map((row) => ({
    productId: row.product_id,
    createdAt: row.created_at ? String(row.created_at) : null,
  }));
}

async function fetchSearchDemands(
  supabase: NonNullable<ReturnType<typeof createSupabaseClient>>,
) {
  const result = await supabase
    .from("search_demands")
    .select("query, normalized_query, requested_at")
    .order("requested_at", { ascending: false })
    .limit(SEARCH_LIMIT);

  if (result.error) {
    console.error("City search demands query failed:", result.error);
    return [] as CitySearchDemandRecord[];
  }

  return ((result.data ?? []) as Array<{
    query?: string | null;
    normalized_query?: string | null;
    requested_at?: string | null;
  }>).map((row) => ({
    query: row.query ? String(row.query) : null,
    normalizedQuery: row.normalized_query ? String(row.normalized_query) : null,
    createdAt: row.requested_at ? String(row.requested_at) : null,
  }));
}

function buildCitySearches(
  events: CitySearchEventRecord[],
  demands: CitySearchDemandRecord[],
) {
  return [
    ...events.map((event) => ({
      productId: event.productId,
      createdAt: event.createdAt,
    })),
    ...demands.map((demand) => ({
      query: demand.query,
      normalizedQuery: demand.normalizedQuery,
      createdAt: demand.createdAt,
    })),
  ];
}

function isMissingProductCategoryColumn(error: unknown) {
  return isMissingColumn(error, "category");
}

function isMissingListingUpdatedAtColumn(error: unknown) {
  return isMissingColumn(error, "updated_at");
}

function isMissingColumn(error: unknown, column: string) {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: string; message?: string; details?: string };
  const text = `${record.message ?? ""} ${record.details ?? ""}`.toLowerCase();
  return (
    record.code === "42703" ||
    record.code === "PGRST204" ||
    text.includes(column.toLowerCase())
  );
}

export { CITY_LISTING_BATCH_SIZE };
