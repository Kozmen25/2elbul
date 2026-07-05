import type { ConfidenceMetadata } from "../confidence-engine";

export interface DuplicateScore {
  normalization: number;
  brand: number;
  model: number;
  storage: number;
  ram: number;
  variant: number;
  condition: number;
  price: number;
  titleSimilarity: number;
  sourceDiversity: number;
}

export interface DuplicateResult extends ConfidenceMetadata {
  score: number;
  confidence: 'same' | 'strong' | 'possible' | 'different';
  signals: DuplicateScore;
  reasoning: string[];
}

export interface DuplicateFingerprint {
  brand: string | null;
  model: string | null;
  storage: string | null;
  ram: string | null;
  variant: string | null;
  normalized: string;
  tokens: Set<string>;
}

export interface ComparisonInput {
  title: string;
  brand?: string | null;
  model?: string | null;
  storage?: string | null;
  ram?: string | null;
  condition?: string | null;
  price?: number | null;
  sourceId?: number | null;
}

export interface DuplicateMatch extends ConfidenceMetadata {
  listing1Id: string | number;
  listing2Id: string | number;
  score: number;
  confidence: 'same' | 'strong' | 'possible' | 'different';
}

export interface DuplicateGroupItem extends ConfidenceMetadata {
  id: string | number;
  score: number;
  confidence: 'same' | 'strong' | 'possible' | 'different';
}

export interface DuplicateGroup {
  canonical: ComparisonInput;
  duplicates: Array<ComparisonInput & DuplicateGroupItem>;
}
