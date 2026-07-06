import { cache } from "react";
import type { ConfidenceLevel } from "@/lib/confidence-engine";
import type { ListingCondition, ListingSource } from "@/lib/listings";
import { isMissingStatusColumn } from "@/lib/listing-status";
import { calculateProductIntelligence, type ProductIntelligence } from "@/lib/intelligence-engine";
import { buildMarketIntelligence, type MarketIntelligence, type MarketIntelligenceListing } from "@/lib/market-intelligence";
import { toConfidenceResult } from "@/lib/market-intelligence/helpers";
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
import { toConfidenceLevel } from "@/lib/market-intelligence/helpers";

export type BrandCatalogEntry = {
  slug: string;
  name: string;
  productCount: number;
  latestProductAt: string | null;
};

export type BrandProductRecord = {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  createdAt: string | null;
};

export type BrandSearchEventRecord = {
  productId: string | number | null;
  createdAt: string | null;
};

export type BrandSearchDemandRecord = {
  query: string | null;
  normalizedQuery: string | null;
  createdAt: string | null;
};

export type BrandListingRecord = {
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

export type BrandFaqItem = {
  question: string;
  answer: string;
};

export type BrandCollectionPageJsonLd = {
  "@context": "https://schema.org";
  "@type": "CollectionPage";
  name: string;
  description: string;
  url: string;
  about: {
    "@type": "Brand";
    name: string;
  };
  breadcrumb: {
    "@id": string;
  };
};

export type BrandBreadcrumbJsonLd = {
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

export type BrandFaqJsonLd = {
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

export type BrandItemListJsonLd = {
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

export type BrandJsonLdDocument =
  | BrandCollectionPageJsonLd
  | BrandBreadcrumbJsonLd
  | BrandFaqJsonLd
  | BrandItemListJsonLd;

export type BrandPageData = {
  brandSlug: string;
  brandName: string;
  brandUrl: string;
  productCount: number;
  listingCount: number;
  marketIntelligence: MarketIntelligence;
  opportunityAnalysis: OpportunityAnalysis;
  duplicateSummary: DuplicateBatchSummary;
  marketPulse: MarketPulse;
  topOpportunities: MarketPulseItem[];
  popularProducts: MarketPulseItem[];
  latestListings: BrandListingRecord[];
  faqItems: BrandFaqItem[];
  jsonLd: BrandJsonLdDocument[];
};

type BrandCatalogRow = {
  id: string | number;
  name: string;
  slug?: string | null;
  category?: string | null;
  created_at?: string | null;
};

type BrandListingRow = {
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

const BRAND_CATALOG_PAGE_SIZE = 1000;
const BRAND_LISTING_BATCH_SIZE = 100;
const SEARCH_LIMIT = 1000;

export const getBrandCatalog = cache(async (): Promise<BrandCatalogEntry[]> => {
  const supabase = createSupabaseClient();
  if (!supabase) return [];

  const products = await fetchAllBrandProducts(supabase);
  return buildBrandCatalog(products);
});

export const getBrandPageData = cache(
  async (brandSlug: string): Promise<BrandPageData | null> => {
    const normalizedBrandSlug = normalizeBrandSlug(brandSlug);
    const brandName = formatBrandDisplayName(normalizedBrandSlug);
    const supabase = createSupabaseClient();
    if (!supabase || !brandName) return null;

    const products = await fetchAllBrandProducts(supabase);
    const brandProducts = products.filter(
      (product) => extractBrand(product.name) === normalizedBrandSlug,
    );

    if (!brandProducts.length) return null;

    const productLookup = new Map(brandProducts.map((product) => [product.id, product]));
    const productIds = [...productLookup.keys()];
    const listingRows = await fetchBrandListings(supabase, productIds);
    const searchEvents = await fetchSearchEvents(supabase);
    const searchDemands = await fetchSearchDemands(supabase);
    const listings = buildBrandListings(listingRows, productLookup);
    const latestListingAt = getLatestListingTimestamp(listings);
    const brandUrl = getAbsoluteUrl(`/brand/${normalizedBrandSlug}`);
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
      brandName,
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
        productId: `brand-${normalizedBrandSlug}`,
        productName: brandName,
        slug: normalizedBrandSlug,
        url: brandUrl,
        category: "Marka",
        brand: brandName,
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
      products: brandProducts.map((product) => ({
        id: product.id,
        name: product.name,
      })),
      listings: listings.map((listing) => ({
        productId: listing.productId,
        productName: listing.productName,
        price: listing.price,
        createdAt: listing.createdAt,
      })),
      searches: buildBrandSearches(searchEvents, searchDemands),
    });
    const topOpportunities = marketPulse.topOpportunities.slice(0, 6);
    const popularProducts = marketPulse.mostSearchedProducts.length > 0
      ? marketPulse.mostSearchedProducts.slice(0, 6)
      : marketPulse.mostListedProducts.slice(0, 6);
    const latestListings = [...listings]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
          a.productName.localeCompare(b.productName, "tr"),
      )
      .slice(0, 6);
    const faqItems = buildBrandFaqItems({
      brandName,
      listingCount: marketIntelligence.marketSummary.totalListingCount,
      productCount: brandProducts.length,
      sourceCount: marketIntelligence.marketSummary.sourceCount,
      marketIntelligence,
      opportunityAnalysis,
    });
    const jsonLd = buildBrandJsonLd({
      brandName,
      brandUrl,
      summary: marketIntelligence.marketSummary.summary,
      faqItems,
      topOpportunities: topOpportunities.length > 0 ? topOpportunities : popularProducts,
    });

    return {
      brandSlug: normalizedBrandSlug,
      brandName,
      brandUrl,
      productCount: brandProducts.length,
      listingCount: marketIntelligence.marketSummary.totalListingCount,
      marketIntelligence,
      opportunityAnalysis,
      duplicateSummary,
      marketPulse,
      topOpportunities,
      popularProducts,
      latestListings,
      faqItems,
      jsonLd,
    };
  },
);

export function buildBrandCatalog(products: BrandCatalogRow[]): BrandCatalogEntry[] {
  const catalog = new Map<
    string,
    {
      name: string;
      productCount: number;
      latestProductAt: string | null;
    }
  >();

  for (const product of products) {
    if (isPublicDemoProductName(product.name)) continue;
    const brandSlug = extractBrand(product.name);
    if (!brandSlug) continue;

    const current = catalog.get(brandSlug) ?? {
      name: formatBrandDisplayName(brandSlug) ?? brandSlug,
      productCount: 0,
      latestProductAt: null,
    };

    current.productCount += 1;
    current.latestProductAt = chooseLatestTimestamp(current.latestProductAt, product.created_at ?? null);
    catalog.set(brandSlug, current);
  }

  return [...catalog.entries()]
    .map(([slug, entry]) => ({
      slug,
      name: entry.name,
      productCount: entry.productCount,
      latestProductAt: entry.latestProductAt,
    }))
    .sort(
      (a, b) =>
        b.productCount - a.productCount ||
        a.name.localeCompare(b.name, "tr"),
    );
}

export function buildBrandFaqItems({
  brandName,
  listingCount,
  productCount,
  sourceCount,
  marketIntelligence,
  opportunityAnalysis,
}: {
  brandName: string;
  listingCount: number;
  productCount: number;
  sourceCount: number;
  marketIntelligence: MarketIntelligence;
  opportunityAnalysis: OpportunityAnalysis;
}): BrandFaqItem[] {
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
      question: `${brandName} marka sayfası nasıl hazırlanıyor?`,
      answer: `2ElBul, ${brandName} ile eşleşen ürünleri ve bu ürünlere bağlı ilanları tek yerde toplar. Market Intelligence, Opportunity Engine ve Product Matcher çıktıları birlikte kullanılır.`,
    },
    {
      question: "En iyi fırsatlar nasıl seçiliyor?",
      answer: `Fırsat skoru, risk seviyesi, confidence ve duplicate yoğunluğu birlikte değerlendirilir. Bu sayfada ${brandName} için en güçlü sinyaller öne çıkarılır.`,
    },
    {
      question: "Yetersiz veri ne zaman gösterilir?",
      answer: `${brandName} için ${listingText} oluştuğunda ve yeterli karşılaştırma kurulamadığında güvenli fallback gösterilir; karar notu veri çoğaldıkça otomatik güçlenir.`,
    },
    {
      question: "Kaynak sayısı neden önemli?",
      answer: `${sourceText} analiz yapmak fiyat bandını daha güvenilir hale getirir. ${marketIntelligence.sampleSize.toLocaleString("tr-TR")} ilan üzerinden üretilen kararlar daha dengeli olur.`,
    },
    {
      question: "Bu sayfa SEO için neden uygun?",
      answer: `${brandName} sayfası marka bazlı, kanonik ve tekrar üretilebilir bir analiz katmanı sunar. Bu yapı ileride programmatic SEO, marka sayfaları ve analiz sayfaları için ölçeklenebilir bir temel oluşturur.`,
    },
  ];
}

