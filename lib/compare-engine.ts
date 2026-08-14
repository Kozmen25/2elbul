import type { ProductDetailData } from "@/lib/product-detail";
import { getProductDetail } from "@/lib/product-detail";
import type { OpportunityAnalysis, OpportunityDataFreshness, OpportunityLevel } from "@/lib/opportunity-engine";
import type { ConfidenceLevel } from "@/lib/confidence-engine";
import type { MarketIntelligence } from "@/lib/market-intelligence";
import type { ProductIntelligence } from "@/lib/intelligence-engine";
import type { Listing } from "@/lib/listings";
import { getAbsoluteUrl } from "@/lib/site-url";
import { calculatePriceAdvantagePercent } from "@/lib/opportunity-engine";
import { extractProductTypeFromAttributes } from "@/lib/market-intelligence/helpers";

export type CompareCandidateKey = number;

export type CompareCandidate = {
  key: CompareCandidateKey;
  listingId: string;
  listing: Listing | null;
  detail: ProductDetailData | null;
};

export type CompareCandidateSummary = {
  key: CompareCandidateKey;
  listingId: string;
  productName: string;
  productSlug: string;
  productUrl: string;
  title: string;
  price: number;
  city: string;
  source: string;
  url: string;
  condition: string;
  imageUrl: string | null;
  createdAt: string;
  averagePrice: number | null;
  medianPrice: number | null;
  minPrice: number | null;
  confidenceScore: number;
  confidenceLevel: ConfidenceLevel;
  opportunityScore: number;
  opportunityLevel: OpportunityLevel;
  riskLevel: OpportunityLevel;
  recommendation: { action: string; label: string; description: string };
  duplicateDensity: number;
  sourceCount: number;
  sampleSize: number;
  dataFreshness: OpportunityDataFreshness;
  priceAdvantagePercent: number | null;
  trendDirection: ProductIntelligence["trend"]["direction"];
  trendChangePercent: number | null;
  productType: string | null;
};

export type CompareReason = {
  label: string;
  winnerKey: CompareCandidateKey | null;
};

export type CompareDecision = {
  recommendedKey: CompareCandidateKey | null;
  recommendedLabel: string;
  headline: string;
  reasons: CompareReason[];
  tied: boolean;
  insufficientData: boolean;
};

export type CompareWebPageJsonLd = {
  "@context": "https://schema.org";
  "@type": "WebPage";
  name: string;
  description: string;
  url: string;
  breadcrumb: {
    "@id": string;
  };
};

