import type { ConfidenceLevel } from "@/lib/confidence-engine";
import type { MarketIntelligence } from "@/lib/market-intelligence";
import type { ProductIntelligence } from "@/lib/intelligence-engine";
import type { DuplicateBatchSummary } from "@/lib/product-matcher";

export type OpportunityLevel = ConfidenceLevel;

export type OpportunityDataFreshness = "fresh" | "recent" | "stale" | "unknown";

export type OpportunityRecommendationAction =
  | "buy_now"
  | "watch"
  | "wait"
  | "avoid"
  | "insufficient_data";

export type OpportunityRecommendation = {
  action: OpportunityRecommendationAction;
  label: string;
  description: string;
};

export type OpportunityJsonLdProperty = {
  "@type": "PropertyValue";
  name: string;
  value: string | number;
};

export type OpportunityAnalysis = {
  opportunityScore: number;
  opportunityLevel: OpportunityLevel;
  riskLevel: OpportunityLevel;
  recommendation: OpportunityRecommendation;
  reasons: string[];
  warningSignals: string[];
  positiveSignals: string[];
  scoreGeneratedAt: string;
  scoreVersion: string;
  dataFreshness: OpportunityDataFreshness;
  sampleSize: number;
  confidenceLevel: ConfidenceLevel;
};

export type OpportunityEngineInput = {
  marketIntelligence: MarketIntelligence;
  intelligence?: ProductIntelligence | null;
  duplicateSummary?: DuplicateBatchSummary | null;
  analyzedAt?: string | Date | null;
  latestListingAt?: string | Date | null;
};

export type OpportunitySignalContext = {
  sampleSize: number;
  confidenceScore: number;
  confidenceLevel: ConfidenceLevel;
  sourceCount: number;
  duplicateDensity: number;
  priceSpreadPercent: number | null;
  priceAdvantagePercent: number | null;
  buyScore: number | null;
  waitScore: number | null;
  opportunityScoreFromIntelligence: number | null;
  trendDirection: ProductIntelligence["trend"]["direction"];
  trendChangePercent: number | null;
  demandLevel: ProductIntelligence["demand"]["demandLevel"];
  dataFreshness: OpportunityDataFreshness;
  latestListingAgeDays: number | null;
  sourceConcentration: number | null;
};
