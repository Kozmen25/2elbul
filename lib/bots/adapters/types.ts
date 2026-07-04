/**
 * @deprecated This module defines the legacy StandardSourceAdapter system.
 * Use lib/unified-source-engine/types.ts instead.
 * 
 * The StandardSourceAdapter and related types are being phased out in favor of the
 * UnifiedSourceAdapter pattern from the new Unified Source Engine.
 * 
 * Components in this file:
 * - StandardSourceAdapter: Old adapter interface (deprecated, use UnifiedSourceAdapter)
 * - StandardNormalizedListing: Legacy normalized type (use Unified NormalizedListing)
 * - Helper functions: createStandardSourceAdapter, normalizeBotListingToStandard, etc.
 * 
 * These are kept for backward compatibility during migration. Will be removed in Sprint 0.5+
 */

import type { BotAdapterListing, SourceIntegrationConfig } from "@/lib/bots/types";

export type StandardAdapterHealth = {
  ok: boolean;
  message: string | null;
};

export type StandardAdapterSearchInput = {
  query: string;
  limit?: number;
};

export type StandardNormalizedListing = {
  external_id: string;
  title: string;
  price: number;
  currency: "TRY";
  url: string;
  image_url: string | null;
  source_id: number;
  source_name: string;
  location: string | null;
  condition: string;
  listed_at: string | null;
  raw_payload: Record<string, unknown> | null;
};

export type StandardAdapterRunMetrics = {
  found: number;
  imported: number;
  updated: number;
  skipped: number;
  matched_product_count: number;
  errors: string[];
  duration_ms: number;
};

export type StandardAdapterResult<TListing = StandardNormalizedListing> =
  StandardAdapterRunMetrics & {
    listings: TListing[];
  };

/**
 * @deprecated Use UnifiedSourceAdapter from lib/unified-source-engine/types.ts
 * 
 * Legacy adapter interface. The new system uses UnifiedSourceAdapter which provides:
 * - fetch() for raw data acquisition
 * - normalize() for data transformation
 * - validate() for validation with confidence scoring
 * - match() for product matching
 * - persist() for database persistence
 * 
 * This interface will be removed after full migration to Unified Source Engine.
 */
export interface StandardSourceAdapter {
  sourceId: number;
  sourceName: string;
  enabled: boolean;
  search(input: StandardAdapterSearchInput): Promise<StandardAdapterResult>;
  sync(): Promise<StandardAdapterResult>;
  normalizeListing(raw: unknown): StandardNormalizedListing | null;
  healthCheck(): Promise<StandardAdapterHealth>;
}

export function normalizeBotListingToStandard(
  listing: BotAdapterListing,
  context: {
    sourceId: number;
    sourceName: string;
    listedAt?: string | null;
  },
): StandardNormalizedListing | null {
  const price = Number(listing.price);
  if (!Number.isFinite(price) || price <= 0) return null;
  if (!listing.title?.trim() || !listing.url?.trim()) return null;

  return {
    external_id: listing.external_id || createExternalIdFromUrl(listing.url),
    title: listing.title.trim(),
    price: Math.round(price),
    currency: "TRY",
    url: listing.url.trim(),
    image_url: listing.image_url ?? listing.image_urls?.[0] ?? null,
    source_id: context.sourceId,
    source_name: listing.source || context.sourceName,
    location: listing.city || null,
    condition: listing.condition || "İkinci El",
    listed_at: context.listedAt ?? null,
    raw_payload: { ...listing },
  };
}

export function createStandardAdapterResult<TListing>(
  input: Partial<StandardAdapterRunMetrics> & {
    listings?: TListing[];
    startedAt?: number;
  } = {},
): StandardAdapterResult<TListing> {
  const durationMs =
    typeof input.duration_ms === "number"
      ? input.duration_ms
      : input.startedAt
        ? Math.max(0, Date.now() - input.startedAt)
        : 0;

  return {
    listings: input.listings ?? [],
    found: input.found ?? input.listings?.length ?? 0,
    imported: input.imported ?? 0,
    updated: input.updated ?? 0,
    skipped: input.skipped ?? 0,
    matched_product_count: input.matched_product_count ?? 0,
    errors: input.errors ?? [],
    duration_ms: durationMs,
  };
}

export function createStandardSourceAdapter(options: {
  config: SourceIntegrationConfig;
  enabled: boolean;
  fetchListings: () => Promise<BotAdapterListing[]>;
}): StandardSourceAdapter {
  const { config, enabled, fetchListings } = options;

  return {
    sourceId: config.sourceId,
    sourceName: config.sourceName,
    enabled,
    async search() {
      return createStandardAdapterResult({
        errors: ["Bu kaynak için standart search akışı henüz uygulanmadı."],
      });
    },
    async sync() {
      const startedAt = Date.now();
      const listings = await fetchListings();
      const normalizedListings = listings
        .map((listing) =>
          normalizeBotListingToStandard(listing, {
            sourceId: config.sourceId,
            sourceName: config.sourceName,
          }),
        )
        .filter(
          (listing): listing is StandardNormalizedListing => listing !== null,
        );

      return createStandardAdapterResult({
        listings: normalizedListings,
        found: listings.length,
        skipped: listings.length - normalizedListings.length,
        startedAt,
      });
    },
    normalizeListing(raw) {
      return normalizeBotListingToStandard(raw as BotAdapterListing, {
        sourceId: config.sourceId,
        sourceName: config.sourceName,
      });
    },
    async healthCheck() {
      return {
        ok: enabled,
        message: enabled ? null : "Kaynak pasif veya adapter desteklenmiyor.",
      };
    },
  };
}

function createExternalIdFromUrl(url: string) {
  return url
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}
