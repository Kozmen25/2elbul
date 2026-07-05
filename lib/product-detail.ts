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
import { isMissingStatusColumn } from "@/lib/listing-status";
import {
  buildMarketIntelligence,
  type MarketIntelligence,
  type MarketIntelligenceDecisionInsight,
} from "@/lib/market-intelligence";
import {
  calculateMarketStats,
  type PriceHistoryRecord,
} from "@/lib/price-insights";
import { createProductSlug } from "@/lib/product-slug";
import { isPublicDemoListing, isPublicDemoProductName } from "@/lib/public-data-cleanup";
import { normalizeSearchDemandQuery } from "@/lib/search-demand";
import { createSupabaseClient } from "@/lib/supabase";
import { extractBrand, formatBrandDisplayName } from "@/lib/normalization";
import { toConfidenceResult } from "@/lib/market-intelligence/helpers";

export type ProductRecord = {
  id: string;
  name: string;
  slug: string;
  category: string | null;
};

export type ProductDetailData = {
  product: ProductRecord;
  listings: Listing[];
  priceHistory: PriceHistoryRecord[];
  intelligence: ProductIntelligence;
  decisionInsight: ProductDecisionInsight;
  marketIntelligence: MarketIntelligence;
  bestDeals: ProductBestDeal[];
  relatedProducts: RelatedProductSummary[];
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
};

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
      .select("id, name, slug, category")
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
      };
    }

    let fallbackResult = await supabase
      .from("products")
      .select("id, name, category");
    if (fallbackResult.error && isMissingProductCategoryColumn(fallbackResult.error)) {
      fallbackResult = await supabase.from("products").select("id, name");
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
        }
      : null;
  },
);

export async function getProductDetail(
  slug: string,
): Promise<ProductDetailData | null> {
  const product = await getProductBySlug(slug);
  const supabase = createSupabaseClient();
  if (!product || !supabase) return null;
  const productBrand = formatBrandDisplayName(extractBrand(product.name));
  const emptyIntelligence = calculateProductIntelligence({ listings: [] });
  const emptyDecisionInsight = buildProductDecisionInsight(product.name, [], []);

  const listingColumns = {
    base: "id, title, price, city, source, url, condition, image_url, created_at",
    withUpdated:
      "id, title, price, city, source, url, condition, image_url, created_at, updated_at",
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
    return {
      product,
      listings: [],
      priceHistory: [],
      intelligence: emptyIntelligence,
      decisionInsight: emptyDecisionInsight,
      marketIntelligence: buildMarketIntelligenceForProductDetail({
        product,
        productBrand,
        listings: [],
        intelligence: emptyIntelligence,
        decisionInsight: emptyDecisionInsight,
      }),
      bestDeals: [],
      relatedProducts: await getRelatedProducts(supabase, product),
    };
  }

  const listingsData = (listingsResult.data ?? []) as unknown as ListingRow[];
  const listings = listingsData
    .map((listing) => ({
      id: String(listing.id),
      productId: product.id,
      title: String(listing.title),
      productName: product.name,
      price: Number(listing.price),
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
    }))
    .filter(
      (listing) =>
        Number.isFinite(listing.price) && !isPublicDemoListing(listing),
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
  );

  return {
    product,
    listings,
    priceHistory,
    intelligence,
    decisionInsight,
    marketIntelligence: buildMarketIntelligenceForProductDetail({
      product,
      productBrand,
      listings,
      intelligence,
      decisionInsight,
    }),
    bestDeals: buildProductBestDeals(listings),
    relatedProducts: await getRelatedProducts(supabase, product),
  };
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

  const sorted = [...prices].sort((a, b) => a - b);
  const average = stats.average;
  const median = stats.median;
  const lowest = stats.lowest;
  const highest = stats.highest;
  const standardDeviation = calculateStandardDeviation(prices, average);
  const variation = average ? standardDeviation / average : 0;
  const spreadPercent = average ? ((highest - lowest) / average) * 100 : 0;
  const medianDifferencePercent = average
    ? Math.round(((average - median) / average) * 1000) / 10
    : 0;
  const cheapestDifferencePercent = average
    ? Math.round(((average - lowest) / average) * 1000) / 10
    : 0;
  const outlierCount = sorted.filter(
    (price) => price <= average * 0.6 || price >= average * 1.6,
  ).length;
  const hasHistory =
    priceHistory.length >= 2 ||
    new Set(listings.map((listing) => listing.createdAt?.slice(0, 10))).size >= 2;

  const confidence = buildConfidenceScore({
    count,
    variation,
    outlierCount,
    hasHistory,
    cheapestDifferencePercent,
  });

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

  const warnings = [
    ...(spreadPercent >= 35
      ? ["Piyasada fiyat farkı yüksek; ürün durumu, garanti ve satıcı detaylarını karşılaştır."]
      : []),
    ...(cheapestDifferencePercent >= 35
      ? ["En ucuz ilan ortalamanın çok altında; detayları dikkatli kontrol et."]
      : []),
    ...(count < 3 ? ["Tek/az ilan olduğu için karar vermeden önce yeni verileri beklemek daha sağlıklı olur."] : []),
  ];

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

export function buildProductBestDeals(listings: Listing[]): ProductBestDeal[] {
  const pricedListings = listings
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

  return products
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
}

async function fetchProductsForRelated(
  supabase: NonNullable<ReturnType<typeof createSupabaseClient>>,
) {
  const productsWithCategoryResult = await supabase
    .from("products")
    .select("id, name, slug, category")
    .limit(200);
  let productsData = productsWithCategoryResult.data as unknown[] | null;
  let productsError = productsWithCategoryResult.error;

  if (productsError && isMissingProductCategoryColumn(productsError)) {
    const fallbackResult = await supabase
      .from("products")
      .select("id, name, slug")
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
    }));
}

