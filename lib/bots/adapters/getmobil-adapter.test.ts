import { describe, expect, it } from "vitest";
import {
  createGetmobilStandardAdapter,
  normalizeGetmobilListing,
} from "./getmobil-adapter";
import type { BotAdapterListing, SourceIntegrationConfig } from "@/lib/bots/types";

const config: SourceIntegrationConfig = {
  sourceId: 2,
  sourceName: "Getmobil",
  sourceSlug: "getmobil",
  apiUrl: null,
  scrapeUrl: "https://getmobil.com/satin-al/cep-telefonu/",
  cronEnabled: true,
  cronSchedule: "daily",
  productLimit: 10,
};

function listing(overrides: Partial<BotAdapterListing> = {}): BotAdapterListing {
  return {
    external_id: "getmobil-iphone-14",
    product_name: "iPhone 14",
    title: "Yenilenmiş iPhone 14 128 GB",
    price: 31999,
    city: "Türkiye",
    source: "Getmobil",
    url: "https://getmobil.com/satin-al/iphone-14",
    condition: "Yenilenmiş",
    image_url: "https://cdn.getmobil.com/iphone-14.jpg",
    image_urls: ["https://cdn.getmobil.com/iphone-14.jpg"],
    status: "pending",
    ...overrides,
  };
}

describe("Getmobil standard adapter", () => {
  it("normalizes valid raw data", () => {
    const normalized = normalizeGetmobilListing(listing(), config);

    expect(normalized).toMatchObject({
      external_id: "getmobil-iphone-14",
      title: "Yenilenmiş iPhone 14 128 GB",
      price: 31999,
      currency: "TRY",
      url: "https://getmobil.com/satin-al/iphone-14",
      source_id: 2,
      source_name: "Getmobil",
      location: "Türkiye",
      condition: "Yenilenmiş",
    });
  });

  it("skips listings without valid price", async () => {
    const adapter = createGetmobilStandardAdapter(config, {
      fetchListings: async () => [listing(), listing({ price: 0 })],
    });

    const result = await adapter.sync();

    expect(result.found).toBe(2);
    expect(result.listings).toHaveLength(1);
    expect(result.skipped).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it("skips listings without url", async () => {
    const adapter = createGetmobilStandardAdapter(config, {
      fetchListings: async () => [listing(), listing({ url: "" })],
    });

    const result = await adapter.sync();

    expect(result.found).toBe(2);
    expect(result.listings).toHaveLength(1);
    expect(result.skipped).toBe(1);
  });

  it("returns safe health check error when source fails", async () => {
    const adapter = createGetmobilStandardAdapter(config, {
      fetchListings: async () => {
        throw new Error("Getmobil erişilemedi");
      },
    });

    const health = await adapter.healthCheck();
    const result = await adapter.sync();

    expect(health.ok).toBe(false);
    expect(health.message).toContain("Getmobil erişilemedi");
    expect(result.errors[0]).toContain("Getmobil erişilemedi");
  });

  it("returns standard result and filters search query", async () => {
    const adapter = createGetmobilStandardAdapter(config, {
      fetchListings: async () => [
        listing({ title: "Yenilenmiş iPhone 14 128 GB" }),
        listing({
          external_id: "getmobil-samsung",
          product_name: "Samsung S24",
          title: "Yenilenmiş Samsung S24",
          url: "https://getmobil.com/satin-al/samsung-s24",
        }),
      ],
    });

    const result = await adapter.search({ query: "iphone 14", limit: 10 });

    expect(result.found).toBe(2);
    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]?.title).toContain("iPhone 14");
    expect(result.duration_ms).toBeGreaterThanOrEqual(0);
  });
});
