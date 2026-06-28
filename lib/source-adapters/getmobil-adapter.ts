import {
  fetchGetmobilListings,
  GETMOBIL_PHONE_CATEGORY_URL,
} from "@/lib/bots/adapters/getmobil";
import type {
  NormalizedListing,
  SourceAdapter,
} from "@/lib/source-adapters/types";

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; listings: NormalizedListing[] }>();

export const getmobilSourceAdapter: SourceAdapter = {
  slug: "getmobil",
  async search(input) {
    const normalizedQuery = normalize(input.query || input.normalizedQuery);
    if (!normalizedQuery) return [];

    const cacheKey = normalizedQuery;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.listings.slice(0, input.limit ?? 3);
    }

    try {
      const rawListings = await fetchGetmobilListings(
        GETMOBIL_PHONE_CATEGORY_URL,
        80,
      );
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
              deterministicExternalId("getmobil", listing.url, listing.title),
            title: listing.title,
            price: Number(listing.price),
            url: listing.url,
            imageUrl: listing.image_url || "/products/placeholder.svg",
            city: listing.city || "Türkiye",
            sourceName: "Getmobil",
            category: listing.category ?? "Yenilenmiş cihaz",
            brand: listing.brand ?? deriveBrand(listing.title),
            model: listing.model ?? listing.product_name,
            rawData: {
              adapter: "getmobil",
              sourceUrl: GETMOBIL_PHONE_CATEGORY_URL,
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
      console.error("Getmobil source adapter failed:", error);
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

function deriveBrand(title: string) {
  const normalizedTitle = normalize(title);
  if (normalizedTitle.includes("iphone") || normalizedTitle.includes("apple")) {
    return "Apple";
  }
  if (normalizedTitle.includes("samsung")) return "Samsung";
  if (normalizedTitle.includes("xiaomi")) return "Xiaomi";
  if (normalizedTitle.includes("huawei")) return "Huawei";
  if (normalizedTitle.includes("oppo")) return "Oppo";
  if (normalizedTitle.includes("realme")) return "Realme";
  return null;
}
