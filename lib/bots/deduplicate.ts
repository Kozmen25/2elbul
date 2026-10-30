import type { BotAdapterListing } from "./types";
import { normalizeListingUrl } from "@/lib/listing-submission/url";

/**
 * The same page reached through different tracking links
 * (?utm_source=..., #photos, WWW. in the host) is one listing. Used only to
 * compare listings inside one scrape: the stored url and external id are not
 * rewritten, so listings that are already stored keep their identity.
 */
function urlKey(url: string): string {
  const normalized = normalizeListingUrl(url);
  return normalized.ok ? normalized.url : url;
}

/** Keeps the first listing of each page; later copies of the same page are dropped. */
export function deduplicateByUrl(listings: BotAdapterListing[]) {
  const unique = new Map<string, BotAdapterListing>();
  for (const listing of listings) {
    const key = urlKey(listing.url);
    // Same as before for plain urls: a later duplicate replaces the earlier entry's data.
    unique.set(key, listing);
  }
  return [...unique.values()];
}
