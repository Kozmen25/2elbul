import { describe, expect, it } from "vitest";
import {
  buildCompareDecision,
  buildCompareJsonLd,
  findExtremeIndex,
  type CompareCandidateSummary,
  type CompareItemListJsonLd,
} from "./compare-engine";
import { getAbsoluteUrl } from "@/lib/site-url";

function makeCandidate(
  overrides: Partial<CompareCandidateSummary> & { key: number },
): CompareCandidateSummary {
  return {
    key: overrides.key,
    listingId: overrides.listingId ?? "listing-1",
    productName: overrides.productName ?? "iPhone 13",
    productSlug: overrides.productSlug ?? "iphone-13",
    productUrl: overrides.productUrl ?? getAbsoluteUrl("/product/iphone-13"),
    title: overrides.title ?? "iPhone 13 128 GB",
    price: overrides.price ?? 24000,
    city: overrides.city ?? "İstanbul",
    source: overrides.source ?? "EasyCep",
    url: overrides.url ?? "https://example.com/listing-1",
    condition: overrides.condition ?? "İkinci El",
    imageUrl: overrides.imageUrl ?? null,
    createdAt: overrides.createdAt ?? "2026-07-01T00:00:00.000Z",
    averagePrice: overrides.averagePrice ?? 26000,
    medianPrice: overrides.medianPrice ?? 25500,
    minPrice: overrides.minPrice ?? 23000,
    confidenceScore: overrides.confidenceScore ?? 90,
    confidenceLevel: overrides.confidenceLevel ?? "high",
    opportunityScore: overrides.opportunityScore ?? 88,
    opportunityLevel: overrides.opportunityLevel ?? "high",
    riskLevel: overrides.riskLevel ?? "low",
    recommendation: overrides.recommendation ?? {
      action: "buy_now",
      label: "Şimdi al",
      description: "Fiyat avantajı güçlü.",
    },
    duplicateDensity: overrides.duplicateDensity ?? 0.05,
    sourceCount: overrides.sourceCount ?? 3,
    sampleSize: overrides.sampleSize ?? 12,
    dataFreshness: overrides.dataFreshness ?? "fresh",
    priceAdvantagePercent: overrides.priceAdvantagePercent ?? 8,
    trendDirection: overrides.trendDirection ?? "falling",
    trendChangePercent: overrides.trendChangePercent ?? -4,
    productType: overrides.productType ?? null,
  };
}

const candidate0 = makeCandidate({
  key: 0,
  productName: "iPhone 13",
  price: 24000,
  opportunityScore: 88,
  confidenceScore: 90,
  riskLevel: "low",
  duplicateDensity: 0.05,
  sourceCount: 3,
  sampleSize: 12,
  dataFreshness: "fresh",
  priceAdvantagePercent: 9,
});

const candidate1 = makeCandidate({
  key: 1,
  productName: "Samsung Galaxy S22",
  productSlug: "samsung-galaxy-s22",
  productUrl: getAbsoluteUrl("/product/samsung-galaxy-s22"),
  title: "Galaxy S22 256 GB",
  price: 26000,
  opportunityScore: 70,
  confidenceScore: 78,
  riskLevel: "medium",
  duplicateDensity: 0.18,
  sourceCount: 2,
  sampleSize: 10,
  dataFreshness: "recent",
  priceAdvantagePercent: 3,
  trendDirection: "stable",
  url: "https://example.com/listing-2",
  listingId: "listing-2",
});

describe("findExtremeIndex", () => {
  it("returns the index of the minimum when preferLow is true", () => {
    expect(findExtremeIndex([10, 5, 20], true)).toBe(1);
  });

  it("returns the index of the maximum when preferLow is false", () => {
    expect(findExtremeIndex([10, 5, 20], false)).toBe(2);
  });

  it("returns null when all values are equal", () => {
    expect(findExtremeIndex([5, 5, 5], true)).toBeNull();
    expect(findExtremeIndex([5, 5, 5], false)).toBeNull();
  });

  it("returns null for an empty array", () => {
    expect(findExtremeIndex([], true)).toBeNull();
  });

  it("returns the first occurrence of the extreme value", () => {
    expect(findExtremeIndex([5, 10, 10], false)).toBe(1);
  });

  it("works with 4 values", () => {
    expect(findExtremeIndex([30, 10, 50, 20], true)).toBe(1);
    expect(findExtremeIndex([30, 10, 50, 20], false)).toBe(2);
  });
});

