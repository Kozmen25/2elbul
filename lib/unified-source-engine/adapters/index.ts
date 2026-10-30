import type { SupabaseClient } from "@supabase/supabase-js";
import { getSourceRegistry, initializeSourceRegistry } from "../registry";
import { createGetmobilUnifiedAdapter } from "./getmobil-unified";
import { createEasyCepUnifiedAdapter } from "./easycep-unified";
import { SourceRegistryImpl } from "@/lib/source-registry";
import type { SourceAdapterOptions, UnifiedSourceAdapter } from "../types";
import { setCanonicalSourceRegistry } from "../canonical-registry";

export { getCanonicalSourceRegistry } from "../canonical-registry";

type UnifiedAdapterFactory = (
  options: SourceAdapterOptions,
  supabase: SupabaseClient,
) => UnifiedSourceAdapter;

const ADAPTER_FACTORIES: Record<string, UnifiedAdapterFactory> = {
  getmobil: (options, supabase) =>
    createGetmobilUnifiedAdapter(options, supabase),
  easycep: (options, supabase) =>
    createEasyCepUnifiedAdapter(options, supabase),
};

export async function initializeSourceAdapters(supabase: SupabaseClient) {
  const registry = initializeSourceRegistry();

  const canonicalSourceRegistry = new SourceRegistryImpl();
  await canonicalSourceRegistry.initialize(supabase);
  setCanonicalSourceRegistry(canonicalSourceRegistry);

  for (const source of canonicalSourceRegistry.getAllActive()) {
    const factory = ADAPTER_FACTORIES[source.sourceSlug];
    if (!factory) continue;

    const adapter = factory(
      {
        sourceId: source.sourceId,
        sourceName: source.sourceName,
        sourceSlug: source.sourceSlug,
      },
      supabase,
    );
    registry.register(adapter);
  }
}

export function getUnifiedSourceRegistry() {
  return getSourceRegistry();
}
