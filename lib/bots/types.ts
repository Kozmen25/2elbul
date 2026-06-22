export type SourceIntegrationMode = "api" | "scrape";

export type SourceIntegrationConfig = {
  sourceId: number;
  sourceName: string;
  sourceSlug: string;
  apiUrl: string | null;
  scrapeUrl: string | null;
  cronEnabled: boolean;
  cronSchedule: string;
  productLimit: number;
};

export type BotAdapterListing = {
  product_name: string;
  title: string;
  price: number;
  city: string;
  source: string;
  url: string;
  condition: string;
  image_url: string | null;
  image_urls: string[];
  status: "pending" | "published";
};

export type SourceConnector = {
  slug: string;
  supportedModes: SourceIntegrationMode[];
  parseProductPage?: (
    root: HtmlRootLike,
    pageUrl: string,
  ) => BotAdapterListing;
  fetchListings: (
    config: SourceIntegrationConfig,
  ) => Promise<BotAdapterListing[]>;
};
import type { HtmlRootLike } from "@/lib/bots/html-utils";
