/**
 * @deprecated This module is part of the legacy SourceAdapter system.
 * Use lib/unified-source-engine/adapters/easycep-unified.ts instead.
 * 
 * This file is kept for backward compatibility. It implements the old SourceAdapter interface
 * which is being replaced by UnifiedSourceAdapter pattern in the new Unified Source Engine.
 * 
 * Timeline: Deprecated in Sprint 0.4, will be removed after migration completes
 */

import {
  EASYCEP_PHONE_CATEGORY_URL,
  fetchEasyCepListings,
} from "@/lib/bots/adapters/easycep";
import type {
  NormalizedListing,
  SearchInput,
  SourceAdapter,
} from "@/lib/source-adapters/types";

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; listings: NormalizedListing[] }>();

export const easyCepSourceAdapter: SourceAdapter = {
  slug: "easycep",
  async search(input) {
    const normalizedQuery = normalize(input.query || input.normalizedQuery);
    if (!normalizedQuery) return [];

    const cacheKey = normalizedQuery;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.listings.slice(0, input.limit ?? 3);
    }

    try {
      const rawListings = await fetchEasyCepListings(EASYCEP_PHONE_CATEGORY_URL, 60);
      const listings = rawListings
        .filter((listing) =>
          normalize(`${listing.product_name} ${listing.title}`).includes(
            normalizedQuery,
          ),
        )
        .slice(0, input.limit ?? 3)
        .map(
          (listing): NormalizedListing => ({
            externalId:
              listing.external_id ||
              deterministicExternalId("easycep", listing.url, listing.title),
            title: listing.title,
            price: Number(listing.price),
            url: listing.url,
            imageUrl: listing.image_url || "/products/placeholder.svg",
            city: listing.city || "Türkiye",
            sourceName: "EasyCep",
            category: listing.category ?? "Yenilenmiş cihaz",
            brand: listing.brand ?? null,
            model: listing.model ?? listing.product_name,
            rawData: {
              adapter: "easycep",
              sourceUrl: EASYCEP_PHONE_CATEGORY_URL,
              original: listing,
            },
          }),
        );

      cache.set(cacheKey, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        listings,
      });

      return listings;
    } catch (error) {
      console.error("EasyCep source adapter failed:", error);
      return [];
    }
  },
};

function normalize(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function deterministicExternalId(source: string, url: string, title: string) {
  return `${source}-${normalize(url || title).replace(/\s+/g, "-")}`.slice(0, 180);
}
