import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));

vi.mock("@/lib/bots/anti-bot-proxy", () => ({
  fetchViaAntiBotProxy: vi.fn(),
}));

vi.mock("@/lib/bots/html-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/bots/html-utils")>();
  return {
    ...actual,
    safeFetchHtml: vi.fn(),
    sleep: vi.fn(),
    validateImageUrls: vi.fn().mockImplementation(
      (urls: string[]) => Promise.resolve(urls.slice(0, 8)),
    ),
  };
});

import { fetchCommerceListings } from "./commerce";
import { fetchViaAntiBotProxy } from "@/lib/bots/anti-bot-proxy";
import { safeFetchHtml } from "@/lib/bots/html-utils";
import type { BotAdapterListing } from "@/lib/bots/types";

const VALID_HTML = `<!DOCTYPE html>
<html>
<head>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "iPhone 13 128GB",
  "image": "https://example.com/img.jpg",
  "url": "https://example.com/iphone13",
  "offers": { "price": "15000" }
}
</script>
</head>
<body></body>
</html>`;

const config = {
  sourceName: "TestMarket",
  sourceType: "scrape",
  category: "telefon",
  defaultCondition: "Yenilenmiş",
  allowedHosts: ["example.com"],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("H1 — ScrapingFish proxy branching", () => {
  describe("proxy path (SCRAPINGFISH_API_KEY set)", () => {
    const OLD_KEY = process.env.SCRAPINGFISH_API_KEY;

    beforeAll(() => {
      process.env.SCRAPINGFISH_API_KEY = "test-key-123";
    });

    afterAll(() => {
      if (OLD_KEY === undefined) {
        delete process.env.SCRAPINGFISH_API_KEY;
      } else {
        process.env.SCRAPINGFISH_API_KEY = OLD_KEY;
      }
    });

    it("calls fetchViaAntiBotProxy with the category URL and 30s timeout", async () => {
      (fetchViaAntiBotProxy as ReturnType<typeof vi.fn>).mockResolvedValue({
        html: VALID_HTML,
        finalUrl: "https://example.com/iphone13",
      });

      const result = await fetchCommerceListings(
        "https://example.com/telefon",
        5,
        config,
      );

      expect(fetchViaAntiBotProxy).toHaveBeenCalledTimes(1);
      expect(fetchViaAntiBotProxy).toHaveBeenCalledWith(
        "https://example.com/telefon",
        { timeoutMs: 30_000 },
      );
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it("does not call safeFetchHtml when proxy key is set", async () => {
      (fetchViaAntiBotProxy as ReturnType<typeof vi.fn>).mockResolvedValue({
        html: VALID_HTML,
        finalUrl: "https://example.com/iphone13",
      });

      await fetchCommerceListings("https://example.com/telefon", 5, config);

      expect(safeFetchHtml).not.toHaveBeenCalled();
    });

    it("returns parsed BotAdapterListing[] with correct source name", async () => {
      (fetchViaAntiBotProxy as ReturnType<typeof vi.fn>).mockResolvedValue({
        html: VALID_HTML,
        finalUrl: "https://example.com/iphone13",
      });

      const result = await fetchCommerceListings(
        "https://example.com/telefon",
        5,
        config,
      );

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].source).toBe("TestMarket");
      expect(result[0].title).toBe("iPhone 13 128GB");
    });
  });

  describe("fallback path (SCRAPINGFISH_API_KEY unset)", () => {
    const OLD_KEY = process.env.SCRAPINGFISH_API_KEY;

    beforeAll(() => {
      delete process.env.SCRAPINGFISH_API_KEY;
    });

    afterAll(() => {
      if (OLD_KEY === undefined) {
        delete process.env.SCRAPINGFISH_API_KEY;
      } else {
        process.env.SCRAPINGFISH_API_KEY = OLD_KEY;
      }
    });

    it("calls safeFetchHtml with the category URL, 15s timeout, and 2 retries", async () => {
      (safeFetchHtml as ReturnType<typeof vi.fn>).mockResolvedValue({
        html: VALID_HTML,
        finalUrl: "https://example.com/iphone13",
      });

      const result = await fetchCommerceListings(
        "https://example.com/telefon",
        5,
        config,
      );

      expect(safeFetchHtml).toHaveBeenCalledTimes(1);
      expect(safeFetchHtml).toHaveBeenCalledWith(
        "https://example.com/telefon",
        { timeoutMs: 15_000, retries: 2, retryDelayMs: 900 },
      );
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it("does not call fetchViaAntiBotProxy when proxy key is absent", async () => {
      (safeFetchHtml as ReturnType<typeof vi.fn>).mockResolvedValue({
        html: VALID_HTML,
        finalUrl: "https://example.com/iphone13",
      });

      await fetchCommerceListings("https://example.com/telefon", 5, config);

      expect(fetchViaAntiBotProxy).not.toHaveBeenCalled();
    });

    it("returns parsed BotAdapterListing[] with correct source name via fallback", async () => {
      (safeFetchHtml as ReturnType<typeof vi.fn>).mockResolvedValue({
        html: VALID_HTML,
        finalUrl: "https://example.com/iphone13",
      });

      const result = await fetchCommerceListings(
        "https://example.com/telefon",
        5,
        config,
      );

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].source).toBe("TestMarket");
      expect(result[0].title).toBe("iPhone 13 128GB");
    });
  });
});
