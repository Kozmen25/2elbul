export type {
  ProductSignals,
  MatchedProduct,
  ProductMatcherDryRunResult,
  ListingDuplicateDetectionResult,
  GroupedListingDuplicates,
  DuplicateBatchSummary,
  ComparisonListing,
  ProductRow,
  FindOrCreateMatchedProductInput,
  BatchMatchCandidate,
  BatchMatcherInput,
} from "./types";

export { normalizeProductTitle } from "./helpers";
export { extractProductSignals, generateProductKey } from "./signals";
export { batchFindOrCreateMatchedProducts, dryRunProductMatch, findOrCreateMatchedProduct } from "./matcher";
export { batchFindExistingMatchedProducts, findExistingMatchedProduct } from "./repository";
export { detectListingDuplicates, groupListingDuplicates } from "./duplicate";
export { summarizeDuplicateGroups } from "./summary";
