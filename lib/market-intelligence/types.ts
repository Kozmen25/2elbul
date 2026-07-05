import type {
  ConfidenceLevel,
  ConfidenceResult,
} from "@/lib/confidence-engine";
import type { ProductIntelligence } from "@/lib/intelligence-engine";
import type { Listing } from "@/lib/listings";
import type { DuplicateBatchSummary } from "@/lib/product-matcher";

export type MarketIntelligenceScope = {
  productId: string | number;
  productName: string;
  slug: string;
  url: string;
  category: string | null;
  brand?: string | null;
  city?: string | null;
};

export type MarketIntelligenceListing = Pick<
  Listing,
  "id" | "title" | "price" | "source" | "city" | "condition" | "createdAt" | "updatedAt"
> & {
  productId?: string | number | null;
  productName?: string | null;
  status?: string | null;
  confidenceScore?: number | null;
  confidenceLevel?: ConfidenceLevel | null;
  sourceReliability?: number | null;
};

export type MarketSourceBreakdown = {
  source: string;
  listingCount: number;
  share: number;
  averagePrice: number | null;
  lowestPrice: number | null;
  highestPrice: number | null;
};

export type MarketPriceAnalysis = {
  averagePrice: number | null;
  medianPrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  priceRange: number | null;
  priceSpreadPercent: number | null;
  marketValue: number | null;
  listingCount: number;
  activeListingCount: number;
  sampleSize: number;
};

export type MarketOpportunity = {
  score: number;
  label: ProductIntelligence["opportunity"]["label"];
  explanation: string;
  action: ProductIntelligence["recommendation"]["action"];
  discountPercent: number | null;
};

export type MarketSummary = {
  summary: string;
  highlights: string[];
  warnings: string[];
  sourceBreakdown: MarketSourceBreakdown[];
  totalListingCount: number;
  activeListingCount: number;
  sourceCount: number;
  duplicateGroupCount: number;
  duplicatePairCount: number;
  duplicateItemCount: number;
  duplicateDensity: number;
  confidenceAverage: number | null;
};

export type MarketIntelligenceJsonLdProperty = {
  "@type": "PropertyValue";
  name: string;
  value: string | number;
};

export type MarketIntelligenceJsonLd = {
  "@context": "https://schema.org";
  "@type": "Dataset";
  name: string;
  description: string;
  url: string;
  about: {
    "@type": "Product";
    name: string;
    category?: string | null;
    brand?: {
      "@type": "Brand";
      name: string;
    };
  };
  additionalProperty: MarketIntelligenceJsonLdProperty[];
};

export type MarketIntelligence = {
  scope: MarketIntelligenceScope;
  analysisGeneratedAt: string;
  sampleSize: number;
  confidenceScore: number;
  confidenceLevel: ConfidenceLevel;
  confidenceReasons: string[];
  sourcesUsed: string[];
  priceAnalysis: MarketPriceAnalysis;
  marketSummary: MarketSummary;
  opportunity: MarketOpportunity;
  structuredData: MarketIntelligenceJsonLd;
};

export type MarketIntelligenceDecisionInsight = {
  confidence: ConfidenceResult | null;
  smartPrice: {
    summary: string;
    details: string[];
    warnings: string[];
  };
};

export type MarketIntelligenceInput = {
  scope: MarketIntelligenceScope;
  listings: MarketIntelligenceListing[];
  intelligence?: ProductIntelligence | null;
  decisionInsight?: MarketIntelligenceDecisionInsight | null;
  duplicateSummary?: DuplicateBatchSummary | null;
  analyzedAt?: string | Date | null;
};
