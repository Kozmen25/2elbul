export interface ListingValidationError {
  field: string;
  reason: string;
}

export interface NormalizedListing {
  externalId: string;
  title: string;
  price: number;
  currency: "TRY";
  url: string;
  imageUrl: string | null;
  sourceId: number;
  sourceName: string;
  location: string | null;
  condition: string;
  listedAt: string | null;
  rawData: Record<string, unknown> | null;
}

export interface ValidationResult<T = NormalizedListing> {
  ok: boolean;
  value: T | null;
  errors: ListingValidationError[];
}

export interface MatchingResult {
  score: number;
  productId: number | null;
  confidence: "high" | "medium" | "low" | "none";
}

export interface PipelineMetrics {
  found: number;
  normalized: number;
  valid: number;
  matched: number;
  persisted: number;
  failed: number;
  duration_ms: number;
}

export interface SourceRunResult {
  ok: boolean;
  sourceId: number;
  sourceName: string;
  status: "success" | "failed";
  metrics: PipelineMetrics;
  errors: string[];
}

export interface SourceAdapterOptions {
  sourceId: number;
  sourceName: string;
  sourceSlug: string;
}

export interface SourceAdapterFetch {
  (options: { limit?: number; query?: string }): Promise<unknown[]>;
}

export interface UnifiedSourceAdapter {
  readonly sourceId: number;
  readonly sourceName: string;
  readonly sourceSlug: string;

  fetch(options: { limit?: number; query?: string }): Promise<unknown[]>;
  normalize(raw: unknown): NormalizedListing | null;
  validate(listing: NormalizedListing): ValidationResult;
  match(listing: NormalizedListing): Promise<MatchingResult>;
  persist(
    listing: NormalizedListing,
    matchResult: MatchingResult,
  ): Promise<boolean>;
  healthCheck(): Promise<{ ok: boolean; message: string | null }>;
}

export interface SourceRegistry {
  register(adapter: UnifiedSourceAdapter): void;
  get(sourceSlug: string): UnifiedSourceAdapter | null;
  getAll(): UnifiedSourceAdapter[];
  has(sourceSlug: string): boolean;
}
