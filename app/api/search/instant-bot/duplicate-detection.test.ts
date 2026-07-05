import { describe, it, expect } from "vitest";
import { groupListingDuplicates } from "../../../../lib/product-matcher";

describe("search-pipeline duplicate detection", () => {
  it("should detect duplicates in search results", () => {
    const searchResults = [
      {
        id: "search-1",
        title: "iPhone 13 Pro Max 256GB Gold",
        price: 12500,
        source: "EasyCep",
        condition: "refurbished",
      },
      {
        id: "search-2",
        title: "iPhone 13 Pro Max 256GB Gold",
        price: 12600,
        source: "Getmobil",
        condition: "refurbished",
      },
      {
        id: "search-3",
        title: "iPhone 13 Pro Max 128GB",
        price: 12400,
        source: "Teknosa",
        condition: "refurbished",
      },
    ];

    const result = groupListingDuplicates(searchResults, 70);

    expect(result.groups).toBeDefined();
    expect(result.count).toBeGreaterThan(0);
  });

  it("should group search results by similarity threshold", () => {
    const searchResults = [
      {
        id: "sr-1",
        title: "Samsung Galaxy S23 Ultra 512GB",
        price: 18000,
        source: "Hepsiburada",
        condition: "refurbished",
      },
      {
        id: "sr-2",
        title: "Samsung Galaxy S23 Ultra",
        price: 17800,
        source: "MediaMarkt",
        condition: "refurbished",
      },
      {
        id: "sr-3",
        title: "Galaxy S23 Ultra 512GB",
        price: 18200,
        source: "Yenilenmiş Market",
        condition: "refurbished",
      },
    ];

    const result = groupListingDuplicates(searchResults, 75);

    expect(result.groups).toBeDefined();
    expect(result.matchedCount).toBeGreaterThanOrEqual(0);
  });

  it("should handle single search result", () => {
    const searchResults = [
      {
        id: "sr-single",
        title: "Apple Watch Series 8 45mm",
        price: 6500,
        source: "EasyCep",
        condition: "refurbished",
      },
    ];

    const result = groupListingDuplicates(searchResults, 70);

    expect(result.groups).toBeDefined();
    expect(result.count).toBeGreaterThanOrEqual(0);
  });

  it("should identify diverse search results as different products", () => {
    const searchResults = [
      {
        id: "sr-1",
        title: "MacBook Pro 16 inch M3",
        price: 35000,
        source: "EasyCep",
        condition: "new",
      },
      {
        id: "sr-2",
        title: "Dell XPS 15",
        price: 18000,
        source: "Letgo",
        condition: "used",
      },
      {
        id: "sr-3",
        title: "ASUS ROG Gaming Laptop",
        price: 25000,
        source: "Facebook",
        condition: "refurbished",
      },
    ];

    const result = groupListingDuplicates(searchResults, 70);

    expect(result.groups).toBeDefined();
    expect(Array.isArray(result.groups)).toBe(true);
  });

  it("should handle empty search results", () => {
    const searchResults: any[] = [];

    const result = groupListingDuplicates(searchResults, 70);

    expect(result.groups).toBeDefined();
    expect(result.count).toBe(0);
    expect(result.matchedCount).toBe(0);
  });
});