function getRelatedProductScore(
  product: ProductRecord,
  candidate: ProductRecord,
) {
  let score = 0;
  if (product.category && candidate.category && product.category === candidate.category) {
    score += 6;
  }

  const productTokens = getProductSignalTokens(product.name);
  const candidateTokens = getProductSignalTokens(candidate.name);
  for (const token of productTokens) {
    if (candidateTokens.has(token)) score += token.length >= 4 ? 3 : 2;
  }

  return score;
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

function buildConfidenceScore({
  count,
  variation,
  outlierCount,
  hasHistory,
  cheapestDifferencePercent,
}: {
  count: number;
  variation: number;
  outlierCount: number;
  hasHistory: boolean;
  cheapestDifferencePercent: number;
}): ProductDecisionInsight["confidence"] {
  if (count < 3) {
    return {
      score: null,
      level: "Veri yetersiz" as const,
      description:
        "Güven skoru için en az 3 karşılaştırılabilir ilan daha sağlıklı sonuç verir.",
      reasons: [`Şu anda yalnızca ${count} fiyat verisi var.`],
      warnings: ["Tek ilanlar fırsat gibi görünebilir; satıcı ve ürün detaylarını ayrıca kontrol et."],
      className: "border-slate-200 bg-slate-50 text-slate-700",
    };
  }

  let score = 45;
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (count >= 20) {
    score += 25;
    reasons.push("İlan sayısı yüksek.");
  } else if (count >= 10) {
    score += 20;
    reasons.push("İlan sayısı güvenilir karşılaştırma için iyi.");
  } else if (count >= 5) {
    score += 14;
    reasons.push("İlan sayısı makul seviyede.");
  } else {
    score += 8;
    reasons.push("İlan sayısı sınırlı ama temel karşılaştırma yapılabiliyor.");
  }

  if (variation <= 0.12) {
    score += 25;
    reasons.push("Fiyatlar birbirine yakın.");
  } else if (variation <= 0.24) {
    score += 17;
    reasons.push("Fiyat dağılımı dengeli.");
  } else if (variation <= 0.38) {
    score += 8;
    reasons.push("Fiyatlarda orta düzey sapma var.");
  } else {
    score -= 12;
    warnings.push("Fiyat dağılımı geniş; ilan detayları arasında ciddi fark olabilir.");
  }

  if (outlierCount > 0) {
    const penalty = Math.min(22, outlierCount * 7);
    score -= penalty;
    warnings.push(`${outlierCount} ilan piyasa ortalamasından belirgin sapıyor.`);
  }

  if (hasHistory) {
    score += 8;
    reasons.push("Fiyat geçmişi veya farklı günlere ait veri var.");
  }

  if (cheapestDifferencePercent >= 35) {
    score -= 12;
    warnings.push("En ucuz ilan ortalamanın çok altında; detayları dikkatli kontrol et.");
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  const level: ConfidenceLevel =
    finalScore >= 80
      ? "Yüksek güven"
      : finalScore >= 60
        ? "Orta güven"
        : "Düşük güven";

  return {
    score: finalScore,
    level,
    description:
      level === "Yüksek güven"
        ? "Bu ürün için fiyat verisi tutarlı ve karar desteği güçlü."
        : level === "Orta güven"
          ? "Analiz kullanılabilir, ancak ilan detaylarını karşılaştırmak önemli."
          : "Fiyatlar veya veri miktarı güveni düşürüyor; dikkatli inceleme önerilir.",
    reasons,
    warnings,
    className:
      level === "Yüksek güven"
        ? "border-green-200 bg-green-50 text-green-700"
        : level === "Orta güven"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-red-200 bg-red-50 text-red-700",
  };
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
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(price);
}

function calculateStandardDeviation(prices: number[], average: number) {
  if (!prices.length || !average) return 0;
  const variance =
    prices.reduce((sum, price) => sum + (price - average) ** 2, 0) /
    prices.length;
  return Math.sqrt(variance);
}

function isMissingPriceHistoryTable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: string; message?: string; details?: string };
  const text = `${record.message ?? ""} ${record.details ?? ""}`.toLowerCase();
  return (
    record.code === "42P01" ||
    record.code === "PGRST205" ||
    text.includes("price_history")
  );
}

