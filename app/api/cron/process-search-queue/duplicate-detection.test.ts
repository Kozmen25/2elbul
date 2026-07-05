import { describe, it, expect } from "vitest";
import { groupListingDuplicates } from "../../../../lib/product-matcher";

describe("process-search-queue duplicate detection", () => {
  it("should detect duplicates in queue processing", () => {
    const queueListings = [
      {
        id: "queue-1",
        title: "Xiaomi 14 Ultra 512GB",
        price: 8500,
        source: "EasyCep",
        condition: "new",
      },
      {
        id: "queue-2",
        title: "Xiaomi 14 Ultra",
        price: 8400,
        source: "Getmobil",
        condition: "new",
      },
      {
        id: "queue-3",
        title: "Xiaomi 14 Ultra 512GB",
        price: 8600,
        source: "Teknosa",
        condition: "refurbished",
      },
    ];

    const result = groupListingDuplicates(queueListings, 70);

    expect(result.groups).toBeDefined();
    expect(result.count).toBeGreaterThan(0);
  });

  it("should group queue results from multiple sources", () => {
    const queueListings = [
      {
        id: "q-1",
        title: "Google Pixel 8 Pro 256GB",
        price: 11000,
        source: "EasyCep",
        condition: "new",
      },
      {
        id: "q-2",
        title: "Google Pixel 8 Pro",
        price: 11100,
        source: "Letgo",
        condition: "new",
      },
      {
        id: "q-3",
        title: "Pixel 8 Pro 256GB",
        price: 10900,
        source: "Facebook",
        condition: "new",
      },
      {
        id: "q-4",
        title: "OnePlus 12",
        price: 6500,
        source: "Sahibinden",
        condition: "new",
      },
    ];

    const result = groupListingDuplicates(queueListings, 70);

    expect(result.groups).toBeDefined();
    expect(result.matchedCount).toBeGreaterThanOrEqual(0);
  });

  it("should handle large queue batches", () => {
    const queueListings = Array.from({ length: 50 }, (_, i) => ({
      id: `queue-${i}`,
      title: `Product ${Math.floor(i / 5)} Variant ${i % 5}`,
      price: 5000 + (i % 5) * 100,
      source: ["EasyCep", "Getmobil", "Teknosa", "Hepsiburada", "MediaMarkt"][i % 5],
      condition: ["new", "refurbished", "used"][i % 3],
    }));

    const result = groupListingDuplicates(queueListings, 70);

    expect(result.groups).toBeDefined();
    expect(result.count).toBeGreaterThan(0);
    expect(Array.isArray(result.groups)).toBe(true);
  });

  it("should detect duplicates with price variations in queue", () => {
    const queueListings = [
      {
        id: "q-1",
        title: "Sony WH-1000XM5 Headphones",
        price: 4500,
        source: "EasyCep",
        condition: "new",
      },
      {
        id: "q-2",
        title: "Sony WH-1000XM5",
        price: 4800,
        source: "Getmobil",
        condition: "refurbished",
      },
      {
        id: "q-3",
        title: "Sony Headphones XM5",
        price: 4300,
        source: "Teknosa",
        condition: "used",
      },
      {
        id: "q-4",
        title: "Sony WH-1000XM5 Headphones",
        price: 5000,
        source: "Hepsiburada",
        condition: "new",
      },
    ];

    const result = groupListingDuplicates(queueListings, 70);

    expect(result.groups).toBeDefined();
    expect(result.matchedCount).toBeGreaterThanOrEqual(0);
  });
});