describe("buildCompareDecision", () => {
  it("recommends the candidate that wins more signal votes", () => {
    const decision = buildCompareDecision([candidate0, candidate1]);

    expect(decision.recommendedKey).toBe(0);
    expect(decision.recommendedLabel).toBe("iPhone 13");
    expect(decision.tied).toBe(false);
    expect(decision.insufficientData).toBe(false);
    expect(decision.headline).toContain("Önerilen ilan");
  });

  it("produces reasons that flag the winning candidate", () => {
    const decision = buildCompareDecision([candidate0, candidate1]);

    const winningReasons = decision.reasons.filter((reason) => reason.winnerKey === 0);
    expect(winningReasons.length).toBeGreaterThan(0);
    const opportunityReason = decision.reasons.find((reason) =>
      reason.label.includes("Opportunity"),
    );
    expect(opportunityReason?.winnerKey).toBe(0);
  });

  it("calls a tie when candidates are identical", () => {
    const identical = makeCandidate({
      key: 1,
      listingId: "listing-2",
      productName: "iPhone 13",
      priceAdvantagePercent: candidate0.priceAdvantagePercent,
      trendDirection: candidate0.trendDirection,
      trendChangePercent: candidate0.trendChangePercent,
    });
    const decision = buildCompareDecision([candidate0, identical]);

    expect(decision.tied).toBe(true);
    expect(decision.recommendedKey).toBeNull();
    expect(decision.recommendedLabel).toBe("Başabaş");
  });

  it("falls back to insufficient data when a sample is below the threshold", () => {
    const insufficient = makeCandidate({
      key: 1,
      sampleSize: 2,
      productName: "Az Verili Ürün",
    });
    const decision = buildCompareDecision([candidate0, insufficient]);

    expect(decision.insufficientData).toBe(true);
    expect(decision.recommendedKey).toBeNull();
    expect(decision.recommendedLabel).toBe("Karar için yetersiz veri");
    expect(decision.reasons.some((reason) => reason.label.includes("Az Verili Ürün"))).toBe(true);
  });

  it("marks lower price as a winning reason", () => {
    const decision = buildCompareDecision([candidate0, candidate1]);
    const priceReason = decision.reasons.find((reason) => reason.label.includes("Daha düşük fiyat"));
    expect(priceReason?.winnerKey).toBe(0);
  });

  it("marks duplicate density with the lower-density candidate", () => {
    const decision = buildCompareDecision([candidate0, candidate1]);
    const duplicateReason = decision.reasons.find((reason) =>
      reason.label.includes("Duplicate"),
    );
    expect(duplicateReason?.winnerKey).toBe(0);
  });

  it("skips reasons where the candidates tie on that signal", () => {
    const tiedOpportunity = makeCandidate({
      key: 1,
      productName: "Aynı Skorlu",
      opportunityScore: candidate0.opportunityScore,
    });
    const decision = buildCompareDecision([candidate0, tiedOpportunity]);
    const opportunityReason = decision.reasons.find((reason) =>
      reason.label.includes("Opportunity"),
    );
    expect(opportunityReason).toBeUndefined();
  });

  it("determines the winner among 3 candidates", () => {
    const c0 = makeCandidate({
      key: 0,
      productName: "Ürün A",
      price: 20000,
      opportunityScore: 50,
      confidenceScore: 60,
      riskLevel: "high",
      duplicateDensity: 0.3,
      sourceCount: 1,
    });
    const c1 = makeCandidate({
      key: 1,
      productName: "Ürün B",
      price: 25000,
      opportunityScore: 90,
      confidenceScore: 95,
      riskLevel: "low",
      duplicateDensity: 0.05,
      sourceCount: 5,
    });
    const c2 = makeCandidate({
      key: 2,
      productName: "Ürün C",
      price: 22000,
      opportunityScore: 70,
      confidenceScore: 75,
      riskLevel: "medium",
      duplicateDensity: 0.15,
      sourceCount: 3,
    });
    const decision = buildCompareDecision([c0, c1, c2]);

    // Ürün B should win (best opportunity, confidence, risk, duplicate density, source count)
    expect(decision.recommendedKey).toBe(1);
    expect(decision.tied).toBe(false);
    expect(decision.insufficientData).toBe(false);
  });

  it("determines the winner among 4 candidates", () => {
    const c0 = makeCandidate({ key: 0, productName: "A", price: 30000, opportunityScore: 40, confidenceScore: 40, riskLevel: "high", duplicateDensity: 0.4, sourceCount: 1 });
    const c1 = makeCandidate({ key: 1, productName: "B", price: 25000, opportunityScore: 60, confidenceScore: 60, riskLevel: "medium", duplicateDensity: 0.2, sourceCount: 2 });
    const c2 = makeCandidate({ key: 2, productName: "C", price: 20000, opportunityScore: 80, confidenceScore: 80, riskLevel: "low", duplicateDensity: 0.1, sourceCount: 4 });
    const c3 = makeCandidate({ key: 3, productName: "D", price: 28000, opportunityScore: 50, confidenceScore: 50, riskLevel: "high", duplicateDensity: 0.3, sourceCount: 2 });
    const decision = buildCompareDecision([c0, c1, c2, c3]);

    // C should win (best price, opportunity, confidence, risk, duplicate, source)
    expect(decision.recommendedKey).toBe(2);
    expect(decision.tied).toBe(false);
  });

  it("correctly declares a tie among 3 candidates", () => {
    // All 3 candidates are identical → all reasons skipped → all get 0 votes → tied
    const c0 = makeCandidate({ key: 0, productName: "Aynı A", listingId: "a" });
    const c1 = makeCandidate({ key: 1, productName: "Aynı B", listingId: "b" });
    const c2 = makeCandidate({ key: 2, productName: "Aynı C", listingId: "c" });
    const decision = buildCompareDecision([c0, c1, c2]);

    expect(decision.tied).toBe(true);
    expect(decision.recommendedKey).toBeNull();
    expect(decision.recommendedLabel).toBe("Başabaş");
  });

  it("handles all-insufficient-data with 4 candidates", () => {
    const candidates = [0, 1, 2, 3].map((key) =>
      makeCandidate({ key, productName: `Ürün ${key}`, sampleSize: 1 }),
    );
    const decision = buildCompareDecision(candidates);

    expect(decision.insufficientData).toBe(true);
    expect(decision.recommendedKey).toBeNull();
    expect(decision.reasons.every((r) => r.winnerKey === null)).toBe(true);
  });
});

