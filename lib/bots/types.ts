import type { HtmlRootLike } from "@/lib/bots/html-utils";

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
  external_id?: string;
  product_name: string;
  title: string;
  price: number;
  old_price?: number | null;
  city: string;
  source: string;
  url: string;
  condition: string;
  description?: string | null;
  image_url: string | null;
  image_urls: string[];
  brand?: string | null;
  model?: string | null;
  storage?: string | null;
  ram?: string | null;
  color?: string | null;
  warranty?: string | null;
  seller_name?: string | null;
  source_type?: string | null;
  category?: string | null;
  status: "pending" | "published" | "active" | "inactive";
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
