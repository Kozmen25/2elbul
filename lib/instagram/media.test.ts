import { describe, expect, it } from "vitest";
import {
  renderInstagramReelCoverBuffer,
  renderInstagramReelVideoBuffer,
} from "./media";
import type { InstagramReelDraft } from "./types";

describe("instagram media", () => {
  it("renders a PNG cover buffer", async () => {
    const buffer = await renderInstagramReelCoverBuffer(createDraft());

    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(1, 4).toString("ascii")).toBe("PNG");
  });

  it("renders an MP4 video buffer", async () => {
    const buffer = await renderInstagramReelVideoBuffer(createDraft());

    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(4, 8).toString("ascii")).toBe("ftyp");
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