describe("buildCompareJsonLd", () => {
  it("emits WebPage, BreadcrumbList and ItemList for 2 candidates", () => {
    const canonicalUrl = getAbsoluteUrl("/compare?ids=listing-1,listing-2");
    const jsonLd = buildCompareJsonLd({ candidates: [candidate0, candidate1], canonicalUrl });

    const types = jsonLd.map((document) => document["@type"]);
    expect(types).toEqual(
      expect.arrayContaining(["WebPage", "BreadcrumbList", "ItemList"]),
    );
  });

  it("builds a two-step breadcrumb ending at the compare canonical url", () => {
    const canonicalUrl = getAbsoluteUrl("/compare?ids=listing-1,listing-2");
    const jsonLd = buildCompareJsonLd({ candidates: [candidate0, candidate1], canonicalUrl });

    const breadcrumb = jsonLd.find(
      (document) => document["@type"] === "BreadcrumbList",
    ) as { itemListElement: Array<{ position: number; name: string; item: string }> };
    expect(breadcrumb.itemListElement).toHaveLength(2);
    expect(breadcrumb.itemListElement[0].name).toBe("Ana Sayfa");
    expect(breadcrumb.itemListElement[1].item).toBe(canonicalUrl);
  });

  it("lists both candidates as Product items in the ItemList for 2 items", () => {
    const canonicalUrl = getAbsoluteUrl("/compare?ids=listing-1,listing-2");
    const jsonLd = buildCompareJsonLd({ candidates: [candidate0, candidate1], canonicalUrl });

    const itemList = jsonLd.find(
      (document) => document["@type"] === "ItemList",
    ) as CompareItemListJsonLd;
    expect(itemList.itemListElement).toHaveLength(2);
    expect(itemList.itemListElement[0].item.name).toBe("iPhone 13");
    expect(itemList.itemListElement[1].item.name).toBe("Samsung Galaxy S22");
  });

  it("references the breadcrumb from the WebPage document", () => {
    const canonicalUrl = getAbsoluteUrl("/compare?ids=listing-1,listing-2");
    const jsonLd = buildCompareJsonLd({ candidates: [candidate0, candidate1], canonicalUrl });

    const webPage = jsonLd.find((document) => document["@type"] === "WebPage") as {
      breadcrumb: { "@id": string };
      url: string;
    };
    expect(webPage.breadcrumb["@id"]).toBe(`${canonicalUrl}#breadcrumb`);
    expect(webPage.url).toBe(canonicalUrl);
  });

  it("lists 3 candidates in the ItemList", () => {
    const c2 = makeCandidate({ key: 2, productName: "Google Pixel 8", listingId: "listing-3" });
    const canonicalUrl = getAbsoluteUrl("/compare?ids=listing-1,listing-2,listing-3");
    const jsonLd = buildCompareJsonLd({ candidates: [candidate0, candidate1, c2], canonicalUrl });

    const itemList = jsonLd.find(
      (document) => document["@type"] === "ItemList",
    ) as CompareItemListJsonLd;
    expect(itemList.itemListElement).toHaveLength(3);
    expect(itemList.itemListElement[0].item.name).toBe("iPhone 13");
    expect(itemList.itemListElement[1].item.name).toBe("Samsung Galaxy S22");
    expect(itemList.itemListElement[2].item.name).toBe("Google Pixel 8");
  });

  it("lists 4 candidates in the ItemList", () => {
    const candidates = [
      candidate0,
      candidate1,
      makeCandidate({ key: 2, productName: "Google Pixel 8", listingId: "listing-3" }),
      makeCandidate({ key: 3, productName: "Xiaomi Redmi Note 12", listingId: "listing-4" }),
    ];
    const canonicalUrl = getAbsoluteUrl("/compare?ids=listing-1,listing-2,listing-3,listing-4");
    const jsonLd = buildCompareJsonLd({ candidates, canonicalUrl });

    const itemList = jsonLd.find(
      (document) => document["@type"] === "ItemList",
    ) as CompareItemListJsonLd;
    expect(itemList.itemListElement).toHaveLength(4);
  });
});
