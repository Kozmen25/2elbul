/**
 * @deprecated Use lib/unified-source-engine/adapters/getmobil-unified.ts instead.
 * 
 * This module provides a legacy StandardSourceAdapter implementation for GetMobil.
 * It exists for backward compatibility during the migration to Unified Source Engine.
 * 
 * New code should use the Unified Source Engine pattern directly.
 * 
 * Timeline: Deprecate in Sprint 0.4, remove in Sprint 0.5+
 */

import {
  createStandardAdapterResult,
  normalizeBotListingToStandard,
  type StandardAdapterResult,
  type StandardNormalizedListing,
  type StandardSourceAdapter,
} from "./types";
import type { BotAdapterListing, SourceIntegrationConfig } from "@/lib/bots/types";

export type GetmobilStandardAdapterOptions = {
  fetchListings?: (categoryUrl: string, limit: number) => Promise<BotAdapterListing[]>;
  healthCheck?: () => Promise<boolean>;
};

export const GETMOBIL_STANDARD_DEFAULT_URL =
  "https://getmobil.com/satin-al/cep-telefonu/";

export function createGetmobilStandardAdapter(
  config: SourceIntegrationConfig,
  options: GetmobilStandardAdapterOptions = {},
): StandardSourceAdapter {
  const fetchListings = options.fetchListings ?? defaultFetchGetmobilListings;
  const categoryUrl = config.scrapeUrl || GETMOBIL_STANDARD_DEFAULT_URL;
  const limit = Math.min(Math.max(config.productLimit || 10, 1), 100);

  async function loadAndNormalize(
    query?: string,
    requestedLimit = limit,
  ): Promise<StandardAdapterResult> {
    const startedAt = Date.now();

    try {
      const rawListings = await fetchListings(categoryUrl, requestedLimit);
      const filteredListings = query
        ? rawListings.filter((listing) => listingMatchesQuery(listing, query))
        : rawListings;
      const normalizedListings = filteredListings
        .map((listing) => normalizeGetmobilListing(listing, config))
        .filter(
          (listing): listing is StandardNormalizedListing => listing !== null,
        );

      return createStandardAdapterResult({
        listings: normalizedListings,
        found: rawListings.length,
        skipped: filteredListings.length - normalizedListings.length,
        startedAt,
      });
    } catch (error) {
      return createStandardAdapterResult({
        errors: [getErrorMessage(error)],
        duration_ms: Math.max(0, Date.now() - startedAt),
      });
    }
  }

  return {
    sourceId: config.sourceId,
    sourceName: config.sourceName || "Getmobil",
    enabled: true,
    search(input) {
      return loadAndNormalize(input.query, input.limit);
    },
    sync() {
      return loadAndNormalize(undefined, limit);
    },
    normalizeListing(raw) {
      return normalizeGetmobilListing(raw as BotAdapterListing, config);
    },
    async healthCheck() {
      try {
        if (options.healthCheck) {
          const ok = await options.healthCheck();
          return {
            ok,
            message: ok ? null : "Getmobil health check basarisiz oldu.",
          };
        }

        const result = await loadAndNormalize(undefined, 1);
        return {
          ok: result.errors.length === 0,
          message: result.errors[0] ?? null,
        };
      } catch (error) {
        return {
          ok: false,
          message: getErrorMessage(error),
        };
      }
    },
  };
}

export function normalizeGetmobilListing(
  listing: BotAdapterListing,
  config: Pick<SourceIntegrationConfig, "sourceId" | "sourceName">,
) {
  return normalizeBotListingToStandard(
    {
      ...listing,
      source: listing.source || config.sourceName || "Getmobil",
      condition: listing.condition || "Yenilenmiş",
      city: listing.city || "Türkiye",
    },
    {
      sourceId: config.sourceId,
      sourceName: config.sourceName || "Getmobil",
    },
  );
}

async function defaultFetchGetmobilListings(categoryUrl: string, limit: number) {
  const { fetchGetmobilListings } = await import("@/lib/bots/adapters/getmobil");
  return fetchGetmobilListings(categoryUrl, limit);
}

function listingMatchesQuery(listing: BotAdapterListing, query: string) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return true;
  const haystack = normalizeText(
    [
      listing.product_name,
      listing.title,
      listing.brand,
      listing.model,
      listing.category,
    ]
      .filter(Boolean)
      .join(" "),
  );
  return normalizedQuery
    .split(" ")
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}

function normalizeText(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "Getmobil adapter bilinmeyen hata verdi.";
}
