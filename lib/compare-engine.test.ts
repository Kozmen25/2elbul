import { describe, expect, it } from "vitest";
import {
  buildCompareDecision,
  buildCompareJsonLd,
  type CompareCandidateSummary,
} from "./compare-engine";
import { getAbsoluteUrl } from "@/lib/site-url";

function makeCandidate(
  overrides: Partial<CompareCandidateSummary> & { key: "a" | "b" },
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
  };
}

const candidateA = makeCandidate({
  key: "a",
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

const candidateB = makeCandidate({
  key: "b",
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

describe("buildCompareDecision", () => {
  it("recommends the candidate that wins more signal votes", () => {
    const decision = buildCompareDecision(candidateA, candidateB);

    expect(decision.recommendedKey).toBe("a");
    expect(decision.recommendedLabel).toBe("iPhone 13");
    expect(decision.tied).toBe(false);
    expect(decision.insufficientData).toBe(false);
    expect(decision.headline).toContain("Önerilen ilan");
  });

  it("produces reasons that flag the winning candidate", () => {
    const decision = buildCompareDecision(candidateA, candidateB);

    const winningReasons = decision.reasons.filter((reason) => reason.winnerKey === "a");
    expect(winningReasons.length).toBeGreaterThan(0);
    const opportunityReason = decision.reasons.find((reason) =>
      reason.label.includes("Opportunity"),
    );
    expect(opportunityReason?.winnerKey).toBe("a");
  });

  it("calls a tie when candidates are identical", () => {
    const identical = makeCandidate({
      key: "b",
      listingId: "listing-2",
      productName: "iPhone 13",
      priceAdvantagePercent: candidateA.priceAdvantagePercent,
      trendDirection: candidateA.trendDirection,
      trendChangePercent: candidateA.trendChangePercent,
    });
    const decision = buildCompareDecision(candidateA, identical);

    expect(decision.tied).toBe(true);
    expect(decision.recommendedKey).toBeNull();
    expect(decision.recommendedLabel).toBe("Başabaş");
  });

  it("falls back to insufficient data when a sample is below the threshold", () => {
    const insufficient = makeCandidate({
      key: "b",
      sampleSize: 2,
      productName: "Az Verili Ürün",
    });
    const decision = buildCompareDecision(candidateA, insufficient);

    expect(decision.insufficientData).toBe(true);
    expect(decision.recommendedKey).toBeNull();
    expect(decision.recommendedLabel).toBe("Karar için yetersiz veri");
    expect(decision.reasons.some((reason) => reason.label.includes("Az Verili Ürün"))).toBe(true);
  });

  it("marks lower price as a winning reason", () => {
    const decision = buildCompareDecision(candidateA, candidateB);
    const priceReason = decision.reasons.find((reason) => reason.label.includes("Daha düşük fiyat"));
    expect(priceReason?.winnerKey).toBe("a");
  });

  it("marks duplicate density with the lower-density candidate", () => {
    const decision = buildCompareDecision(candidateA, candidateB);
    const duplicateReason = decision.reasons.find((reason) =>
      reason.label.includes("Duplicate"),
    );
    expect(duplicateReason?.winnerKey).toBe("a");
  });

  it("skips reasons where the candidates tie on that signal", () => {
    const tiedOpportunity = makeCandidate({
      key: "b",
      productName: "Aynı Skorlu",
      opportunityScore: candidateA.opportunityScore,
    });
    const decision = buildCompareDecision(candidateA, tiedOpportunity);
    const opportunityReason = decision.reasons.find((reason) =>
      reason.label.includes("Opportunity"),
    );
    expect(opportunityReason).toBeUndefined();
  });
});

describe("buildCompareJsonLd", () => {
  const canonicalUrl = getAbsoluteUrl(
    `/compare?a=${encodeURIComponent("listing-1")}&b=${encodeURIComponent("listing-2")}`,
  );
  const jsonLd = buildCompareJsonLd({
    candidateA,
    candidateB,
    canonicalUrl,
  });

  it("emits WebPage, BreadcrumbList and ItemList documents", () => {
    const types = jsonLd.map((document) => document["@type"]);
    expect(types).toEqual(
      expect.arrayContaining(["WebPage", "BreadcrumbList", "ItemList"]),
    );
  });

  it("builds a two-step breadcrumb ending at the compare canonical url", () => {
    const breadcrumb = jsonLd.find(
      (document) => document["@type"] === "BreadcrumbList",
    ) as { itemListElement: Array<{ position: number; name: string; item: string }> };
    expect(breadcrumb.itemListElement).toHaveLength(2);
    expect(breadcrumb.itemListElement[0].name).toBe("Ana Sayfa");
    expect(breadcrumb.itemListElement[1].item).toBe(canonicalUrl);
  });

  it("lists both candidates as Product items in the ItemList", () => {
    const itemList = jsonLd.find(
      (document) => document["@type"] === "ItemList",
    ) as { itemListElement: Array<{ name: string; item: { name: string } }> };
    expect(itemList.itemListElement).toHaveLength(2);
    expect(itemList.itemListElement[0].item.name).toBe("iPhone 13");
    expect(itemList.itemListElement[1].item.name).toBe("Samsung Galaxy S22");
  });

  it("references the breadcrumb from the WebPage document", () => {
    const webPage = jsonLd.find((document) => document["@type"] === "WebPage") as {
      breadcrumb: { "@id": string };
      url: string;
    };
    expect(webPage.breadcrumb["@id"]).toBe(`${canonicalUrl}#breadcrumb`);
    expect(webPage.url).toBe(canonicalUrl);
  });
});
