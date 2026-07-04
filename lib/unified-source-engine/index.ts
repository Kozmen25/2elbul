export type {
  UnifiedSourceAdapter,
  SourceRegistry,
  NormalizedListing,
  ValidationResult,
  MatchingResult,
  PipelineMetrics,
  SourceRunResult,
  SourceAdapterOptions,
  SourceAdapterFetch,
  ListingValidationError,
} from "./types";

export {
  validateListing,
  createNormalizedListing,
  createEmptyMatchingResult,
  createHighConfidenceMatch,
  createMediumConfidenceMatch,
  createLowConfidenceMatch,
  executePipeline,
} from "./pipeline";

export { getSourceRegistry, initializeSourceRegistry } from "./registry";

export { createSourceAdapter } from "./factory";

export type { SimpleAdapterConfig } from "./factory";
