import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  NormalizedListing,
  UnifiedSourceAdapter,
  SourceAdapterOptions,
  SourceAdapterFetch,
  ValidationResult,
  MatchingResult,
} from "./types";
import {
  validateListing,
  executePipeline,
  createEmptyMatchingResult,
} from "./pipeline";

export interface SimpleAdapterConfig {
  fetch: SourceAdapterFetch;
  normalize: (raw: unknown) => NormalizedListing | null;
  validate?: (listing: NormalizedListing) => ValidationResult;
  match?: (
    listing: NormalizedListing,
    supabase: SupabaseClient,
  ) => Promise<MatchingResult>;
  persist?: (
    listing: NormalizedListing,
    matchResult: MatchingResult,
    supabase: SupabaseClient,
  ) => Promise<boolean>;
  healthCheck?: () => Promise<{ ok: boolean; message: string | null }>;
}

export function createSourceAdapter(
  options: SourceAdapterOptions,
  config: SimpleAdapterConfig,
  supabase: SupabaseClient,
): UnifiedSourceAdapter {
  return {
    sourceId: options.sourceId,
    sourceName: options.sourceName,
    sourceSlug: options.sourceSlug,

    async fetch(fetchOptions) {
      return config.fetch(fetchOptions);
    },

    normalize(raw) {
      return config.normalize(raw);
    },

    validate(listing) {
      if (config.validate) {
        return config.validate(listing);
      }
      return validateListing(listing);
    },

    async match(listing) {
      if (!config.match) {
        return createEmptyMatchingResult();
      }
      return config.match(listing, supabase);
    },

    async persist(listing, matchResult) {
      if (!config.persist) {
        return false;
      }
      const result = await executePipeline(
        `persist-${options.sourceSlug}`,
        () => config.persist!(listing, matchResult, supabase),
      );
      return result.result ?? false;
    },

    async healthCheck() {
      if (config.healthCheck) {
        return config.healthCheck();
      }
      return { ok: true, message: null };
    },
  };
}