export function buildBrandJsonLd({
  brandName,
  brandUrl,
  summary,
  faqItems,
  topOpportunities,
}: {
  brandName: string;
  brandUrl: string;
  summary: string;
  faqItems: BrandFaqItem[];
  topOpportunities: MarketPulseItem[];
}): BrandJsonLdDocument[] {
  const breadcrumbId = `${brandUrl}#breadcrumb`;
  const faqId = `${brandUrl}#faq`;
  const itemListId = `${brandUrl}#top-opportunities`;

  const documents: BrandJsonLdDocument[] = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `${brandName} ikinci el analizi`,
      description: summary,
      url: brandUrl,
      about: {
        "@type": "Brand",
        name: brandName,
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
          name: brandName,
          item: brandUrl,
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
      name: `${brandName} için en iyi fırsatlar`,
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

function buildBrandListings(
  rows: BrandListingRow[],
  productLookup: Map<string, BrandProductRecord>,
): BrandListingRecord[] {
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
        city: String(row.city),
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
    .filter((listing): listing is BrandListingRecord => listing !== null);
}

function normalizeBrandSlug(input: string) {
  return createProductSlug(input);
}

function normalizeScore(value: unknown) {
  if (value == null || value === "") return null;
  const score = typeof value === "number" ? value : Number(value);
  return Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : null;
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

function getLatestListingTimestamp(listings: BrandListingRecord[]) {
  let latest: string | null = null;
  for (const listing of listings) {
    latest = chooseLatestTimestamp(latest, listing.updatedAt ?? listing.createdAt);
  }
  return latest;
}

async function fetchAllBrandProducts(
  supabase: NonNullable<ReturnType<typeof createSupabaseClient>>,
): Promise<BrandProductRecord[]> {
  const products: BrandProductRecord[] = [];
  let offset = 0;
  let includeCategory = true;

  while (true) {
    const columns = includeCategory
      ? "id, name, slug, category, created_at"
      : "id, name, slug, created_at";
    const result = await supabase
      .from("products")
      .select(columns)
      .order("id", { ascending: true })
      .range(offset, offset + BRAND_CATALOG_PAGE_SIZE - 1);

    if (result.error) {
      if (includeCategory && isMissingProductCategoryColumn(result.error)) {
        includeCategory = false;
        continue;
      }

      console.error("Brand product query failed:", result.error);
      return [];
    }

    const rows = (result.data ?? []) as unknown as BrandCatalogRow[];
    products.push(
      ...rows
        .filter((row) => !isPublicDemoProductName(String(row.name)))
        .map((row) => ({
          id: String(row.id),
          name: String(row.name),
          slug: row.slug ? String(row.slug) : createProductSlug(String(row.name)),
          category: "category" in row && row.category ? String(row.category) : null,
          createdAt: row.created_at ? String(row.created_at) : null,
        })),
    );

    if (rows.length < BRAND_CATALOG_PAGE_SIZE) break;
    offset += BRAND_CATALOG_PAGE_SIZE;
  }

  return products;
}

async function fetchBrandListings(
  supabase: NonNullable<ReturnType<typeof createSupabaseClient>>,
  productIds: string[],
) {
  const listings: BrandListingRow[] = [];
  for (const chunk of chunkArray(productIds, BRAND_LISTING_BATCH_SIZE)) {
    const rows = await fetchBrandListingBatch(supabase, chunk);
    listings.push(...rows);
  }

  return listings;
}

async function fetchBrandListingBatch(
  supabase: NonNullable<ReturnType<typeof createSupabaseClient>>,
  productIds: string[],
) {
  if (!productIds.length) return [];

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

    let query = supabase.from("listings").select(columns).in("product_id", productIds);
    if (useStatusColumn) {
      query = query.in("status", ["published", "active"]);
    }

    const result = await query;
    if (!result.error) {
      return (result.data ?? []) as unknown as BrandListingRow[];
    }

    if (useUpdatedAtColumn && isMissingListingUpdatedAtColumn(result.error)) {
      useUpdatedAtColumn = false;
      continue;
    }

    if (useStatusColumn && isMissingStatusColumn(result.error)) {
      useStatusColumn = false;
      continue;
    }

    console.error("Brand listing query failed:", result.error);
    return [];
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
    console.error("Brand search events query failed:", result.error);
    return [] as BrandSearchEventRecord[];
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
    console.error("Brand search demands query failed:", result.error);
    return [] as BrandSearchDemandRecord[];
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

function chunkArray<T>(values: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
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

function buildBrandSearches(
  events: BrandSearchEventRecord[],
  demands: BrandSearchDemandRecord[],
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
