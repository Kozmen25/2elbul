import { describe, expect, it } from "vitest";
import type { Category, CategoryWithChildren } from "@/lib/categories";
import { buildPriceListSections } from "./price-list";

function category(id: number, slug: string, name: string, parentId: number | null = null): Category {
  return {
    id,
    slug,
    parentId,
    name,
    icon: null,
    shortDescription: null,
    longDescription: null,
    expectedProductType: null,
    displayOrder: id,
    isFallback: false,
  };
}

const tree: CategoryWithChildren[] = [
  { ...category(1, "telefon", "Telefon"), children: [category(11, "akilli-telefon", "Akıllı Telefon", 1)] },
  { ...category(2, "bilgisayar", "Bilgisayar"), children: [] },
  { ...category(3, "emlak", "Emlak"), children: [] },
];

describe("buildPriceListSections", () => {
  const sections = buildPriceListSections(
    [
      { id: 1, name: "iPhone 15", slug: "iphone-15", category_id: 11 },
      { id: 2, name: "Samsung Galaxy S23", slug: null, category_id: 1 },
      { id: 3, name: "MacBook Air M2", slug: "macbook-air-m2", category_id: 2 },
      { id: 4, name: "Demo Telefon", slug: "demo-telefon", category_id: 1 },
      { id: 5, name: "Eski Model", slug: "eski-model", category_id: 1 },
      { id: 6, name: "Bilinmeyen Ürün", slug: "bilinmeyen-urun", category_id: 99 },
    ],
    [
      { product_id: 1, prices: [30000, 32000, "28000"] },
      { product_id: 2, prices: [21000, 23000, 22000, 24000] },
      { product_id: 3, prices: [27000] },
      { product_id: 4, prices: [1000] },
      { product_id: 6, prices: [500] },
    ],
    tree,
  );

  it("groups models under their main category in menu order", () => {
    expect(sections.map((section) => section.slug)).toEqual(["telefon", "bilgisayar", null]);
    expect(sections[0].models.map((model) => model.name)).toEqual(["Samsung Galaxy S23", "iPhone 15"]);
    expect(sections[0].listingCount).toBe(7);
  });

  it("drops demo products, models without listings and empty categories", () => {
    const names = sections.flatMap((section) => section.models.map((model) => model.name));
    expect(names).not.toContain("Demo Telefon");
    expect(names).not.toContain("Eski Model");
    expect(sections.some((section) => section.slug === "emlak")).toBe(false);
  });

  it("reports lowest and average price and falls back to a generated slug", () => {
    const iphone = sections[0].models.find((model) => model.id === "1");
    expect(iphone).toMatchObject({ minPrice: 28000, averagePrice: 30000, listingCount: 3 });
    expect(sections[0].models.find((model) => model.id === "2")?.slug).toBe("samsung-galaxy-s23");
  });

  it("keeps products of unknown categories in a separate section", () => {
    expect(sections[2]).toMatchObject({ name: "Diğer", slug: null });
    expect(sections[2].models[0].name).toBe("Bilinmeyen Ürün");
  });
});
