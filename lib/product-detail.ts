import { cache } from "react";
import type {
  Listing,
  ListingCondition,
  ListingSource,
} from "@/lib/listings";
import {
  calculateProductIntelligence,
  type ProductIntelligence,
} from "@/lib/intelligence-engine";
import {
  isMissingStatusColumn,
  isMissingAttributesColumn,
  isMissingPriceHistoryTable,
  isMissingSearchDemandTable,
  isMissingListingUpdatedAtColumn,
  isMissingProductCategoryColumn,
} from "@/lib/listing-status";
import {
  buildMarketIntelligence,
  type MarketIntelligence,
  type MarketIntelligenceDecisionInsight,
  type MarketIntelligenceListing,
} from "@/lib/market-intelligence";
import { toConfidenceLevel, toConfidenceResult } from "@/lib/market-intelligence/helpers";
import { calculateProductUnderstandingConfidence } from "@/lib/confidence-engine/product-understanding-confidence";
import type { ConfidenceResult } from "@/lib/confidence-engine";
import {
  buildOpportunityAnalysis,
  buildOpportunityJsonLdProperties,
  type OpportunityAnalysis,
} from "@/lib/opportunity-engine";
import {
  calculateMarketStats,
  type PriceHistoryRecord,
} from "@/lib/price-insights";
import { createProductSlug } from "@/lib/product-slug";
import { getAbsoluteUrl } from "@/lib/site-url";
import { isPublicDemoListing, isPublicDemoProductName } from "@/lib/public-data-cleanup";
import { normalizeSearchDemandQuery } from "@/lib/search-demand";
import { createSupabaseClient } from "@/lib/supabase";
import { formatCurrencyTRY } from "@/lib/formatters";
import { extractBrand, formatBrandDisplayName } from "@/lib/normalization";
import type { ProductUnderstandingResult } from "@/lib/product-understanding";
import {
  groupListingDuplicates,
  summarizeDuplicateGroups,
  type DuplicateBatchSummary,
} from "@/lib/product-matcher";
import {
  extractProductTypeFromAttributes,
  filterListingsByProductType,
} from "@/lib/market-intelligence/helpers";
import { getCompatibleProducts } from "@/lib/taxonomy/compatibility";

export type ProductRecord = {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  attributes?: unknown;
};

export type ProductDetailData = {
  product: ProductRecord;
  productUnderstanding: ProductUnderstandingResult | null;
  listings: Listing[];
  duplicateSummary: DuplicateBatchSummary;
  priceHistory: PriceHistoryRecord[];
  intelligence: ProductIntelligence;
  decisionInsight: ProductDecisionInsight;
  marketIntelligence: ProductDetailMarketIntelligence;
  bestDeals: ProductBestDeal[];
  relatedProducts: RelatedProductSummary[];
};

export type ProductDetailMarketIntelligence = MarketIntelligence & {
  opportunityAnalysis: OpportunityAnalysis;
};

export type ConfidenceLevel =
  | "Yüksek güven"
  | "Orta güven"
  | "Düşük güven"
  | "Veri yetersiz";

export type ProductDecisionInsight = {
  confidence: {
    score: number | null;
    level: ConfidenceLevel;
    description: string;
    reasons: string[];
    warnings: string[];
    className: string;
  };
  smartPrice: {
    summary: string;
    details: string[];
    warnings: string[];
  };
};

export type ProductBestDeal = {
  listing: Listing;
  differencePercent: number | null;
  label: "Ortalamanın altında" | "Dikkatli incele" | "Normal fiyat";
  className: string;
};

export type RelatedProductSummary = {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  listingCount: number;
  averagePrice: number | null;
  minPrice: number | null;
};

type ProductRow = {
  id: string | number;
  name: string;
  slug?: string | null;
  category?: string | null;
  attributes?: unknown;
};

