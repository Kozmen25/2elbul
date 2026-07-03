import "server-only";

import {
  EASYCEP_PHONE_CATEGORY_URL,
  fetchEasyCepListings,
  fetchGetmobilListings,
  fetchHepsiburadaRenewedListings,
  fetchMediaMarktRenewedListings,
  fetchTeknosaRenewedListings,
  fetchYenilenmisMarketListings,
  GETMOBIL_PHONE_CATEGORY_URL,
  HEPSIBURADA_RENEWED_CATEGORY_URL,
  MEDIAMARKT_RENEWED_CATEGORY_URL,
  TEKNOSA_RENEWED_CATEGORY_URL,
  YENILENMIS_MARKET_CATEGORY_URL,
} from "@/lib/bots/adapters";
import { parseEasyCepProductPage } from "@/lib/bots/adapters/easycep";
import { createEasyCepStandardAdapter } from "@/lib/bots/adapters/easycep-adapter";
import { parseGetmobilProductPage } from "@/lib/bots/adapters/getmobil";
import { createGetmobilStandardAdapter } from "@/lib/bots/adapters/getmobil-adapter";
import { createStandardSourceAdapter } from "@/lib/bots/adapters/types";
import type {
  BotAdapterListing,
  SourceConnector,
  SourceIntegrationConfig,
} from "@/lib/bots/types";

const SCRAPE_FETCHERS: Record<
  string,
  (scrapeUrl: string, limit: number) => Promise<BotAdapterListing[]>
> = {
  easycep: (scrapeUrl, limit) =>
    fetchEasyCepListings(scrapeUrl || EASYCEP_PHONE_CATEGORY_URL, limit),
  getmobil: (scrapeUrl, limit) =>
    fetchGetmobilListings(scrapeUrl || GETMOBIL_PHONE_CATEGORY_URL, limit),
  "hepsiburada-yenilenmis": (scrapeUrl, limit) =>
    fetchHepsiburadaRenewedListings(
      scrapeUrl || HEPSIBURADA_RENEWED_CATEGORY_URL,
      limit,
    ),
  "teknosa-yenilenmis": (scrapeUrl, limit) =>
    fetchTeknosaRenewedListings(scrapeUrl || TEKNOSA_RENEWED_CATEGORY_URL, limit),
  "mediamarkt-yenilenmis": (scrapeUrl, limit) =>
    fetchMediaMarktRenewedListings(
      scrapeUrl || MEDIAMARKT_RENEWED_CATEGORY_URL,
      limit,
    ),
  "yenilenmis-market": (scrapeUrl, limit) =>
    fetchYenilenmisMarketListings(
      scrapeUrl || YENILENMIS_MARKET_CATEGORY_URL,
      limit,
    ),
};

export const SCRAPE_READY_SLUGS = Object.keys(SCRAPE_FETCHERS);

export function getSourceConnector(
  config: SourceIntegrationConfig,
): SourceConnector {
  const supportedModes = [
    ...(config.apiUrl ? (["api"] as const) : []),
    ...(config.scrapeUrl || SCRAPE_FETCHERS[config.sourceSlug]
      ? (["scrape"] as const)
      : []),
  ];

  return {
    slug: config.sourceSlug,
    supportedModes,
    parseProductPage:
      config.sourceSlug === "easycep"
        ? parseEasyCepProductPage
        : config.sourceSlug === "getmobil"
          ? parseGetmobilProductPage
          : undefined,
    async fetchListings(integrationConfig) {
      const scrapeFetcher = SCRAPE_FETCHERS[integrationConfig.sourceSlug];
      if (scrapeFetcher) {
        const scrapeUrl =
          integrationConfig.scrapeUrl ||
          defaultScrapeUrl(integrationConfig.sourceSlug);
        return scrapeFetcher(scrapeUrl, integrationConfig.productLimit);
      }

      if (integrationConfig.apiUrl) {
        throw new Error(
          `${integrationConfig.sourceName} için API entegrasyonu henüz uygulanmadı. İlanları POST /api/import/listings üzerinden aktarın.`,
        );
      }

      throw new Error(
        `${integrationConfig.sourceName} için scrape veya API adresi tanımlanmalı.`,
      );
    },
  };
}

export function getStandardSourceAdapter(config: SourceIntegrationConfig) {
  if (config.sourceSlug === "easycep") {
    return createEasyCepStandardAdapter(config);
  }
  if (config.sourceSlug === "getmobil") {
    return createGetmobilStandardAdapter(config);
  }

  const connector = getSourceConnector(config);
  return createStandardSourceAdapter({
    config,
    enabled: connector.supportedModes.includes("scrape"),
    fetchListings: () => connector.fetchListings(config),
  });
}

export async function fetchListingsForSource(
  slug: string,
  scrapeUrl: string | null | undefined,
  limit: number,
) {
  const fetcher = SCRAPE_FETCHERS[slug];
  if (!fetcher) {
    throw new Error("Bu kaynak için gerçek adapter hazır değil.");
  }
  return fetcher(scrapeUrl || defaultScrapeUrl(slug), limit);
}

function defaultScrapeUrl(slug: string) {
  const defaults: Record<string, string> = {
    easycep: EASYCEP_PHONE_CATEGORY_URL,
    getmobil: GETMOBIL_PHONE_CATEGORY_URL,
    "hepsiburada-yenilenmis": HEPSIBURADA_RENEWED_CATEGORY_URL,
    "teknosa-yenilenmis": TEKNOSA_RENEWED_CATEGORY_URL,
    "mediamarkt-yenilenmis": MEDIAMARKT_RENEWED_CATEGORY_URL,
    "yenilenmis-market": YENILENMIS_MARKET_CATEGORY_URL,
  };
  return defaults[slug] ?? "";
}
