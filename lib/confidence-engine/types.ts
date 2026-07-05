export type ConfidenceLevel =
  | "very-high"
  | "high"
  | "medium"
  | "low"
  | "very-low";

export type ConfidenceSignalName =
  | "normalizationScore"
  | "taxonomyScore"
  | "brandScore"
  | "modelScore"
  | "storageScore"
  | "ramScore"
  | "variantScore"
  | "duplicateScore"
  | "priceConsistency"
  | "titleSimilarity"
  | "sourceCount"
  | "sourceReliability";

export type ConfidenceSignalScores = Partial<Record<ConfidenceSignalName, number | null>>;

export type ConfidenceContext = {
  title?: string | null;
  normalizedTitle?: string | null;
  canonicalTitle?: string | null;
  productName?: string | null;
  categoryLabel?: string | null;
  taxonomyConfidence?: "high" | "medium" | "low" | null;
  taxonomyHasFullPath?: boolean;
  taxonomyAttributeCount?: number;
  sourceName?: string | null;
  sourceNames?: string[];
  sourceCount?: number | null;
  sourceReliability?: number | null;
};

export type ConfidenceInput = {
  signals: ConfidenceSignalScores;
  context?: ConfidenceContext;
};

export type ConfidenceResult = {
  score: number;
  level: ConfidenceLevel;
  reasons: string[];
  signals: ConfidenceSignalScores;
};

export type ConfidenceMetadata = {
  confidenceScore: number;
  confidenceLevel: ConfidenceLevel;
  confidenceReasons: string[];
};

export type DuplicateScoreLike = {
  normalization: number;
  brand: number;
  model: number;
  storage: number;
  ram: number;
  variant: number;
  price: number;
  titleSimilarity: number;
  sourceDiversity: number;
};

export type ProductSignalsLike = {
  brand: string | null;
  model: string | null;
  storage: string | null;
  ram: string | null;
  color?: string | null;
  category: string | null;
  normalizedKey: string;
};
