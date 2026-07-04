import type { SupabaseClient } from "@supabase/supabase-js";
import { getSourceRegistry, initializeSourceRegistry } from "../registry";
import { createGetmobilUnifiedAdapter } from "./getmobil-unified";
import { createEasyCepUnifiedAdapter } from "./easycep-unified";

export async function initializeSourceAdapters(supabase: SupabaseClient) {
  const registry = initializeSourceRegistry();

  const getmobilAdapter = createGetmobilUnifiedAdapter(
    {
      sourceId: 3,
      sourceName: "Getmobil",
      sourceSlug: "getmobil",
    },
    supabase,
  );
  registry.register(getmobilAdapter);

  const easycepAdapter = createEasyCepUnifiedAdapter(
    {
      sourceId: 1,
      sourceName: "EasyCep",
      sourceSlug: "easycep",
    },
    supabase,
  );
  registry.register(easycepAdapter);
}

export function getUnifiedSourceRegistry() {
  return getSourceRegistry();
}
