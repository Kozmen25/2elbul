import type { ConfidenceMetadata } from "@/lib/confidence-engine";
import type { DuplicateMatch, DuplicateGroup } from "@/lib/duplicate-engine/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ICategoryResolver } from "@/lib/taxonomy/integration";

export type ProductSignals = {
  brand: string | null;
  model: string | null;
  storage: string | null;
  ram: string | null;
  color: string | null;
  category: string | null;
  normalizedKey: string;
};

export type MatchedProduct = {
  id: string | number;
  name: string;
  signals: ProductSignals;
  created: boolean;
} & ConfidenceMetadata;

export type ProductMatcherDryRunResult = {
  inputTitle: string;
  normalizedTitle: string;
  signals: ProductSignals;
  productKey: string;
  matchedProduct: {
    id: string | number;
    name: string;
  } | null;
  wouldCreate: boolean;
  suggestedName: string;
} & ConfidenceMetadata;

export type ComparisonListing = {
  id: string | number;
  title: string;
  price: number;
  source: string;
  condition?: string;
};

export type ListingDuplicateDetectionResult = {
  listing: ComparisonListing;
  duplicates: DuplicateMatch[];
  isDuplicate: boolean;
  confidenceScore: number;
  suggestion: "match" | "review" | "none";
};

export type GroupedListingDuplicates = {
  groups: DuplicateGroup[];
  count: number;
  matchedCount: number;
};

export type DuplicateBatchSummary = {
  threshold: number;
  itemCount: number;
  groupCount: number;
  matchedGroupCount: number;
  duplicatePairCount: number;
  duplicateItemCount: number;
  maxGroupSize: number;
  topGroups: Array<{
    canonicalId: string | number;
    canonicalTitle: string;
    duplicateCount: number;
    maxScore: number;
    sampleTitles: string[];
  }>;
};

export type ProductRow = {
  id: string | number;
  name: string;
  category?: string | null;
};

export type BatchMatcherInput = {
  title: string;
  productName?: string | null;
  category?: string | null;
  source?: string | null;
};

export type BatchMatchCandidate = {
  canonicalName: string;
  canonicalKey: string;
};

export type FindOrCreateMatchedProductInput = {
  supabase: SupabaseClient;
  title: string;
  productName?: string | null;
  category?: string | null;
  source?: string | null;
  resolver?: ICategoryResolver;
};
