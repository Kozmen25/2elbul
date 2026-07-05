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
} from "./types";

export { normalizeProductTitle } from "./helpers";
export { extractProductSignals, generateProductKey } from "./signals";
export { dryRunProductMatch, findOrCreateMatchedProduct } from "./matcher";
export { detectListingDuplicates, groupListingDuplicates } from "./duplicate";
export { summarizeDuplicateGroups } from "./summary";
