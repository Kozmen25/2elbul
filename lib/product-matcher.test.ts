import { describe, expect, it } from "vitest";
import {
  extractProductSignals,
  generateProductKey,
  normalizeProductTitle,
} from "./product-matcher";

describe("product matcher", () => {
  it("normalizes storage spacing and common brand noise", () => {
    expect(normalizeProductTitle("Apple iPhone 15 Pro Max 256GB")).toBe(
      "iphone 15 pro max 256gb",
    );
    expect(normalizeProductTitle("iPhone 15 ProMax 256 gb")).toBe(
      "iphone 15 pro max 256gb",
    );
  });

  it("groups iPhone 15 Pro Max 256 GB variants under the same product key", () => {
    const titles = [
      "iPhone 15 Pro Max 256 GB",
      "Apple iPhone 15 Pro Max 256GB",
      "15 Pro Max 256",
      "iPhone 15 ProMax 256 gb",
    ];
    const keys = titles.map(generateProductKey);

    expect(new Set(keys)).toEqual(new Set(["apple-iphone-15-pro-max-256gb"]));
  });

  it("separates nearby but different iPhone products", () => {
    const baseKey = generateProductKey("iPhone 15 Pro Max 256 GB");
    const differentProductKeys = [
      "iPhone 15 Pro 256 GB",
      "iPhone 15 Pro Max 512 GB",
      "iPhone 14 Pro Max 256 GB",
      "Samsung S23 Ultra 256 GB",
    ].map(generateProductKey);

    for (const key of differentProductKeys) {
      expect(key).not.toBe(baseKey);
    }
  });

  it("groups Samsung S23 Ultra 256 GB variants under the same product key", () => {
    const titles = [
      "Samsung Galaxy S23 Ultra 256 GB",
      "S23 Ultra 256",
      "Galaxy S23 Ultra 256GB",
    ];
    const keys = titles.map(generateProductKey);

    expect(new Set(keys)).toEqual(new Set(["samsung-galaxy-s23-ultra-256gb"]));
  });

  it("extracts useful iPhone signals", () => {
    expect(extractProductSignals("Apple iPhone 15 Pro Max 256GB")).toMatchObject({
      brand: "apple",
      model: "iphone-15-pro-max",
      storage: "256gb",
      category: "Telefon",
      normalizedKey: "apple-iphone-15-pro-max-256gb",
    });
  });

  it("extracts useful Samsung signals", () => {
    expect(extractProductSignals("Galaxy S23 Ultra 256GB")).toMatchObject({
      brand: "samsung",
      model: "galaxy-s23-ultra",
      storage: "256gb",
      category: "Telefon",
      normalizedKey: "samsung-galaxy-s23-ultra-256gb",
    });
  });
});