type ListingRow = {
  id: string | number;
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

type DuplicateSummaryListing = Pick<
  Listing,
  "id" | "title" | "price" | "source" | "condition"
>;

const DUPLICATE_SUMMARY_THRESHOLD = 70;

type RelatedListingRow = {
  product_id: string | number | null;
  price: string | number | null;
  title?: string | null;
  source?: string | null;
  url?: string | null;
};

type SearchDemandRow = {
  query?: string | null;
  normalized_query?: string | null;
  requested_at?: string | null;
};

export const getProductBySlug = cache(
  async (slug: string): Promise<ProductRecord | null> => {
    const supabase = createSupabaseClient();
    if (!supabase) return null;

    const normalizedSlug = createProductSlug(slug);
    const slugResult = await supabase
      .from("products")
      .select("id, name, slug, category, attributes")
      .eq("slug", normalizedSlug)
      .maybeSingle();

    if (!slugResult.error && slugResult.data) {
      return {
        id: String(slugResult.data.id),
        name: String(slugResult.data.name),
        slug:
          String(slugResult.data.slug || "") ||
          createProductSlug(String(slugResult.data.name)),
        category:
          "category" in slugResult.data && slugResult.data.category
            ? String(slugResult.data.category)
            : null,
        attributes: slugResult.data.attributes ?? null,
      };
    }

    let fallbackResult = await supabase
      .from("products")
      .select("id, name, category, attributes");
    if (fallbackResult.error && isMissingProductCategoryColumn(fallbackResult.error)) {
      fallbackResult = await supabase.from("products").select("id, name, attributes");
    }
    if (fallbackResult.error && isMissingAttributesColumn(fallbackResult.error)) {
      fallbackResult = await supabase.from("products").select("id, name, slug");
    }

    if (fallbackResult.error) {
      console.error("Supabase product slug fallback failed:", fallbackResult.error);
      return null;
    }

    const product = ((fallbackResult.data ?? []) as ProductRow[]).find(
      (row) => createProductSlug(String(row.name)) === normalizedSlug,
    );

    return product
      ? {
          id: String(product.id),
          name: String(product.name),
          slug: createProductSlug(String(product.name)),
          category:
            "category" in product && product.category
              ? String(product.category)
              : null,
          attributes: product.attributes ?? null,
        }
      : null;
  },
);

export async function getProductDetail(
  slug: string,
  options: { duplicateSummary?: DuplicateBatchSummary | null } = {},
): Promise<ProductDetailData | null> {
  const product = await getProductBySlug(slug);
  const supabase = createSupabaseClient();
  if (!product || !supabase) return null;
  const productBrand = formatBrandDisplayName(extractBrand(product.name));
  const emptyIntelligence = calculateProductIntelligence({ listings: [] });
  const emptyDecisionInsight = buildProductDecisionInsight(product.name, [], [], product.attributes);

  const listingColumns = {
    base: "id, title, price, city, source, url, condition, image_url, created_at, confidence_score",
    withUpdated:
      "id, title, price, city, source, url, condition, image_url, created_at, updated_at, confidence_score",
  };
  let useStatusFilter = true;
  let columns = listingColumns.withUpdated;
  let listingsResult = await fetchProductListings(
    supabase,
    product.id,
    columns,
    useStatusFilter,
  );

  if (listingsResult.error && isMissingListingUpdatedAtColumn(listingsResult.error)) {
    columns = listingColumns.base;
    listingsResult = await fetchProductListings(
      supabase,
      product.id,
      columns,
      useStatusFilter,
    );
  }

  if (listingsResult.error && isMissingStatusColumn(listingsResult.error)) {
    useStatusFilter = false;
    listingsResult = await fetchProductListings(
      supabase,
      product.id,
      columns,
      useStatusFilter,
    );
  }

  if (listingsResult.error && isMissingListingUpdatedAtColumn(listingsResult.error)) {
    columns = listingColumns.base;
    listingsResult = await fetchProductListings(
      supabase,
      product.id,
      columns,
      useStatusFilter,
    );
  }

  if (listingsResult.error) {
    console.error(
      "Supabase product listings query failed:",
      listingsResult.error,
    );
    const duplicateSummary = resolveProductDetailDuplicateSummary(
      [],
      options.duplicateSummary,
    );
    return {
      product,
      productUnderstanding: product.attributes
        ? (product.attributes as ProductUnderstandingResult)
        : null,
      listings: [],
      duplicateSummary,
      priceHistory: [],
      intelligence: emptyIntelligence,
      decisionInsight: emptyDecisionInsight,
      marketIntelligence: buildMarketIntelligenceForProductDetail({
        product,
        productBrand,
        listings: [],
        intelligence: emptyIntelligence,
        decisionInsight: emptyDecisionInsight,
        duplicateSummary,
      }),
      bestDeals: [],
      relatedProducts: await getRelatedProducts(supabase, product),
    };
  }

  const listingsData = (listingsResult.data ?? []) as unknown as ListingRow[];
  const { listings, marketIntelligenceListings } = buildProductDetailListings(
    product,
    listingsData,
  );
  const duplicateSummary = resolveProductDetailDuplicateSummary(
    listings,
    options.duplicateSummary,
  );

  const historyResult = await supabase
    .from("price_history")
    .select("price, recorded_at")
    .eq("product_id", product.id)
    .order("recorded_at", { ascending: true })
    .limit(2000);

  if (historyResult.error && !isMissingPriceHistoryTable(historyResult.error)) {
    console.error("Supabase product price history query failed:", historyResult.error);
  }

  const priceHistory = historyResult.error
    ? []
    : (historyResult.data ?? [])
        .map((record) => ({
          price: Number(record.price),
          recordedAt: String(record.recorded_at),
        }))
        .filter((record) => Number.isFinite(record.price));
  const demand = await getProductSearchDemandStats(supabase, product.name);
  const intelligence = calculateProductIntelligence({
    listings,
    priceHistory,
    demand,
  });
  const decisionInsight = buildProductDecisionInsight(
    product.name,
    listings,
    priceHistory,
    product.attributes,
  );

  return {
    product,
    productUnderstanding: product.attributes
      ? (product.attributes as ProductUnderstandingResult)
      : null,
    listings,
    duplicateSummary,
    priceHistory,
    intelligence,
    decisionInsight,
    marketIntelligence: buildMarketIntelligenceForProductDetail({
      product,
      productBrand,
      listings: marketIntelligenceListings,
      intelligence,
      decisionInsight,
      duplicateSummary,
    }),
    bestDeals: buildProductBestDeals(listings, extractProductTypeFromAttributes(product.attributes)),
    relatedProducts: await getRelatedProducts(supabase, product),
  };
}

function buildProductDetailListings(
  product: ProductRecord,
  listingRows: ListingRow[],
): {
  listings: Listing[];
  marketIntelligenceListings: MarketIntelligenceListing[];
} {
  const pairs = listingRows
    .map((listing) => {
      const price = Number(listing.price);
      if (!Number.isFinite(price)) return null;

      const confidenceScore = normalizeConfidenceScore(listing.confidence_score);
      const confidenceLevel =
        confidenceScore !== null ? toConfidenceLevel(confidenceScore) : null;

      const baseListing: Listing = {
        id: String(listing.id),
        productId: product.id,
        title: String(listing.title),
        productName: product.name,
        price,
        city: String(listing.city),
        source: listing.source as ListingSource,
        url: String(listing.url),
        condition: listing.condition as ListingCondition,
        imageUrl: listing.image_url ? String(listing.image_url) : null,
        createdAt: String(listing.created_at),
        updatedAt:
          "updated_at" in listing && listing.updated_at
            ? String(listing.updated_at)
            : null,
      };

      if (isPublicDemoListing(baseListing)) return null;

      const marketIntelligenceListing: MarketIntelligenceListing = {
        ...baseListing,
        status: "published",
        confidenceScore,
        confidenceLevel,
      };

      return { baseListing, marketIntelligenceListing };
    })
    .filter(
      (pair): pair is {
        baseListing: Listing;
        marketIntelligenceListing: MarketIntelligenceListing;
      } => pair !== null,
    );

  return {
    listings: pairs.map((pair) => pair.baseListing),
    marketIntelligenceListings: pairs.map((pair) => pair.marketIntelligenceListing),
  };
}

export function resolveProductDetailDuplicateSummary(
  listings: DuplicateSummaryListing[],
  duplicateSummary?: DuplicateBatchSummary | null,
): DuplicateBatchSummary {
  if (duplicateSummary) return duplicateSummary;
  return buildDuplicateSummaryFromListings(listings);
}

async function getProductSearchDemandStats(
  supabase: NonNullable<ReturnType<typeof createSupabaseClient>>,
  productName: string,
) {
  const normalizedProduct = normalizeSearchDemandQuery(productName);
  if (!normalizedProduct) return { searchCount: 0, recentSearchCount: 0 };

  const result = await supabase
    .from("search_demands")
    .select("query, normalized_query, requested_at")
    .order("requested_at", { ascending: false })
    .limit(500);

  if (result.error) {
    if (!isMissingSearchDemandTable(result.error)) {
      console.error("Supabase product search demand query failed:", result.error);
    }
    return { searchCount: 0, recentSearchCount: 0 };
  }

  const productTokens = new Set(
    normalizedProduct.split(" ").filter((token) => token.length >= 2),
  );
  const recentCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  let searchCount = 0;
  let recentSearchCount = 0;

  for (const row of (result.data ?? []) as SearchDemandRow[]) {
    const normalizedQuery = normalizeSearchDemandQuery(
      row.normalized_query || row.query || "",
    );
    if (!normalizedQuery) continue;
    const queryTokens = new Set(
      normalizedQuery.split(" ").filter((token) => token.length >= 2),
    );
    const overlaps = [...productTokens].filter((token) => queryTokens.has(token));
    const isMatch =
      normalizedQuery.includes(normalizedProduct) ||
      normalizedProduct.includes(normalizedQuery) ||
      overlaps.length >= Math.min(2, productTokens.size);

    if (!isMatch) continue;
    searchCount += 1;
    if (row.requested_at && new Date(row.requested_at).getTime() >= recentCutoff) {
      recentSearchCount += 1;
    }
  }

  return { searchCount, recentSearchCount };
}

export function buildProductDecisionInsight(
  productName: string,
  listings: Listing[],
  priceHistory: PriceHistoryRecord[],
  attributes?: unknown,
): ProductDecisionInsight {
  const prices = listings
    .map((listing) => Number(listing.price))
    .filter((price) => Number.isFinite(price) && price > 0);
  const stats = calculateMarketStats(prices);
  const count = prices.length;

  if (!stats || count === 0) {
    return {
      confidence: {
        score: null,
        level: "Veri yetersiz",
        description:
          "Bu ürün için güven skoru oluşturacak kadar fiyat verisi bulunmuyor.",
        reasons: ["Yayında fiyat bilgisi olan ilan yok."],
        warnings: ["Yeni ilanlar geldikçe analiz otomatik güncellenecek."],
        className: "border-slate-200 bg-slate-50 text-slate-700",
      },
      smartPrice: {
        summary: `${productName} için henüz güvenilir fiyat yorumu üretilecek kadar ilan bulunmuyor.`,
        details: ["Fiyat yorumu için en az birkaç karşılaştırılabilir ilan gerekir."],
        warnings: ["İlk ilanlar geldiğinde ortalama ve medyan fiyat karşılaştırması yapılacak."],
      },
    };
  }

  const average = stats.average;
  const median = stats.median;
  const lowest = stats.lowest;
  const highest = stats.highest;
  const spreadPercent = average ? ((highest - lowest) / average) * 100 : 0;
  const medianDifferencePercent = average
    ? Math.round(((average - median) / average) * 1000) / 10
    : 0;
  const cheapestDifferencePercent = average
    ? Math.round(((average - lowest) / average) * 1000) / 10
    : 0;

  const warnings = [
    ...(spreadPercent >= 35
      ? ["Piyasada fiyat farkı yüksek; ürün durumu, garanti ve satıcı detaylarını karşılaştır."]
      : []),
    ...(cheapestDifferencePercent >= 35
      ? ["En ucuz ilan ortalamanın çok altında; detayları dikkatli kontrol et."]
      : []),
    ...(count < 3 ? ["Tek/az ilan olduğu için karar vermeden önce yeni verileri beklemek daha sağlıklı olur."] : []),
  ];

  const uniqueSources = [...new Set(listings.map(l => l.source).filter(Boolean))];

  // Extract PUE confidence from product attributes (0-100 scale → 0-1 for confidence engine)
  const rawAttrs = attributes as Record<string, unknown> | null;
  const pu = rawAttrs?.productUnderstanding as Record<string, unknown> | null;
  const ptConf = pu?.productType as { confidence?: number } | null;
  const productUnderstandingScore =
    typeof ptConf?.confidence === "number" && Number.isFinite(ptConf.confidence)
      ? ptConf.confidence / 100
      : null;

  const pueConfidence = calculateProductUnderstandingConfidence({
    decisionConfidence: null,
    productUnderstandingScore,
    sourceCount: uniqueSources.length,
    sourcesUsed: uniqueSources as string[],
  });
  const confidence: ProductDecisionInsight["confidence"] = {
    score: pueConfidence.score,
    level: toDecisionConfidenceLevel(pueConfidence.level),
    description:
      pueConfidence.level === "very-high" || pueConfidence.level === "high"
        ? "Bu ürün için fiyat verisi tutarlı ve karar desteği güçlü."
        : pueConfidence.level === "medium"
          ? "Analiz kullanılabilir, ancak ilan detaylarını karşılaştırmak önemli."
          : "Fiyatlar veya veri miktarı güveni düşürüyor; dikkatli inceleme önerilir.",
    reasons: pueConfidence.reasons,
    warnings,
    className:
      pueConfidence.level === "very-high" || pueConfidence.level === "high"
        ? "border-green-200 bg-green-50 text-green-700"
        : pueConfidence.level === "medium"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-red-200 bg-red-50 text-red-700",
  };

  const reliabilityText =
    count >= 10
      ? "İlan sayısı güçlü, fiyat yorumu daha güvenilir."
      : count >= 3
        ? "İlan sayısı orta seviyede, yorum makul bir başlangıç sağlar."
        : "İlan sayısı çok az, analiz dikkatli yorumlanmalı.";
  const medianText =
    Math.abs(medianDifferencePercent) <= 5
      ? "Medyan fiyat ile ortalama birbirine yakın; fiyat dağılımı dengeli görünüyor."
      : `Medyan fiyat ortalamadan yaklaşık %${Math.abs(medianDifferencePercent).toLocaleString("tr-TR")} ${medianDifferencePercent > 0 ? "düşük" : "yüksek"}; piyasada farklı fiyat seviyeleri var.`;

  return {
    confidence,
    smartPrice: {
      summary:
        cheapestDifferencePercent > 0
          ? `${productName} için ortalama ikinci el fiyat ${formatPrice(average)}. En ucuz ilan ${formatPrice(lowest)} ile ortalamanın yaklaşık %${cheapestDifferencePercent.toLocaleString("tr-TR")} altında.`
          : `${productName} için ortalama ikinci el fiyat ${formatPrice(average)}. En ucuz ilan ${formatPrice(lowest)} ve ortalamaya yakın seyrediyor.`,
      details: [
        `Medyan fiyat ${formatPrice(median)}; ortalama ile fark yaklaşık %${Math.abs(medianDifferencePercent).toLocaleString("tr-TR")}.`,
        reliabilityText,
        medianText,
      ],
      warnings,
    },
  };
}

export function buildProductBestDeals(listings: Listing[], productType: string | null): ProductBestDeal[] {
  // Only show best deals for primary products — accessories/spare parts/services
  // have different pricing dynamics that don't match phone-market comparisons
  const pricedListings = (productType === "primary_product" ? listings : [])
    .filter((listing) => Number.isFinite(listing.price) && listing.price > 0)
    .sort((a, b) => a.price - b.price);
  const stats = calculateMarketStats(pricedListings.map((listing) => listing.price));
  const average = stats?.average ?? null;

  return pricedListings.slice(0, 5).map((listing) => {
    const differencePercent = average
      ? Math.round(((listing.price - average) / average) * 1000) / 10
      : null;
    const label =
      differencePercent !== null && differencePercent <= -35
        ? "Dikkatli incele"
        : differencePercent !== null && differencePercent < 0
          ? "Ortalamanın altında"
          : "Normal fiyat";

    return {
      listing,
      differencePercent,
      label,
      className:
        label === "Dikkatli incele"
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : label === "Ortalamanın altında"
            ? "border-green-200 bg-green-50 text-green-700"
            : "border-slate-200 bg-slate-50 text-slate-700",
    };
  });
}

async function getRelatedProducts(
  supabase: NonNullable<ReturnType<typeof createSupabaseClient>>,
  product: ProductRecord,
): Promise<RelatedProductSummary[]> {
  const products = await fetchProductsForRelated(supabase);
  if (!products.length) return [];

  let listingsResult = await supabase
    .from("listings")
    .select("product_id, price, title, source, url")
    .in("status", ["published", "active"]);

  if (listingsResult.error && isMissingStatusColumn(listingsResult.error)) {
    listingsResult = await supabase
      .from("listings")
      .select("product_id, price, title, source, url");
  }

  if (listingsResult.error) {
    console.error("Supabase related listings query failed:", listingsResult.error);
    return [];
  }

  const priceGroups = new Map<string, number[]>();
  for (const listing of (listingsResult.data ?? []) as unknown as RelatedListingRow[]) {
    if (listing.product_id == null) continue;
    if (isPublicDemoListing(listing)) continue;
    const price = Number(listing.price);
    if (!Number.isFinite(price) || price <= 0) continue;
    const productId = String(listing.product_id);
    priceGroups.set(productId, [...(priceGroups.get(productId) ?? []), price]);
  }

  const related = products
    .filter((candidate) => candidate.id !== product.id)
    .map((candidate) => {
      const prices = priceGroups.get(candidate.id) ?? [];
      const stats = calculateMarketStats(prices);
      return {
        candidate,
        score: getRelatedProductScore(product, candidate),
        listingCount: prices.length,
        averagePrice: stats?.average ?? null,
        minPrice: stats?.lowest ?? null,
      };
    })
    .filter((item) => item.score > 0 || item.listingCount > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.listingCount - a.listingCount ||
        a.candidate.name.localeCompare(b.candidate.name, "tr"),
    )
    .slice(0, 6)
    .map((item) => ({
      id: item.candidate.id,
      name: item.candidate.name,
      slug: item.candidate.slug,
      category: item.candidate.category,
      listingCount: item.listingCount,
      averagePrice: item.averagePrice,
      minPrice: item.minPrice,
    }));

  const compatibleProducts = getCompatibleProducts(product, products);
  const existingIds = new Set(related.map((r) => r.id));
  const compatToAdd = compatibleProducts
    .filter((cp) => !existingIds.has(cp.product.id))
    .slice(0, 3)
    .map((cp) => {
      const prices = priceGroups.get(cp.product.id) ?? [];
      const stats = calculateMarketStats(prices);
      return {
        id: cp.product.id,
        name: cp.product.name,
        slug: cp.product.slug,
        category: cp.product.category,
        listingCount: prices.length,
        averagePrice: stats?.average ?? null,
        minPrice: stats?.lowest ?? null,
      };
    });

  return [...compatToAdd, ...related];
}

async function fetchProductsForRelated(
  supabase: NonNullable<ReturnType<typeof createSupabaseClient>>,
) {
  const productsWithCategoryResult = await supabase
    .from("products")
    .select("id, name, slug, category, attributes")
    .limit(200);
  let productsData = productsWithCategoryResult.data as unknown[] | null;
  let productsError = productsWithCategoryResult.error;

  if (productsError && isMissingProductCategoryColumn(productsError)) {
    const fallbackResult = await supabase
      .from("products")
      .select("id, name, slug, attributes")
      .limit(200);
    productsData = fallbackResult.data as unknown[] | null;
    productsError = fallbackResult.error;
  }

  if (productsError) {
    console.error("Supabase related products query failed:", productsError);
    return [];
  }

  return ((productsData ?? []) as ProductRow[])
    .filter((row) => !isPublicDemoProductName(String(row.name)))
    .map((row) => ({
      id: String(row.id),
      name: String(row.name),
      slug: row.slug ? String(row.slug) : createProductSlug(String(row.name)),
      category: row.category ? String(row.category) : null,
      attributes: row.attributes,
    }));
}

function getRelatedProductScore(
  product: ProductRecord,
  candidate: ProductRecord,
) {
  // 1. Product type match: same type = +30, type mismatch = unrelated (score 0)
  const sourceType = extractProductTypeFromAttributes(product.attributes);
  const candidateType = extractProductTypeFromAttributes(candidate.attributes);
  if (sourceType && candidateType && sourceType !== candidateType) return 0;

  let score = 0;

  if (sourceType && candidateType && sourceType === candidateType) {
    score += 30;
  }

  // 2. Device family match via PUE
  const sourceFamily = extractPueField(product.attributes, "deviceFamily");
  const candidateFamily = extractPueField(candidate.attributes, "deviceFamily");
  if (sourceFamily && candidateFamily && sourceFamily === candidateFamily) {
    score += 20;
  }

  // 3. Compatible device match
  const sourceCompatDevice = extractPueField(product.attributes, "compatibleDevice");
  const sourceCompatFamily = extractPueField(product.attributes, "compatibleFamily");
  const candidateCompatDevice = extractPueField(candidate.attributes, "compatibleDevice");
  const candidateCompatFamily = extractPueField(candidate.attributes, "compatibleFamily");

  if (
    (sourceCompatDevice &&
      (sourceCompatDevice === candidateCompatDevice || sourceCompatDevice === candidateCompatFamily)) ||
    (candidateCompatDevice &&
      (candidateCompatDevice === sourceCompatDevice || candidateCompatDevice === sourceCompatFamily)) ||
    (sourceCompatFamily && sourceCompatFamily === candidateCompatFamily)
  ) {
    score += 15;
  }

  // 5. Token similarity (+2 per matching token, reduced weight)
  const productTokens = getProductSignalTokens(product.name);
  const candidateTokens = getProductSignalTokens(candidate.name);
  for (const token of productTokens) {
    if (candidateTokens.has(token)) score += 2;
  }

  return score;
}

function extractPueField(attributes: unknown, field: string): string | null {
  if (!attributes || typeof attributes !== "object") return null;
  const record = attributes as Record<string, unknown>;
  const pu = record.productUnderstanding as Record<string, { value?: unknown }> | undefined;
  if (!pu || typeof pu !== "object") return null;
  const fieldVal = pu[field];
  if (!fieldVal || typeof fieldVal !== "object") return null;
  if (typeof fieldVal.value === "string" && fieldVal.value.length > 0) return fieldVal.value;
  return null;
}

function getProductSignalTokens(name: string) {
  const ignored = new Set([
    "apple",
    "samsung",
    "galaxy",
    "iphone",
    "telefon",
    "yenilenmis",
    "ikinci",
    "nesil",
  ]);

  return new Set(
    createProductSlug(name)
      .split("-")
      .filter((token) => token.length >= 2 && !ignored.has(token)),
  );
}

function toDecisionConfidenceLevel(level: ConfidenceResult["level"]): ConfidenceLevel {
  const map: Record<ConfidenceResult["level"], ConfidenceLevel> = {
    "very-high": "Yüksek güven",
    high: "Yüksek güven",
    medium: "Orta güven",
    low: "Düşük güven",
    "very-low": "Düşük güven",
  };
  return map[level];
}

function fetchProductListings(
  supabase: NonNullable<ReturnType<typeof createSupabaseClient>>,
  productId: string,
  columns: string,
  useStatusFilter: boolean,
) {
  let query = supabase
    .from("listings")
    .select(columns)
    .eq("product_id", productId);

  if (useStatusFilter) {
    query = query.in("status", ["published", "active"]);
  }

  return query;
}

function formatPrice(price: number) {
  return formatCurrencyTRY(price);
}

function toMarketIntelligenceDecisionInsight(
  insight: ProductDecisionInsight,
): MarketIntelligenceDecisionInsight {
  return {
    confidence: toConfidenceResult(insight.confidence.score, insight.confidence.reasons),
    smartPrice: insight.smartPrice,
  };
}

function normalizeConfidenceScore(value: unknown) {
  if (value == null || value === "") return null;
  const score = typeof value === "number" ? value : Number(value);
  return Number.isFinite(score) ? score : null;
}

function buildDuplicateSummaryFromListings(
  listings: DuplicateSummaryListing[],
): DuplicateBatchSummary {
  const duplicateGroups = groupListingDuplicates(
    listings.map((listing) => ({
      id: listing.id,
      title: listing.title,
      price: listing.price,
      source: listing.source,
      condition: listing.condition,
    })),
    DUPLICATE_SUMMARY_THRESHOLD,
  );

  return summarizeDuplicateGroups(
    duplicateGroups,
    listings.length,
    DUPLICATE_SUMMARY_THRESHOLD,
  );
}

function getLatestListingTimestamp(listings: MarketIntelligenceListing[]) {
  let latestTime = Number.NEGATIVE_INFINITY;

  for (const listing of listings) {
    for (const candidate of [listing.updatedAt, listing.createdAt]) {
      if (!candidate) continue;
      const time = new Date(candidate).getTime();
      if (Number.isFinite(time) && time > latestTime) {
        latestTime = time;
      }
    }
  }

  return Number.isFinite(latestTime) ? new Date(latestTime).toISOString() : null;
}

export function buildMarketIntelligenceForProductDetail({
  product,
  productBrand,
  listings,
  intelligence,
  decisionInsight,
  duplicateSummary,
  analyzedAt,
}: {
  product: ProductRecord;
  productBrand: string | null;
  listings: MarketIntelligenceListing[];
  intelligence: ProductIntelligence;
  decisionInsight: ProductDecisionInsight;
  duplicateSummary: DuplicateBatchSummary;
  analyzedAt?: string | Date | null;
}): ProductDetailMarketIntelligence {
  const productType = extractProductTypeFromAttributes(product.attributes);
  const productLookup = new Map<string, { attributes?: unknown }>(
    [[String(product.id), product]],
  );
  const filteredListings = filterListingsByProductType(
    listings,
    productType,
    productLookup,
  );

  const marketIntelligence = buildMarketIntelligence({
    scope: {
      productId: product.id,
      productName: product.name,
      slug: product.slug,
      url: getAbsoluteUrl(`/product/${product.slug}`),
      category: product.category,
      brand: productBrand,
      productType,
    },
    listings: filteredListings,
    intelligence,
    decisionInsight: toMarketIntelligenceDecisionInsight(decisionInsight),
    duplicateSummary,
    analyzedAt: analyzedAt ?? new Date(),
  });

  const opportunityAnalysis = buildOpportunityAnalysis({
    marketIntelligence,
    intelligence,
    duplicateSummary,
    analyzedAt: marketIntelligence.analysisGeneratedAt,
    latestListingAt: getLatestListingTimestamp(listings),
  });

  return {
    ...marketIntelligence,
    opportunity: {
      score: intelligence.opportunity?.score ?? 0,
      label: intelligence.opportunity?.label ?? "Veri yetersiz",
      explanation: intelligence.opportunity?.explanation ?? "Opportunity Engine üzerinden hesaplanıyor",
      action: intelligence.recommendation?.action ?? "wait",
      discountPercent: null,
    },
    opportunityAnalysis,
    structuredData: {
      ...marketIntelligence.structuredData,
      additionalProperty: [
        ...marketIntelligence.structuredData.additionalProperty,
        ...buildOpportunityJsonLdProperties(opportunityAnalysis, marketIntelligence),
      ],
    },
  };
}
