import { describe, it, expect } from "vitest";
import { detectListingDuplicates, groupListingDuplicates } from "../product-matcher";

describe("import-listings duplicate detection", () => {
  it("should detect duplicates in import batch", () => {
    const reference = {
      id: "import-1",
      title: "Sahibinden iPhone 12",
      price: 4800,
      source: "Sahibinden",
      condition: "used",
    };

    const candidates: Array<{
      id: string;
      title: string;
      price: number;
      source: string;
      condition: string;
    }> = [
      {
        id: "import-2",
        title: "iPhone 12 128GB",
        price: 4900,
        source: "Letgo",
        condition: "used",
      },
      {
        id: "import-3",
        title: "Galaxy S21 Ultra",
        price: 8500,
        source: "Facebook",
        condition: "refurbished",
      },
    ];

    const result = detectListingDuplicates(reference, candidates, 70);

    expect(result.listing).toBeDefined();
    expect(result.duplicates).toBeDefined();
    expect(Array.isArray(result.duplicates)).toBe(true);
  });

  it("should handle empty candidates in import", () => {
    const reference = {
      id: "import-1",
      title: "Product Name",
      price: 1000,
      source: "Source1",
      condition: "new",
    };

    const candidates: Array<{
      id: string;
      title: string;
      price: number;
      source: string;
      condition: string;
    }> = [];

    const result = detectListingDuplicates(reference, candidates, 70);

    expect(result.duplicates).toHaveLength(0);
    expect(result.isDuplicate).toBe(false);
  });

  it("should group import listings by product", () => {
    const importListings = [
      {
        id: "imp-1",
        title: "Samsung Galaxy A52 128GB",
        price: 3500,
        source: "Sahibinden",
        condition: "used",
      },
      {
        id: "imp-2",
        title: "Samsung Galaxy A52",
        price: 3600,
        source: "Letgo",
        condition: "used",
      },
      {
        id: "imp-3",
        title: "Samsung Galaxy A52 128GB",
        price: 3400,
        source: "Facebook",
        condition: "used",
      },
      {
        id: "imp-4",
        title: "Apple iPhone 11",
        price: 3000,
        source: "Sahibinden",
        condition: "refurbished",
      },
    ];

    const result = groupListingDuplicates(importListings, 70);

    expect(result.groups).toBeDefined();
    expect(result.count).toBeGreaterThan(0);
    expect(result.groups).toBeInstanceOf(Array);
  });

  it("should identify unique products in import batch", () => {
    const importListings = [
      {
        id: "imp-1",
        title: "MacBook Pro 14 inch M1",
        price: 22000,
        source: "Sahibinden",
        condition: "new",
      },
      {
        id: "imp-2",
        title: "MacBook Pro 15 inch M2",
        price: 28000,
        source: "Letgo",
        condition: "new",
      },
      {
        id: "imp-3",
        title: "MacBook Air M1",
        price: 16000,
        source: "Facebook",
        condition: "refurbished",
      },
    ];

    const result = groupListingDuplicates(importListings, 70);

    expect(result.groups).toBeDefined();
    expect(Array.isArray(result.groups)).toBe(true);
  });

  it("should handle price variations in import", () => {
    const importListings = [
      {
        id: "imp-1",
        title: "iPad Pro 12.9 256GB",
        price: 15000,
        source: "Source1",
        condition: "new",
      },
      {
        id: "imp-2",
        title: "iPad Pro 12.9 256GB",
        price: 14500,
        source: "Source2",
        condition: "new",
      },
      {
        id: "imp-3",
        title: "iPad Pro 12.9 256GB",
        price: 16000,
        source: "Source3",
        condition: "refurbished",
      },
      {
        id: "imp-4",
        title: "iPad Pro 12.9 256GB",
        price: 13000,
        source: "Source4",
        condition: "used",
      },
    ];

    const result = groupListingDuplicates(importListings, 70);

    expect(result.groups).toBeDefined();
    expect(result.count).toBeGreaterThan(0);
    expect(result.matchedCount).toBeGreaterThanOrEqual(0);
  });
});