export type CompareBreadcrumbJsonLd = {
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

export type CompareItemListJsonLd = {
  "@context": "https://schema.org";
  "@type": "ItemList";
  "@id": string;
  name: string;
  itemListOrder: "https://schema.org/ItemListOrderAscending";
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

export type CompareJsonLdDocument =
  | CompareWebPageJsonLd
  | CompareBreadcrumbJsonLd
  | CompareItemListJsonLd;

export type ComparePageData = {
  candidates: CompareCandidateSummary[];
  decision: CompareDecision;
  jsonLd: CompareJsonLdDocument[];
  canonicalUrl: string;
};

export async function getComparePageData(
  listingIds: string[],
): Promise<ComparePageData | null> {
  if (listingIds.length < 2 || listingIds.length > 4) return null;
  if (new Set(listingIds).size !== listingIds.length) return null;

  const results = await Promise.all(
    listingIds.map((id, i) => buildCompareCandidate(i, id)),
  );

  if (results.some((c) => c === null)) return null;

  const candidates = results.map((c) => summarizeCandidate(c!));

  const productTypes = candidates.map((s) => s.productType);
  const uniqueTypes = new Set(productTypes.filter(Boolean));
  if (uniqueTypes.size > 1) return null;

  const decision = buildCompareDecision(candidates);
  const canonicalUrl = getAbsoluteUrl(
    `/compare?ids=${listingIds.map(encodeURIComponent).join(",")}`,
  );
  const jsonLd = buildCompareJsonLd({ candidates, canonicalUrl });

  return { candidates, decision, jsonLd, canonicalUrl };
}

async function buildCompareCandidate(
  key: CompareCandidateKey,
  listingId: string,
): Promise<CompareCandidate | null> {
  const productSlug = await resolveProductSlugForListing(listingId);
  if (!productSlug) return null;

  const detail = await getProductDetail(productSlug);
  if (!detail) return null;

  const listing =
    detail.listings.find((item) => item.id === listingId) ?? null;
  if (!listing) return null;

  return { key, listingId, listing, detail };
}

async function resolveProductSlugForListing(
  listingId: string,
): Promise<string | null> {
  const { createSupabaseClient } = await import("@/lib/supabase");
  const { createProductSlug } = await import("@/lib/product-slug");
  const supabase = createSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("listings")
    .select("product_id")
    .eq("id", listingId)
    .maybeSingle();

  if (error || !data?.product_id) return null;

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, name, slug")
    .eq("id", String(data.product_id))
    .maybeSingle();

  if (productError || !product) return null;
  return product.slug ? String(product.slug) : createProductSlug(String(product.name));
}

export function summarizeCandidate(candidate: CompareCandidate): CompareCandidateSummary {
  const { listing, detail } = candidate;
  if (!listing || !detail) {
    throw new Error("Compare candidate missing listing or detail.");
  }

  const marketIntelligence: MarketIntelligence = detail.marketIntelligence;
  const opportunity: OpportunityAnalysis = detail.marketIntelligence.opportunityAnalysis;
  const intelligence: ProductIntelligence = detail.intelligence;
  const priceAnalysis = marketIntelligence.priceAnalysis;
  const marketSummary = marketIntelligence.marketSummary;
  const product = detail.product;

  return {
    key: candidate.key,
    listingId: candidate.listingId,
    productName: product.name,
    productSlug: product.slug,
    productUrl: getAbsoluteUrl(`/product/${product.slug}`),
    title: listing.title,
    price: listing.price,
    city: listing.city,
    source: listing.source,
    url: listing.url,
    condition: listing.condition,
    imageUrl: listing.imageUrl,
    createdAt: listing.createdAt,
    averagePrice: priceAnalysis.averagePrice,
    medianPrice: priceAnalysis.medianPrice,
    minPrice: priceAnalysis.minPrice,
    confidenceScore: marketIntelligence.confidenceScore,
    confidenceLevel: marketIntelligence.confidenceLevel,
    opportunityScore: opportunity.opportunityScore,
    opportunityLevel: opportunity.opportunityLevel,
    riskLevel: opportunity.riskLevel,
    recommendation: {
      action: opportunity.recommendation.action,
      label: opportunity.recommendation.label,
      description: opportunity.recommendation.description,
    },
    duplicateDensity: marketSummary.duplicateDensity,
    sourceCount: marketSummary.sourceCount,
    sampleSize: marketIntelligence.sampleSize,
    dataFreshness: opportunity.dataFreshness,
    priceAdvantagePercent: calculatePriceAdvantagePercent(
      priceAnalysis.averagePrice,
      listing.price,
    ),
    trendDirection: intelligence.trend.direction,
    trendChangePercent: intelligence.trend.changePercent,
    productType: extractProductTypeFromAttributes(product.attributes),
  };
}

export function buildCompareDecision(
  candidates: CompareCandidateSummary[],
): CompareDecision {
  const insufficientData = candidates.some((c) => c.sampleSize < 3);

  if (insufficientData) {
    return {
      recommendedKey: null,
      recommendedLabel: "Karar için yetersiz veri",
      headline:
        "İlanlar için yeterli piyasa verisi yok. Karar notu ilanlar çoğaldıkça güçlenecek.",
      reasons: buildInsufficientReasons(candidates),
      tied: false,
      insufficientData: true,
    };
  }

  const reasons: CompareReason[] = [
    buildLowerPriceReason(candidates),
    buildOpportunityReason(candidates),
    buildConfidenceReason(candidates),
    buildRiskReason(candidates),
    buildDuplicateReason(candidates),
    buildSampleSizeReason(candidates),
    buildSourceCountReason(candidates),
    buildFreshnessReason(candidates),
    buildPriceAdvantageReason(candidates),
  ].filter((reason): reason is CompareReason => reason !== null);

  const counts = candidates.map((_, i) => tallyWinnerVotes(reasons, i));
  const maxVotes = Math.max(...counts);
  const winners = counts
    .map((count, i) => (count === maxVotes ? i : -1))
    .filter((i) => i >= 0);
  const tied = winners.length > 1;
  const recommendedKey = tied ? null : winners[0];
  const recommendedLabel = tied
    ? "Başabaş"
    : recommendedKey !== null
      ? candidates[recommendedKey].productName
      : "";
  const headline = tied
    ? "İlanlar birbirine yakın sinyaller veriyor. Fiyat ve güven detaylarını birlikte değerlendir."
    : `Önerilen ilan: ${recommendedLabel}`;

  return {
    recommendedKey,
    recommendedLabel,
    headline,
    reasons,
    tied,
    insufficientData: false,
  };
}

function tallyWinnerVotes(reasons: CompareReason[], key: number): number {
  return reasons.reduce(
    (total, reason) => (reason.winnerKey === key ? total + 1 : total),
    0,
  );
}

export function findExtremeIndex(values: number[], preferLow: boolean): number | null {
  if (values.length === 0) return null;
  const allEqual = values.every((v, _, arr) => v === arr[0]);
  if (allEqual) return null;
  const extreme = preferLow ? Math.min(...values) : Math.max(...values);
  return values.indexOf(extreme);
}

function buildLowerPriceReason(
  candidates: CompareCandidateSummary[],
): CompareReason | null {
  const prices = candidates.map((c) => c.price);
  const winnerKey = findExtremeIndex(prices, true);
  if (winnerKey === null) return null;
  const winner = candidates[winnerKey];
  const maxPrice = Math.max(...prices);
  const diff = maxPrice > 0
    ? Math.round(((maxPrice - winner.price) / maxPrice) * 100)
    : 0;
  return {
    label: `Daha düşük fiyat (${formatPrice(winner.price)} · ~%${Math.max(0, diff)} ucuz) — ${winner.productName}`,
    winnerKey,
  };
}

function buildOpportunityReason(
  candidates: CompareCandidateSummary[],
): CompareReason | null {
  const scores = candidates.map((c) => c.opportunityScore);
  const winnerKey = findExtremeIndex(scores, false);
  if (winnerKey === null) return null;
  const winner = candidates[winnerKey];
  return {
    label: `Opportunity skoru daha yüksek (${winner.opportunityScore}/100) — ${winner.productName}`,
    winnerKey,
  };
}

function buildConfidenceReason(
  candidates: CompareCandidateSummary[],
): CompareReason | null {
  const scores = candidates.map((c) => c.confidenceScore);
  const winnerKey = findExtremeIndex(scores, false);
  if (winnerKey === null) return null;
  const winner = candidates[winnerKey];
  return {
    label: `Confidence daha yüksek (${winner.confidenceScore}/100) — ${winner.productName}`,
    winnerKey,
  };
}

function buildRiskReason(
  candidates: CompareCandidateSummary[],
): CompareReason | null {
  const ranks = candidates.map((c) => riskRank(c.riskLevel));
  const winnerKey = findExtremeIndex(ranks, true);
  if (winnerKey === null) return null;
  const winner = candidates[winnerKey];
  return {
    label: `Risk seviyesi daha düşük (${formatRiskLabel(winner.riskLevel)}) — ${winner.productName}`,
    winnerKey,
  };
}

function buildDuplicateReason(
  candidates: CompareCandidateSummary[],
): CompareReason | null {
  const densities = candidates.map((c) => c.duplicateDensity);
  const winnerKey = findExtremeIndex(densities, true);
  if (winnerKey === null) return null;
  const winner = candidates[winnerKey];
  return {
    label: `Duplicate yoğunluğu daha düşük (%${Math.round(winner.duplicateDensity * 100)}) — ${winner.productName}`,
    winnerKey,
  };
}

function buildSampleSizeReason(
  candidates: CompareCandidateSummary[],
): CompareReason | null {
  const sizes = candidates.map((c) => c.sampleSize);
  const winnerKey = findExtremeIndex(sizes, false);
  if (winnerKey === null) return null;
  const winner = candidates[winnerKey];
  return {
    label: `Daha fazla veri var (${winner.sampleSize} ilan) — ${winner.productName}`,
    winnerKey,
  };
}

function buildSourceCountReason(
  candidates: CompareCandidateSummary[],
): CompareReason | null {
  const counts = candidates.map((c) => c.sourceCount);
  const winnerKey = findExtremeIndex(counts, false);
  if (winnerKey === null) return null;
  const winner = candidates[winnerKey];
  return {
    label: `Daha fazla kaynak doğruladı (${winner.sourceCount} kaynak) — ${winner.productName}`,
    winnerKey,
  };
}

function buildFreshnessReason(
  candidates: CompareCandidateSummary[],
): CompareReason | null {
  const ranks = candidates.map((c) => freshnessRank(c.dataFreshness));
  const winnerKey = findExtremeIndex(ranks, true);
  if (winnerKey === null) return null;
  const winner = candidates[winnerKey];
  return {
    label: `Veri daha güncel (${formatFreshnessLabel(winner.dataFreshness)}) — ${winner.productName}`,
    winnerKey,
  };
}

function buildPriceAdvantageReason(
  candidates: CompareCandidateSummary[],
): CompareReason | null {
  const advantages = candidates.map((c) => c.priceAdvantagePercent ?? null);
  // Replace null with -Infinity so findExtremeIndex treats null as non-winning
  const winnerKey = findExtremeIndex(
    advantages.map((a) => a ?? -Infinity),
    false,
  );
  if (winnerKey === null || advantages[winnerKey] === null) return null;
  return {
    label: `Piyasa ortalamasının %${formatAdvantage(advantages[winnerKey])} altında — ${candidates[winnerKey].productName}`,
    winnerKey,
  };
}

function buildInsufficientReasons(
  candidates: CompareCandidateSummary[],
): CompareReason[] {
  const reasons: CompareReason[] = [];
  for (const c of candidates) {
    if (c.sampleSize < 3) {
      reasons.push({
        label: `${c.productName} için örneklem yetersiz (${c.sampleSize} ilan)`,
        winnerKey: null,
      });
    }
  }
  if (!reasons.length) {
    reasons.push({
      label: "İlanlar için güvenli karşılaştırma için yeterli veri bekleniyor.",
      winnerKey: null,
    });
  }
  return reasons;
}

export function buildCompareJsonLd({
  candidates,
  canonicalUrl,
}: {
  candidates: CompareCandidateSummary[];
  canonicalUrl: string;
}): CompareJsonLdDocument[] {
  const breadcrumbId = `${canonicalUrl}#breadcrumb`;
  const itemListId = `${canonicalUrl}#compared-listings`;

  const productNames = candidates.map((c) => c.productName);
  const name =
    candidates.length === 2
      ? `${productNames[0]} ve ${productNames[1]} karşılaştırma — 2ElBul`
      : `${productNames.slice(0, -1).join(", ")} ve ${productNames[productNames.length - 1]} karşılaştırma — 2ElBul`;
  const description = `İkinci el ${productNames.join(", ")} ilanları için AI karar destek karşılaştırması.`;

  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name,
      description,
      url: canonicalUrl,
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
          name: "İlan Karşılaştır",
          item: canonicalUrl,
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "@id": itemListId,
      name: "Karşılaştırılan ilanlar",
      itemListOrder: "https://schema.org/ItemListOrderAscending",
      itemListElement: candidates.map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: c.productName,
        url: c.productUrl,
        item: {
          "@type": "Product",
          name: c.productName,
          url: c.productUrl,
        },
      })),
    },
  ];
}

function riskRank(level: string) {
  if (level === "very-low") return 0;
  if (level === "low") return 1;
  if (level === "medium") return 2;
  if (level === "high") return 3;
  return 4;
}

function freshnessRank(freshness: string) {
  if (freshness === "fresh") return 0;
  if (freshness === "recent") return 1;
  if (freshness === "stale") return 2;
  return 3;
}

function formatRiskLabel(level: string) {
  if (level === "very-low") return "Çok düşük";
  if (level === "low") return "Düşük";
  if (level === "medium") return "Orta";
  if (level === "high") return "Yüksek";
  return "Çok yüksek";
}

function formatFreshnessLabel(freshness: string) {
  if (freshness === "fresh") return "Çok güncel";
  if (freshness === "recent") return "Güncel";
  if (freshness === "stale") return "Eski";
  return "Bilinmiyor";
}

function formatAdvantage(value: number | null) {
  if (value === null) return "—";
  return Math.max(0, Math.round(value)).toLocaleString("tr-TR");
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value);
}
