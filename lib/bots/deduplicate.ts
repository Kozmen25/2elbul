import type { BotAdapterListing } from "./types";

export function deduplicateByUrl(listings: BotAdapterListing[]) {
  return [...new Map(listings.map((listing) => [listing.url, listing])).values()];
}
