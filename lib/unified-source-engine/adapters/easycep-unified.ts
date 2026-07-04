import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchEasyCepListings,
  EASYCEP_PHONE_CATEGORY_URL,
} from "@/lib/bots/adapters/easycep";
import type {
  NormalizedListing,
  UnifiedSourceAdapter,
  SourceAdapterOptions,
  ValidationResult,
  MatchingResult,
} from "../types";
import {
  normalizeSearchText,
  createDeterministicExternalId,
} from "../helpers";
import {
  validateListing,
  createNormalizedListing,
  createEmptyMatchingResult,
} from "../pipeline";

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; listings: NormalizedListing[] }>();

export function createEasyCepUnifiedAdapter(
  options: SourceAdapterOptions,
  _supabase: SupabaseClient,
): UnifiedSourceAdapter {
  return {
    sourceId: options.sourceId,
    sourceName: options.sourceName,
    sourceSlug: options.sourceSlug,

    async fetch({ limit = 60, query } = {}) {
      try {
        const listings = await fetchEasyCepListings(EASYCEP_PHONE_CATEGORY_URL, limit);
        if (query) {
          const normalized = normalizeSearchText(query);
          return listings.filter((listing) =>
            normalizeSearchText(`${listing.product_name} ${listing.title}`).includes(
              normalized,
            ),
          );
        }
        return listings;
      } catch (error) {
        console.error("EasyCep fetch error:", error);
        return [];
      }
    },

    normalize(raw): NormalizedListing | null {
      const listing = raw as any;
      if (!listing?.title || !listing?.url || !listing?.price) {
        return null;
      }

      return createNormalizedListing({
        externalId:
          listing.external_id ||
          createDeterministicExternalId("easycep", listing.url, listing.title),
        title: listing.title,
        price: Number(listing.price),
        url: listing.url,
        imageUrl: listing.image_url || "/products/placeholder.svg",
        sourceId: options.sourceId,
        sourceName: options.sourceName,
        location: listing.city || "Türkiye",
        condition: listing.condition || "Yenilenmiş",
        listedAt: listing.listed_at || null,
        rawData: {
          adapter: "easycep",
          original: listing,
        },
      });
    },

    validate(listing): ValidationResult {
      return validateListing(listing);
    },

    async match(_listing): Promise<MatchingResult> {
      return createEmptyMatchingResult();
    },

    async persist(_listing, _matchResult): Promise<boolean> {
      return false;
    },

    async healthCheck() {
      try {
        const result = await this.fetch({ limit: 1 });
        return {
          ok: result.length > 0,
          message: result.length > 0 ? null : "EasyCep bağlantı kurulamadı",
        };
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : "Health check error",
        };
      }
    },
  };
}
