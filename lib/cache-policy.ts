import { revalidateTag } from "next/cache";

// One place for cache lifetimes and tags. Data cached with these tags is
// shared across requests, so admin saves must call invalidateCacheTag().

export const CACHE_TAGS = {
  categories: "categories",
  siteSettings: "site-settings",
  aiSettings: "ai-settings",
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

export const CACHE_SECONDS = {
  /** Site name, maintenance flag, header selection: small rows, edited rarely. */
  siteSettings: 60,
  /** Category tree and per-category counts: expensive to compute, change slowly. */
  catalog: 300,
  /** ISR lifetime of public pages that have no per-user content. */
  publicPage: 300,
} as const;

/** Expires every cache entry carrying `tag` immediately (not stale-while-revalidate). */
export function invalidateCacheTag(tag: CacheTag) {
  revalidateTag(tag, { expire: 0 });
}
