import type { SourceAdapter } from "@/lib/source-adapters/types";
import { easyCepSourceAdapter } from "@/lib/source-adapters/easycep-adapter";
import { getmobilSourceAdapter } from "@/lib/source-adapters/getmobil-adapter";
import { mockSourceAdapter } from "@/lib/source-adapters/mock-adapter";
import { getUnifiedSourceRegistry } from "@/lib/unified-source-engine/adapters";
import type { UnifiedSourceAdapter } from "@/lib/unified-source-engine";

const adapters = new Map<string, SourceAdapter>([
  [easyCepSourceAdapter.slug, easyCepSourceAdapter],
  [getmobilSourceAdapter.slug, getmobilSourceAdapter],
  [mockSourceAdapter.slug, mockSourceAdapter],
]);

export function getSourceAdapter(sourceSlug?: string | null) {
  if (!sourceSlug) return mockSourceAdapter;
  return adapters.get(sourceSlug) ?? mockSourceAdapter;
}

export function getInstantSearchAdapters(): UnifiedSourceAdapter[] {
  const registry = getUnifiedSourceRegistry();
  const unifiedAdapters = registry.getAll();

  if (unifiedAdapters.length > 0) {
    const adaptersToRun = unifiedAdapters.filter((adapter) =>
      ["easycep", "getmobil"].includes(adapter.sourceSlug),
    );
    if (adaptersToRun.length > 0) return adaptersToRun;
  }

  return [];
}

export function isMockFallbackEnabled() {
  return (
    process.env.ENABLE_MOCK_SEARCH_ADAPTER === "true" ||
    process.env.NODE_ENV !== "production"
  );
}

export type {
  NormalizedListing,
  SearchInput,
  SourceAdapter,
} from "@/lib/source-adapters/types";
