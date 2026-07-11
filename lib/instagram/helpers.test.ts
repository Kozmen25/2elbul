import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildInstagramGraphApiBaseUrl,
  buildInstagramPublishConfig,
  buildInstagramReelCaption,
  buildInstagramReelOverlayLines,
  escapeSvgText,
  normalizeGraphApiVersion,
  splitSvgTextLines,
} from "./helpers";
import { pickDailyInstagramReelSelection } from "./draft";
import type { InstagramReelDraft } from "./types";

const sampleDraft = createDraft();

describe("instagram helpers", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("selects the first price opportunity when available", () => {
    const selection = pickDailyInstagramReelSelection({
      priceOpportunities: [
        {
          id: "1",
          productName: "Apple iPhone 15 Pro Max 256GB",
          title: "Apple iPhone 15 Pro Max 256GB",
          price: 54999,
          city: "Istanbul",
          source: "Sahibinden",
          url: "https://example.com/1",
          condition: "İkinci El",
          imageUrl: null,
          createdAt: "2026-07-11T08:00:00.000Z",
          averagePrice: 62000,
          discountRate: 11,
        },
      ],
      latestListings: [],
      refurbishedListings: [],
    });

    expect(selection?.selectionReason).toBe("price-opportunity");
    expect(selection?.productSlug).toBe("apple-iphone-15-pro-max-256gb");
  });

  it("falls back to the latest listing when there is no opportunity", () => {
    const selection = pickDailyInstagramReelSelection({
      priceOpportunities: [],
      latestListings: [
        {
          id: "2",
          productName: "Samsung Galaxy S24 Ultra 256GB",
          title: "Samsung Galaxy S24 Ultra 256GB",
          price: 65999,
          city: "Ankara",
          source: "Letgo",
          url: "https://example.com/2",
          condition: "İkinci El",
          imageUrl: null,
          createdAt: "2026-07-11T08:00:00.000Z",
        },
      ],
      refurbishedListings: [],
    });

    expect(selection?.selectionReason).toBe("latest-listing");
    expect(selection?.productSlug).toBe("samsung-galaxy-s24-ultra-256gb");
  });

  it("returns null when there is no candidate", () => {
    expect(
      pickDailyInstagramReelSelection({
        priceOpportunities: [],
        latestListings: [],
        refurbishedListings: [],
      }),
    ).toBeNull();
  });

  it("builds a caption with the key decision metrics", () => {
    const caption = buildInstagramReelCaption(sampleDraft);

    expect(caption).toContain("Apple iPhone 15 Pro Max 256GB");
    expect(caption).toContain("Şimdi al");
    expect(caption).toContain("91/100");
    expect(caption).toContain("52 ilan");
    expect(caption).toContain("3 kaynak");
    expect(caption).toContain(sampleDraft.productUrl);
  });

  it("builds overlay lines with the opportunity summary", () => {
    const lines = buildInstagramReelOverlayLines(sampleDraft);

    expect(lines[0]).toBe("GUNUN FIRSATI");
    expect(lines).toContain("Şimdi al • Çok yüksek");
    expect(lines).toContain("Skor 91/100 • Risk Düşük");
  });

  it("escapes SVG text safely", () => {
    expect(escapeSvgText(`<b>&"'</b>`)).toBe(
      "&lt;b&gt;&amp;&quot;&apos;&lt;/b&gt;",
    );
  });

  it("wraps long text into multiple SVG lines", () => {
    const lines = splitSvgTextLines("Apple iPhone 15 Pro Max 256GB", 12);

    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(" ")).toContain("iPhone 15");
  });

  it("normalizes graph api versions", () => {
    expect(normalizeGraphApiVersion("20.0")).toBe("v20.0");
    expect(normalizeGraphApiVersion("v21.0")).toBe("v21.0");
  });

  it("builds the Graph API base url", () => {
    expect(buildInstagramGraphApiBaseUrl("20.0")).toBe(
      "https://graph.facebook.com/v20.0",
    );
  });

  it("builds a publish config when env vars exist", () => {
    vi.stubEnv("INSTAGRAM_ACCESS_TOKEN", "token-123");
    vi.stubEnv("INSTAGRAM_IG_USER_ID", "1789");
    vi.stubEnv("INSTAGRAM_GRAPH_API_VERSION", "20.0");

    expect(buildInstagramPublishConfig()).toEqual({
      accessToken: "token-123",
      igUserId: "1789",
      graphApiVersion: "v20.0",
    });
  });

  it("returns null publish config when env vars are missing", () => {
    expect(buildInstagramPublishConfig()).toBeNull();
  });
});

function createDraft(): InstagramReelDraft {
  return {
    productSlug: "apple-iphone-15-pro-max-256gb",
    productName: "Apple iPhone 15 Pro Max 256GB",
    productUrl: "https://2elbul.com/product/apple-iphone-15-pro-max-256gb",
    listingUrl: "https://example.com/listing/1",
    coverImageUrl: null,
    city: "Istanbul",
    sourceName: "Sahibinden",
    opportunityScore: 91,
    opportunityLevel: "very-high",
    riskLevel: "low",
    recommendationAction: "buy_now",
    recommendationLabel: "Şimdi al",
    recommendationDescription:
      "Fiyat avantajı güçlü, güven yüksek ve risk düşük.",
    confidenceScore: 96,
    confidenceLevel: "very-high",
    averagePrice: 62000,
    minPrice: 54999,
    maxPrice: 64999,
    priceAdvantagePercent: 11.3,
    sampleSize: 52,
    sourceCount: 3,
    analysisGeneratedAt: "2026-07-11T08:00:00.000Z",
    scoreGeneratedAt: "2026-07-11T08:00:00.000Z",
    dataFreshness: "fresh",
    reasons: [
      "Başlık tamamen eşleşiyor",
      "3 farklı güvenilir kaynak doğruladı",
    ],
    warningSignals: ["Fiyat farkı yüksek olsa da ilan güvenilir görünüyor."],
    positiveSignals: ["Piyasanın altında fiyat", "Confidence yüksek"],
    bestDealLabel: "Ortalamanın altında",
    bestDealPrice: 54999,
    bestDealDifferencePercent: -11.3,
  };
}
