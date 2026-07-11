import { cache } from "react";
import { getHomeData, type HomeData } from "@/lib/home-data";
import { createProductSlug } from "@/lib/product-slug";
import { getProductDetail, type ProductDetailData } from "@/lib/product-detail";
import { getAbsoluteUrl } from "@/lib/site-url";
import {
  buildInstagramReelCaption,
  buildInstagramReelOverlayLines,
} from "./helpers";
import type { InstagramReelDraft, InstagramReelSelection } from "./types";

type ReelCandidateSource = Pick<
  HomeData,
  "priceOpportunities" | "latestListings" | "refurbishedListings"
>;

export function pickDailyInstagramReelSelection(
  homeData: ReelCandidateSource,
): InstagramReelSelection | null {
  const sourceListing =
    homeData.priceOpportunities[0] ??
    homeData.latestListings[0] ??
    homeData.refurbishedListings[0] ??
    null;

  if (!sourceListing) return null;

  const productName = String(sourceListing.productName ?? "").trim();
  if (!productName) return null;

  return {
    productSlug: createProductSlug(productName),
    productName,
    sourceListing,
    selectionReason:
      homeData.priceOpportunities[0] === sourceListing
        ? "price-opportunity"
        : homeData.latestListings[0] === sourceListing
          ? "latest-listing"
          : "refurbished-listing",
  };
}

export const selectDailyInstagramReelSelection = cache(async () => {
  const homeData = await getHomeData();
  return pickDailyInstagramReelSelection(homeData);
});

export const buildInstagramReelDraftForSlug = cache(
  async (productSlug: string): Promise<InstagramReelDraft | null> => {
    const productDetail = await getProductDetail(productSlug);
    if (!productDetail) return null;
    return buildInstagramReelDraft(productDetail);
  },
);

export function buildInstagramReelDraft(
  detail: ProductDetailData,
): InstagramReelDraft {
  const marketIntelligence = detail.marketIntelligence;
  const opportunity = marketIntelligence.opportunityAnalysis;
  const bestDeal = detail.bestDeals[0] ?? null;
  const listing = bestDeal?.listing ?? detail.listings[0] ?? null;
  const coverImageUrl =
    bestDeal?.listing.imageUrl ??
    detail.listings.find((item) => item.imageUrl)?.imageUrl ??
    null;
  const listingUrl = bestDeal?.listing.url ?? listing?.url ?? null;

  const draft: InstagramReelDraft = {
    productSlug: detail.product.slug,
    productName: detail.product.name,
    productUrl: getAbsoluteUrl(`/product/${detail.product.slug}`),
    listingUrl,
    coverImageUrl,
    city: listing?.city ?? null,
    sourceName: listing?.source ?? null,
    opportunityScore: opportunity.opportunityScore,
    opportunityLevel: opportunity.opportunityLevel,
    riskLevel: opportunity.riskLevel,
    recommendationAction: opportunity.recommendation.action,
    recommendationLabel: opportunity.recommendation.label,
    recommendationDescription: opportunity.recommendation.description,
    confidenceScore: marketIntelligence.confidenceScore,
    confidenceLevel: marketIntelligence.confidenceLevel,
    averagePrice: marketIntelligence.priceAnalysis.averagePrice,
    minPrice: marketIntelligence.priceAnalysis.minPrice,
    maxPrice: marketIntelligence.priceAnalysis.maxPrice,
    priceAdvantagePercent: opportunityScorePriceAdvantage(detail),
    sampleSize: opportunity.sampleSize,
    sourceCount: marketIntelligence.marketSummary.sourceCount,
    analysisGeneratedAt: marketIntelligence.analysisGeneratedAt,
    scoreGeneratedAt: opportunity.scoreGeneratedAt,
    dataFreshness: opportunity.dataFreshness,
    reasons: opportunity.reasons,
    warningSignals: opportunity.warningSignals,
    positiveSignals: opportunity.positiveSignals,
    bestDealLabel: bestDeal?.label ?? null,
    bestDealPrice: bestDeal?.listing.price ?? null,
    bestDealDifferencePercent: bestDeal?.differencePercent ?? null,
  };

  return draft;
}

export function buildInstagramReelCaptionForDraft(draft: InstagramReelDraft) {
  return buildInstagramReelCaption(draft);
}

export function buildInstagramReelOverlayForDraft(draft: InstagramReelDraft) {
  return buildInstagramReelOverlayLines(draft);
}

function opportunityScorePriceAdvantage(detail: ProductDetailData) {
  const marketIntelligence = detail.marketIntelligence;
  const average = marketIntelligence.priceAnalysis.averagePrice;
  const lowest = marketIntelligence.priceAnalysis.minPrice;

  if (
    typeof average !== "number" ||
    !Number.isFinite(average) ||
    average <= 0 ||
    typeof lowest !== "number" ||
    !Number.isFinite(lowest) ||
    lowest <= 0
  ) {
    return null;
  }

  return Math.max(0, Math.round(((average - lowest) / average) * 1000) / 10);
}