function isMissingSearchDemandTable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: string; message?: string; details?: string };
  const text = `${record.message ?? ""} ${record.details ?? ""}`.toLowerCase();
  return (
    record.code === "42P01" ||
    record.code === "PGRST205" ||
    text.includes("search_demands")
  );
}

function isMissingListingUpdatedAtColumn(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: string; message?: string; details?: string };
  const text = `${record.message ?? ""} ${record.details ?? ""}`.toLowerCase();
  return (
    record.code === "42703" ||
    record.code === "PGRST204" ||
    text.includes("updated_at")
  );
}

function isMissingProductCategoryColumn(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: string; message?: string; details?: string };
  const text = `${record.message ?? ""} ${record.details ?? ""}`.toLowerCase();
  return (
    record.code === "42703" ||
    record.code === "PGRST204" ||
    text.includes("category")
  );
}

function toMarketIntelligenceDecisionInsight(
  insight: ProductDecisionInsight,
): MarketIntelligenceDecisionInsight {
  return {
    confidence: toConfidenceResult(insight.confidence.score, insight.confidence.reasons),
    smartPrice: insight.smartPrice,
  };
}

function buildMarketIntelligenceForProductDetail({
  product,
  productBrand,
  listings,
  intelligence,
  decisionInsight,
}: {
  product: ProductRecord;
  productBrand: string | null;
  listings: Listing[];
  intelligence: ProductIntelligence;
  decisionInsight: ProductDecisionInsight;
}) {
  return buildMarketIntelligence({
    scope: {
      productId: product.id,
      productName: product.name,
      slug: product.slug,
      url: `/product/${product.slug}`,
      category: product.category,
      brand: productBrand,
    },
    listings: listings.map((listing) => ({
      ...listing,
      status: "published",
    })),
    intelligence,
    decisionInsight: toMarketIntelligenceDecisionInsight(decisionInsight),
    analyzedAt: new Date(),
  });
}
