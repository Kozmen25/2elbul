/**
 * @deprecated This module is part of the legacy source adapter system.
 * Use lib/unified-source-engine/types.ts instead.
 * 
 * This file contains the old SourceAdapter interface and related types.
 * These are being replaced by UnifiedSourceAdapter and the Unified Source Engine.
 * 
 * The NormalizedListing type here is also deprecated - use the version from
 * lib/unified-source-engine/types.ts which has a proper schema with sourceId, sourceName, location, listedAt.
 * 
 * Timeline: Deprecated in Sprint 0.4, remove in Sprint 0.5+
 */

export type SearchInput = {
  query: string;
  normalizedQuery: string;
  sourceId: number | null;
  sourceName: string;
  sourceSlug: string;
  limit?: number;
};

export type NormalizedListing = {
  externalId: string;
  title: string;
  price: number;
  url: string;
  imageUrl: string | null;
  city: string | null;
  sourceName: string;
  category: string | null;
  brand: string | null;
  model: string | null;
  rawData: Record<string, unknown> | null;
};

/**
 * @deprecated Use UnifiedSourceAdapter from lib/unified-source-engine instead.
 * 
 * Old search interface replaced by unified pipeline: fetch → normalize → validate → match → persist
 */
export interface SourceAdapter {
  slug: string;
  search(input: SearchInput): Promise<NormalizedListing[]>;
}
