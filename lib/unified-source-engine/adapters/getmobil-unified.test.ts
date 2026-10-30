import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { BotAdapterListing } from "@/lib/bots/types";

vi.mock("@/lib/bots/adapters/getmobil", async () => {
  const actual = await vi.importActual<typeof import("@/lib/bots/adapters/getmobil")>(
    "@/lib/bots/adapters/getmobil",
  );
  return {
    ...actual,
    fetchGetmobilListings: vi.fn(),
  };
});

import { fetchGetmobilListings, GETMOBIL_CATEGORY_URLS } from "@/lib/bots/adapters/getmobil";
import { CircuitBreakerRegistry } from "@/lib/recovery";
import { createGetmobilUnifiedAdapter } from "./getmobil-unified";

function makeListing(title: string): BotAdapterListing {
  return {
    product_name: title,
    title,
    price: 100,
    city: "İstanbul",
    source: "getmobil",
    url: `https://getmobil.com/${title}`,
    condition: "Yenilenmiş",
    image_url: null,
    image_urls: [],
    status: "active",
  };
}

describe("createGetmobilUnifiedAdapter.fetch", () => {
  beforeEach(() => {
    CircuitBreakerRegistry.resetInstance();
    vi.mocked(fetchGetmobilListings).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("isolates a failing category instead of discarding results from the others", async () => {
    const categoryUrls = Object.keys(GETMOBIL_CATEGORY_URLS);
    vi.mocked(fetchGetmobilListings).mockImplementation(async (categoryUrl) => {
      if (categoryUrl === categoryUrls[0]) {
        throw new Error("category unavailable");
      }
      return [makeListing(`ok-${categoryUrl}`)];
    });

    const adapter = createGetmobilUnifiedAdapter(
      { sourceId: 1, sourceName: "Getmobil", sourceSlug: "getmobil" },
      {} as never,
    );

    const result = await adapter.fetch({ limit: 40 });

    expect(result.length).toBe(categoryUrls.length - 1);
    expect(fetchGetmobilListings).toHaveBeenCalledTimes(categoryUrls.length);
  });

  it("records circuit breaker failures for a failing category", async () => {
    const categoryUrls = Object.keys(GETMOBIL_CATEGORY_URLS);
    vi.mocked(fetchGetmobilListings).mockRejectedValue(new Error("boom"));

    const adapter = createGetmobilUnifiedAdapter(
      { sourceId: 1, sourceName: "Getmobil", sourceSlug: "getmobil" },
      {} as never,
    );

    await adapter.fetch({ limit: 40 });

    const cb = CircuitBreakerRegistry.getInstance();
    await cb.awaitHydration();
    expect(cb.getState("getmobil").failureCount).toBe(categoryUrls.length);
  });
});
