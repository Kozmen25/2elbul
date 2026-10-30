import type { SourceRegistry } from "@/lib/source-registry";

// Holder for the source registry built by initializeSourceAdapters().
// Kept apart from the adapters module so pure scoring code (duplicate engine,
// also bundled for the browser) can read it without importing the scrapers.

let canonicalSourceRegistry: SourceRegistry | null = null;

export function setCanonicalSourceRegistry(registry: SourceRegistry | null) {
  canonicalSourceRegistry = registry;
}

export function getCanonicalSourceRegistry(): SourceRegistry | null {
  return canonicalSourceRegistry;
}
