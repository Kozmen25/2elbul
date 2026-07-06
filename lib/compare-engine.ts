import type { ProductDetailData } from "@/lib/product-detail";
import { getProductDetail } from "@/lib/product-detail";
import type { OpportunityAnalysis, OpportunityDataFreshness, OpportunityLevel } from "@/lib/opportunity-engine";
import type { ConfidenceLevel } from "@/lib/confidence-engine";
import type { MarketIntelligence } from "@/lib/market-intelligence";
import type { ProductIntelligence } from "@/lib/intelligence-engine";
import type { Listing } from "@/lib/listings";
import { getAbsoluteUrl } from "@/lib/site-url";
import { calculatePriceAdvantagePercent } from "@/lib/opportunity-engine";

export type CompareCandidateKey = "a" | "b";

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
  candidateA: CompareCandidateSummary;
  candidateB: CompareCandidateSummary;
  decision: CompareDecision;
  jsonLd: CompareJsonLdDocument[];
  canonicalUrl: string;
};

export async function getComparePageData(
  listingIdA: string,
  listingIdB: string,
): Promise<ComparePageData | null> {
  const [candidateAResult, candidateBResult] = await Promise.all([
    buildCompareCandidate("a", listingIdA),
    buildCompareCandidate("b", listingIdB),
  ]);

  if (!candidateAResult || !candidateBResult) return null;

  const candidateA = summarizeCandidate(candidateAResult);
  const candidateB = summarizeCandidate(candidateBResult);
  const decision = buildCompareDecision(candidateA, candidateB);
  const canonicalUrl = getAbsoluteUrl(
    `/compare?a=${encodeURIComponent(listingIdA)}&b=${encodeURIComponent(listingIdB)}`,
  );
  const jsonLd = buildCompareJsonLd({
    candidateA,
    candidateB,
    canonicalUrl,
  });

  return {
    candidateA,
    candidateB,
    decision,
    jsonLd,
    canonicalUrl,
  };
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
  };
}

