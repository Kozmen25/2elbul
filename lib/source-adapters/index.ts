import type { SourceAdapter } from "@/lib/source-adapters/types";
import { mockSourceAdapter } from "@/lib/source-adapters/mock-adapter";

const adapters = new Map<string, SourceAdapter>([
  [mockSourceAdapter.slug, mockSourceAdapter],
]);

export function getSourceAdapter(sourceSlug?: string | null) {
  if (!sourceSlug) return mockSourceAdapter;
  return adapters.get(sourceSlug) ?? mockSourceAdapter;
}

export type {
  NormalizedListing,
  SearchInput,
  SourceAdapter,
} from "@/lib/source-adapters/types";
