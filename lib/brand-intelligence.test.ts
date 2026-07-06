import { describe, expect, it } from "vitest";
import { buildBrandCatalog, buildBrandFaqItems, buildBrandJsonLd } from "./brand-intelligence";

const topOpportunity = {
  productName: "MSI Katana 15",
  href: "/product/msi-katana-15",
  listingCount: 4,
  averagePrice: 34999,
  lowestPrice: 32999,
  opportunityLabel: "Güçlü fırsat" as const,
  opportunityScore: 91,
  buyScore: 88,
  decisionLabel: "Şimdi Al" as const,
  trendDirection: "falling" as const,
  trendChangePercent: -7,
  searchCount: 18,
};

describe("brand intelligence helpers", () => {
  it("buildBrandCatalog groups products by extracted brand", () => {
    const catalog = buildBrandCatalog([
      { id: 1, name: "Apple iPhone 13", created_at: "2026-07-01T10:00:00.000Z" },
      { id: 2, name: "Apple MacBook Air M2", created_at: "2026-07-03T10:00:00.000Z" },
      { id: 3, name: "MSI Katana 15", created_at: "2026-07-04T10:00:00.000Z" },
    ]);

    expect(catalog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slug: "apple",
          name: "Apple",
          productCount: 2,
          latestProductAt: "2026-07-03T10:00:00.000Z",
        }),
        expect.objectContaining({
          slug: "msi",
          name: "MSI",
          productCount: 1,
          latestProductAt: "2026-07-04T10:00:00.000Z",
        }),
      ]),
    );
  });

  it("orders brands by product count", () => {
    const catalog = buildBrandCatalog([
      { id: 1, name: "MSI Katana 15", created_at: "2026-07-04T10:00:00.000Z" },
      { id: 2, name: "Apple iPhone 13", created_at: "2026-07-01T10:00:00.000Z" },
      { id: 3, name: "Apple MacBook Air M2", created_at: "2026-07-03T10:00:00.000Z" },
      { id: 4, name: "Apple Watch Series 9", created_at: "2026-07-05T10:00:00.000Z" },
    ]);

    expect(catalog[0]?.slug).toBe("apple");
    expect(catalog[0]?.productCount).toBe(3);
    expect(catalog[1]?.slug).toBe("msi");
  });

  it("builds dynamic FAQ items from brand metrics", () => {
    const faqItems = buildBrandFaqItems({
      brandName: "MSI",
      listingCount: 12,
      productCount: 4,
      sourceCount: 3,
      marketIntelligence: {
        sampleSize: 12,
      } as never,
      opportunityAnalysis: {
        dataFreshness: "fresh",
      } as never,
    });

    expect(faqItems).toHaveLength(5);
    expect(faqItems[0]?.question).toContain("MSI");
    expect(faqItems[2]?.answer).toContain("12 ilan");
  });

  it("builds brand JSON-LD with breadcrumb, FAQ and item list", () => {
    const jsonLd = buildBrandJsonLd({
      brandName: "MSI",
      brandUrl: "https://2elbul.com/brand/msi",
      summary: "MSI için piyasa özeti.",
      faqItems: [
        {
          question: "MSI marka sayfası nasıl hazırlanıyor?",
          answer: "2ElBul brand analysis.",
        },
      ],
      topOpportunities: [topOpportunity],
    });

    expect(jsonLd.map((item) => item["@type"])).toEqual(
      expect.arrayContaining(["CollectionPage", "BreadcrumbList", "FAQPage", "ItemList"]),
    );
    const breadcrumb = jsonLd.find((item) => item["@type"] === "BreadcrumbList");
    expect(breadcrumb).toMatchObject({
      "@id": "https://2elbul.com/brand/msi#breadcrumb",
    });
  });
});
