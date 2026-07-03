import { describe, expect, it } from "vitest";
import {
  createStandardAdapterResult,
  createStandardSourceAdapter,
  normalizeBotListingToStandard,
} from "./types";
import type { BotAdapterListing, SourceIntegrationConfig } from "@/lib/bots/types";

const config: SourceIntegrationConfig = {
  sourceId: 7,
  sourceName: "Test Kaynağı",
  sourceSlug: "test-kaynagi",
  apiUrl: null,
  scrapeUrl: "https://example.com",
  cronEnabled: true,
  cronSchedule: "daily",
  productLimit: 10,
};

function listing(overrides: Partial<BotAdapterListing> = {}): BotAdapterListing {
  return {
    external_id: "abc-1",
    product_name: "iPhone 13",
    title: "iPhone 13 128 GB Yenilenmiş",
    price: 22000,
    city: "Türkiye",
    source: "Test Kaynağı",
    url: "https://example.com/iphone-13",
    condition: "Yenilenmiş",
    image_url: "https://example.com/image.jpg",
    image_urls: ["https://example.com/image.jpg"],
    status: "pending",
    ...overrides,
  };
}

describe("source adapter standard", () => {
  it("normalizes valid listing data", () => {
    const normalized = normalizeBotListingToStandard(listing(), {
      sourceId: config.sourceId,
      sourceName: config.sourceName,
      listedAt: "2026-07-03T10:00:00.000Z",
    });

    expect(normalized).toMatchObject({
      external_id: "abc-1",
      title: "iPhone 13 128 GB Yenilenmiş",
      price: 22000,
      currency: "TRY",
      source_id: 7,
      source_name: "Test Kaynağı",
      location: "Türkiye",
      condition: "Yenilenmiş",
    });
  });

  it("skips listings without a valid price", async () => {
    const adapter = createStandardSourceAdapter({
      config,
      enabled: true,
      fetchListings: async () => [listing(), listing({ price: 0 })],
    });

    const result = await adapter.sync();

    expect(result.found).toBe(2);
    expect(result.listings).toHaveLength(1);
    expect(result.skipped).toBe(1);
  });

  it("creates adapter result metrics consistently", () => {
    const result = createStandardAdapterResult({
      listings: [listing()],
      imported: 2,
      updated: 1,
      skipped: 3,
      matched_product_count: 4,
      errors: ["örnek hata"],
      duration_ms: 25,
    });

    expect(result).toMatchObject({
      found: 1,
      imported: 2,
      updated: 1,
      skipped: 3,
      matched_product_count: 4,
      errors: ["örnek hata"],
      duration_ms: 25,
    });
  });

  it("returns standard source adapter sync result", async () => {
    const adapter = createStandardSourceAdapter({
      config,
      enabled: true,
      fetchListings: async () => [listing({ external_id: "abc-2" })],
    });

    const result = await adapter.sync();

    expect(result.found).toBe(1);
    expect(result.imported).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.matched_product_count).toBe(0);
    expect(result.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it("fills errors when search is not implemented", async () => {
    const adapter = createStandardSourceAdapter({
      config,
      enabled: true,
      fetchListings: async () => [],
    });

    const result = await adapter.search({ query: "iphone" });

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.found).toBe(0);
  });
});
