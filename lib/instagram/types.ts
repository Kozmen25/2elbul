import type { ConfidenceLevel } from "@/lib/confidence-engine";
import type { HomeListing } from "@/lib/home-data";
import type { OpportunityAnalysis } from "@/lib/opportunity-engine";

export type InstagramReelSelection = {
  productSlug: string;
  productName: string;
  sourceListing: HomeListing;
  selectionReason: "price-opportunity" | "latest-listing" | "refurbished-listing";
};

export type InstagramReelDraft = {
  productSlug: string;
  productName: string;
  productUrl: string;
  listingUrl: string | null;
  coverImageUrl: string | null;
  city: string | null;
  sourceName: string | null;
  opportunityScore: number;
  opportunityLevel: OpportunityAnalysis["opportunityLevel"];
  riskLevel: OpportunityAnalysis["riskLevel"];
  recommendationAction: OpportunityAnalysis["recommendation"]["action"];
  recommendationLabel: string;
  recommendationDescription: string;
  confidenceScore: number;
  confidenceLevel: ConfidenceLevel;
  averagePrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  priceAdvantagePercent: number | null;
  sampleSize: number;
  sourceCount: number;
  analysisGeneratedAt: string;
  scoreGeneratedAt: string;
  dataFreshness: OpportunityAnalysis["dataFreshness"];
  reasons: string[];
  warningSignals: string[];
  positiveSignals: string[];
  bestDealLabel: string | null;
  bestDealPrice: number | null;
  bestDealDifferencePercent: number | null;
};

export type InstagramPublishConfig = {
  accessToken: string;
  igUserId: string;
  graphApiVersion: string;
};

export type InstagramPublishResult = {
  creationId: string;
  mediaId: string;
  videoUrl: string;
};
