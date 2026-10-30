import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { BotAdapterListing } from "@/lib/bots/types";

vi.mock("@/lib/bots/adapters/easycep", async () => {
  const actual = await vi.importActual<typeof import("@/lib/bots/adapters/easycep")>(
    "@/lib/bots/adapters/easycep",
  );
  return {
    ...actual,
    fetchEasyCepListings: vi.fn(),
  };
});

import { fetchEasyCepListings, EASYCEP_CATEGORY_URLS } from "@/lib/bots/adapters/easycep";
import { CircuitBreakerRegistry } from "@/lib/recovery";
import { createEasyCepUnifiedAdapter } from "./easycep-unified";

function makeListing(title: string): BotAdapterListing {
  return {
    product_name: title,
    title,
    price: 100,
    city: "İstanbul",
    source: "easycep",
    url: `https://easycep.com/${title}`,
    condition: "Yenilenmiş",
    image_url: null,
    image_urls: [],
    status: "active",
  };
}

describe("createEasyCepUnifiedAdapter.fetch", () => {
  beforeEach(() => {
    CircuitBreakerRegistry.resetInstance();
    vi.mocked(fetchEasyCepListings).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("isolates a failing category instead of discarding results from the others", async () => {
    const categoryUrls = Object.keys(EASYCEP_CATEGORY_URLS);
    vi.mocked(fetchEasyCepListings).mockImplementation(async (categoryUrl) => {
      if (categoryUrl === categoryUrls[0]) {
        throw new Error("category unavailable");
      }
      return [makeListing(`ok-${categoryUrl}`)];
    });

    const adapter = createEasyCepUnifiedAdapter(
      { sourceId: 1, sourceName: "EasyCep", sourceSlug: "easycep" },
      {} as never,
    );

    const result = await adapter.fetch({ limit: 40 });

    // One category failed, the remaining ones still made it through.
    expect(result.length).toBe(categoryUrls.length - 1);
    expect(fetchEasyCepListings).toHaveBeenCalledTimes(categoryUrls.length);
  });

  it("records circuit breaker failures for a failing category", async () => {
    const categoryUrls = Object.keys(EASYCEP_CATEGORY_URLS);
    vi.mocked(fetchEasyCepListings).mockRejectedValue(new Error("boom"));

    const adapter = createEasyCepUnifiedAdapter(
      { sourceId: 1, sourceName: "EasyCep", sourceSlug: "easycep" },
      {} as never,
    );

    await adapter.fetch({ limit: 40 });

    const cb = CircuitBreakerRegistry.getInstance();
    await cb.awaitHydration();
    expect(cb.getState("easycep").failureCount).toBe(categoryUrls.length);
  });
});
