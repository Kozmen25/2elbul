import { describe, expect, it } from "vitest";
import {
  createEasyCepStandardAdapter,
  normalizeEasyCepListing,
} from "./easycep-adapter";
import type { BotAdapterListing, SourceIntegrationConfig } from "@/lib/bots/types";

const config: SourceIntegrationConfig = {
  sourceId: 1,
  sourceName: "EasyCep",
  sourceSlug: "easycep",
  apiUrl: null,
  scrapeUrl: "https://easycep.com/kategori/cep-telefonu-1",
  cronEnabled: true,
  cronSchedule: "daily",
  productLimit: 10,
};

function listing(overrides: Partial<BotAdapterListing> = {}): BotAdapterListing {
  return {
    external_id: "easycep-iphone-13",
    product_name: "iPhone 13",
    title: "Yenilenmiş iPhone 13 128 GB",
    price: 22999,
    city: "Türkiye",
    source: "EasyCep",
    url: "https://easycep.com/iphone-13",
    condition: "Yenilenmiş",
    image_url: "https://cdn.easycep.com/iphone-13.jpg",
    image_urls: ["https://cdn.easycep.com/iphone-13.jpg"],
    status: "pending",
    ...overrides,
  };
}

describe("EasyCep standard adapter", () => {
  it("normalizes valid raw data", () => {
    const normalized = normalizeEasyCepListing(listing(), config);

    expect(normalized).toMatchObject({
      external_id: "easycep-iphone-13",
      title: "Yenilenmiş iPhone 13 128 GB",
      price: 22999,
      currency: "TRY",
      url: "https://easycep.com/iphone-13",
      source_id: 1,
      source_name: "EasyCep",
      location: "Türkiye",
      condition: "Yenilenmiş",
    });
  });

  it("skips listings without valid price", async () => {
    const adapter = createEasyCepStandardAdapter(config, {
      fetchListings: async () => [listing(), listing({ price: 0 })],
    });

    const result = await adapter.sync();

    expect(result.found).toBe(2);
    expect(result.listings).toHaveLength(1);
    expect(result.skipped).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it("skips listings without url", async () => {
    const adapter = createEasyCepStandardAdapter(config, {
      fetchListings: async () => [listing(), listing({ url: "" })],
    });

    const result = await adapter.sync();

    expect(result.found).toBe(2);
    expect(result.listings).toHaveLength(1);
    expect(result.skipped).toBe(1);
  });

  it("returns safe health check error when source fails", async () => {
    const adapter = createEasyCepStandardAdapter(config, {
      fetchListings: async () => {
        throw new Error("Kaynak erişilemedi");
      },
    });

    const health = await adapter.healthCheck();
    const result = await adapter.sync();

    expect(health.ok).toBe(false);
    expect(health.message).toContain("Kaynak erişilemedi");
    expect(result.errors[0]).toContain("Kaynak erişilemedi");
  });

  it("returns standard result and filters search query", async () => {
    const adapter = createEasyCepStandardAdapter(config, {
      fetchListings: async () => [
        listing({ title: "Yenilenmiş iPhone 13 128 GB" }),
        listing({
          external_id: "easycep-samsung",
          product_name: "Samsung S23",
          title: "Yenilenmiş Samsung S23",
          url: "https://easycep.com/samsung-s23",
        }),
      ],
    });

    const result = await adapter.search({ query: "iphone 13", limit: 10 });

    expect(result.found).toBe(2);
    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]?.title).toContain("iPhone 13");
    expect(result.duration_ms).toBeGreaterThanOrEqual(0);
  });
});
