import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchGetmobilListings, GETMOBIL_CATEGORY_URLS } from "@/lib/bots/adapters/getmobil";
import { isBotAdapterListing } from "@/lib/bots/types";
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
  deriveBrand,
} from "../helpers";
import {
  validateListing,
  createNormalizedListing,
  createEmptyMatchingResult,
} from "../pipeline";

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; listings: NormalizedListing[] }>();

export function createGetmobilUnifiedAdapter(
  options: SourceAdapterOptions,
  _supabase: SupabaseClient,
): UnifiedSourceAdapter {
  return {
    sourceId: options.sourceId,
    sourceName: options.sourceName,
    sourceSlug: options.sourceSlug,

    async fetch({ limit = 100, query } = {}) {
      try {
        const allListings: import("@/lib/bots/types").BotAdapterListing[] = [];
        const perCategoryLimit = Math.max(Math.ceil(limit / Object.keys(GETMOBIL_CATEGORY_URLS).length), 1);

        for (const [categoryUrl] of Object.entries(GETMOBIL_CATEGORY_URLS)) {
          const listings = await fetchGetmobilListings(categoryUrl, perCategoryLimit);
          allListings.push(...listings);
        }

        if (query) {
          const normalized = normalizeSearchText(query);
          return allListings.filter((listing) =>
            normalizeSearchText(`${listing.product_name} ${listing.title}`).includes(
              normalized,
            ),
          );
        }
        return allListings.slice(0, limit);
      } catch (error) {
        console.error("Getmobil fetch error:", error);
        return [];
      }
    },

    normalize(raw): NormalizedListing | null {
      if (!isBotAdapterListing(raw)) {
        return null;
      }

      const listing = raw;

      return createNormalizedListing({
        externalId:
          listing.external_id ||
          createDeterministicExternalId("getmobil", listing.url, listing.title),
        title: listing.title,
        price: Number(listing.price),
        url: listing.url,
        imageUrl: listing.image_url || "/products/placeholder.svg",
        sourceId: options.sourceId,
        sourceName: options.sourceName,
        location: listing.city || "Türkiye",
        condition: listing.condition || "Yenilenmiş",
        listedAt: listing.listed_at || null,
        category: listing.category || undefined,
        rawData: {
          adapter: "getmobil",
          original: raw,
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
          message: result.length > 0 ? null : "Getmobil bağlantı kurulamadı",
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
