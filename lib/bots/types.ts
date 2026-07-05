import type { HtmlRootLike } from "@/lib/bots/html-utils";
import { isRecord } from "@/lib/records";

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
  listed_at?: string | null;
  status: "pending" | "published" | "active" | "inactive";
  raw_payload?: Record<string, unknown> | null;
};

export function isBotAdapterListing(value: unknown): value is BotAdapterListing {
  if (!isRecord(value)) return false;

  return (
    typeof value.product_name === "string" &&
    typeof value.title === "string" &&
    typeof value.price === "number" &&
    Number.isFinite(value.price) &&
    typeof value.city === "string" &&
    typeof value.source === "string" &&
    typeof value.url === "string" &&
    typeof value.condition === "string" &&
    (value.image_url === null || typeof value.image_url === "string") &&
    (value.listed_at === undefined ||
      value.listed_at === null ||
      typeof value.listed_at === "string") &&
    Array.isArray(value.image_urls) &&
    value.image_urls.every((item) => typeof item === "string") &&
    (value.status === "pending" ||
      value.status === "published" ||
      value.status === "active" ||
      value.status === "inactive")
  );
}

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
