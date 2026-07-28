import type { SupabaseClient } from "@supabase/supabase-js";
import { getSourceRegistry, initializeSourceRegistry } from "../registry";
import { createGetmobilUnifiedAdapter } from "./getmobil-unified";
import { createEasyCepUnifiedAdapter } from "./easycep-unified";
import { SourceRegistryImpl } from "@/lib/source-registry";
import type { SourceRegistry } from "@/lib/source-registry";
import type { SourceAdapterOptions, UnifiedSourceAdapter } from "../types";

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

let canonicalSourceRegistry: SourceRegistry | null = null;

export async function initializeSourceAdapters(supabase: SupabaseClient) {
  const registry = initializeSourceRegistry();

  canonicalSourceRegistry = new SourceRegistryImpl();
  await canonicalSourceRegistry.initialize(supabase);

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

export function getCanonicalSourceRegistry(): SourceRegistry | null {
  return canonicalSourceRegistry;
}

export function getUnifiedSourceRegistry() {
  return getSourceRegistry();
}