export function buildCompareDecision(
  candidateA: CompareCandidateSummary,
  candidateB: CompareCandidateSummary,
): CompareDecision {
  const insufficientData =
    candidateA.sampleSize < 3 || candidateB.sampleSize < 3;

  if (insufficientData) {
    return {
      recommendedKey: null,
      recommendedLabel: "Karar için yetersiz veri",
      headline:
        "İki ilan için de yeterli piyasa verisi yok. Karar notu ilanlar çoğaldıkça güçlenecek.",
      reasons: buildInsufficientReasons(candidateA, candidateB),
      tied: false,
      insufficientData: true,
    };
  }

  const reasons: CompareReason[] = [
    buildLowerPriceReason(candidateA, candidateB),
    buildOpportunityReason(candidateA, candidateB),
    buildConfidenceReason(candidateA, candidateB),
    buildRiskReason(candidateA, candidateB),
    buildDuplicateReason(candidateA, candidateB),
    buildSampleSizeReason(candidateA, candidateB),
    buildSourceCountReason(candidateA, candidateB),
    buildFreshnessReason(candidateA, candidateB),
    buildPriceAdvantageReason(candidateA, candidateB),
  ].filter((reason): reason is CompareReason => reason !== null);

  const scoreA = tallyWinnerVotes(reasons, "a");
  const scoreB = tallyWinnerVotes(reasons, "b");
  const tied = scoreA === scoreB;
  const recommendedKey: CompareCandidateKey | null = tied
    ? null
    : scoreA > scoreB
      ? "a"
      : "b";
  const recommendedLabel = tied
    ? "Başabaş"
    : recommendedKey === "a"
      ? candidateA.productName
      : candidateB.productName;
  const headline = tied
    ? "İki ilan birbirine yakın sinyaller veriyor. Fiyat ve güven detaylarını birlikte değerlendir."
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

function tallyWinnerVotes(reasons: CompareReason[], key: CompareCandidateKey) {
  return reasons.reduce(
    (total, reason) => (reason.winnerKey === key ? total + 1 : total),
    0,
  );
}

function buildLowerPriceReason(
  a: CompareCandidateSummary,
  b: CompareCandidateSummary,
): CompareReason | null {
  if (a.price === b.price) return null;
  const winnerKey = a.price < b.price ? "a" : "b";
  const winner = winnerKey === "a" ? a : b;
  const loser = winnerKey === "a" ? b : a;
  const diff = Math.round(((loser.price - winner.price) / loser.price) * 100);
  return {
    label: `Daha düşük fiyat (${formatPrice(winner.price)} · ~%${Math.max(0, diff)} ucuz)`,
    winnerKey,
  };
}

function buildOpportunityReason(
  a: CompareCandidateSummary,
  b: CompareCandidateSummary,
): CompareReason | null {
  if (a.opportunityScore === b.opportunityScore) return null;
  const winnerKey = a.opportunityScore > b.opportunityScore ? "a" : "b";
  const winner = winnerKey === "a" ? a : b;
  return {
    label: `Opportunity skoru daha yüksek (${winner.opportunityScore}/100)`,
    winnerKey,
  };
}

function buildConfidenceReason(
  a: CompareCandidateSummary,
  b: CompareCandidateSummary,
): CompareReason | null {
  if (a.confidenceScore === b.confidenceScore) return null;
  const winnerKey = a.confidenceScore > b.confidenceScore ? "a" : "b";
  const winner = winnerKey === "a" ? a : b;
  return {
    label: `Confidence daha yüksek (${winner.confidenceScore}/100)`,
    winnerKey,
  };
}

function buildRiskReason(
  a: CompareCandidateSummary,
  b: CompareCandidateSummary,
): CompareReason | null {
  const rankA = riskRank(a.riskLevel);
  const rankB = riskRank(b.riskLevel);
  if (rankA === rankB) return null;
  const winnerKey = rankA < rankB ? "a" : "b";
  const winner = winnerKey === "a" ? a : b;
  return {
    label: `Risk seviyesi daha düşük (${formatRiskLabel(winner.riskLevel)})`,
    winnerKey,
  };
}

function buildDuplicateReason(
  a: CompareCandidateSummary,
  b: CompareCandidateSummary,
): CompareReason | null {
  if (a.duplicateDensity === b.duplicateDensity) return null;
  const winnerKey = a.duplicateDensity < b.duplicateDensity ? "a" : "b";
  const winner = winnerKey === "a" ? a : b;
  return {
    label: `Duplicate yoğunluğu daha düşük (%${Math.round(winner.duplicateDensity * 100)})`,
    winnerKey,
  };
}

function buildSampleSizeReason(
  a: CompareCandidateSummary,
  b: CompareCandidateSummary,
): CompareReason | null {
  if (a.sampleSize === b.sampleSize) return null;
  const winnerKey = a.sampleSize > b.sampleSize ? "a" : "b";
  const winner = winnerKey === "a" ? a : b;
  return {
    label: `Daha fazla veri var (${winner.sampleSize} ilan)`,
    winnerKey,
  };
}

function buildSourceCountReason(
  a: CompareCandidateSummary,
  b: CompareCandidateSummary,
): CompareReason | null {
  if (a.sourceCount === b.sourceCount) return null;
  const winnerKey = a.sourceCount > b.sourceCount ? "a" : "b";
  const winner = winnerKey === "a" ? a : b;
  return {
    label: `Daha fazla kaynak doğruladı (${winner.sourceCount} kaynak)`,
    winnerKey,
  };
}

function buildFreshnessReason(
  a: CompareCandidateSummary,
  b: CompareCandidateSummary,
): CompareReason | null {
  const rankA = freshnessRank(a.dataFreshness);
  const rankB = freshnessRank(b.dataFreshness);
  if (rankA === rankB) return null;
  const winnerKey = rankA < rankB ? "a" : "b";
  const winner = winnerKey === "a" ? a : b;
  return {
    label: `Veri daha güncel (${formatFreshnessLabel(winner.dataFreshness)})`,
    winnerKey,
  };
}

function buildPriceAdvantageReason(
  a: CompareCandidateSummary,
  b: CompareCandidateSummary,
): CompareReason | null {
  const advantageA = a.priceAdvantagePercent ?? null;
  const advantageB = b.priceAdvantagePercent ?? null;
  if (advantageA === null && advantageB === null) return null;
  if (advantageA === null) return { label: `Piyasa ortalamasının altında (${formatAdvantage(advantageB)})`, winnerKey: "b" };
  if (advantageB === null) return { label: `Piyasa ortalamasının altında (${formatAdvantage(advantageA)})`, winnerKey: "a" };
  if (advantageA === advantageB) return null;
  const winnerKey = advantageA > advantageB ? "a" : "b";
  const winner = winnerKey === "a" ? advantageA : advantageB;
  return {
    label: `Piyasa ortalamasının %${formatAdvantage(winner)} altında`,
    winnerKey,
  };
}

function buildInsufficientReasons(
  a: CompareCandidateSummary,
  b: CompareCandidateSummary,
): CompareReason[] {
  const reasons: CompareReason[] = [];
  if (a.sampleSize < 3) {
    reasons.push({
      label: `${a.productName} için örneklem yetersiz (${a.sampleSize} ilan)`,
      winnerKey: null,
    });
  }
  if (b.sampleSize < 3) {
    reasons.push({
      label: `${b.productName} için örneklem yetersiz (${b.sampleSize} ilan)`,
      winnerKey: null,
    });
  }
  if (!reasons.length) {
    reasons.push({
      label: "İki ilan için de güvenli karşılaştırma için yeterli veri bekleniyor.",
      winnerKey: null,
    });
  }
  return reasons;
}

export function buildCompareJsonLd({
  candidateA,
  candidateB,
  canonicalUrl,
}: {
  candidateA: CompareCandidateSummary;
  candidateB: CompareCandidateSummary;
  canonicalUrl: string;
}): CompareJsonLdDocument[] {
  const breadcrumbId = `${canonicalUrl}#breadcrumb`;
  const itemListId = `${canonicalUrl}#compared-listings`;

  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "İlan karşılaştırma — 2ElBul",
      description: `${candidateA.productName} ve ${candidateB.productName} ikinci el ilanları için AI karar destek karşılaştırması.`,
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
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: candidateA.productName,
          url: candidateA.productUrl,
          item: {
            "@type": "Product",
            name: candidateA.productName,
            url: candidateA.productUrl,
          },
        },
        {
          "@type": "ListItem",
          position: 2,
          name: candidateB.productName,
          url: candidateB.productUrl,
          item: {
            "@type": "Product",
            name: candidateB.productName,
            url: candidateB.productUrl,
          },
        },
      ],
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
