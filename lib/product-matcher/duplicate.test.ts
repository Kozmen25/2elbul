import { vi, describe, it, expect, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));

vi.mock("@/lib/normalization", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/normalization")>();
  return { ...actual, extractProductSignals: vi.fn() };
});

vi.mock("@/lib/duplicate-engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/duplicate-engine")>();
  return { ...actual, groupDuplicates: vi.fn() };
});

import { groupListingDuplicatesByKey } from "./duplicate";
import { extractProductSignals } from "@/lib/normalization";
import { groupDuplicates as groupDuplicatesEngine } from "@/lib/duplicate-engine";
import type { ComparisonListing } from "./types";
import type { ProductSignals } from "@/lib/normalization";

function makeListing(
  overrides: Partial<ComparisonListing> & { id: string | number; title: string },
): ComparisonListing {
  return {
    id: overrides.id,
    title: overrides.title,
    price: overrides.price ?? 100,
    source: overrides.source ?? "test",
    sourceId: overrides.sourceId,
    condition: overrides.condition ?? "Yenilenmiş",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

const BASE_SIGNALS: ProductSignals = {
  brand: null,
  model: null,
  storage: null,
  ram: null,
  color: null,
  category: "telefon",
  normalizedKey: "",
};

// ---------------------------------------------------------------------------
// H6 — extractProductSignals cache
// ---------------------------------------------------------------------------
describe("H6 — extractProductSignals cache", () => {
  it("calls extractProductSignals once per unique title across both phases", () => {
    (extractProductSignals as ReturnType<typeof vi.fn>).mockReturnValue({
      ...BASE_SIGNALS,
      brand: "Apple",
      normalizedKey: "apple-unique-key",
    });
    (groupDuplicatesEngine as ReturnType<typeof vi.fn>).mockReturnValue([]);

    groupListingDuplicatesByKey([
      makeListing({ id: 1, title: "iPhone 13 128GB" }),
      makeListing({ id: 2, title: "iPhone 13 128GB" }), // same title
    ]);

    // The cache prevents the second call — only 1 unique title
    expect(extractProductSignals).toHaveBeenCalledTimes(1);
  });

  it("never calls extractProductSignals a second time for a cache-hit title", () => {
    const callTracker = vi.fn();
    (extractProductSignals as ReturnType<typeof vi.fn>).mockImplementation(
      (title: string) => {
        callTracker(title);
        return {
          ...BASE_SIGNALS,
          brand: "Apple",
          normalizedKey: "apple-unique-key",
        };
      },
    );
    (groupDuplicatesEngine as ReturnType<typeof vi.fn>).mockReturnValue([]);

    groupListingDuplicatesByKey([
      makeListing({ id: 1, title: "iPhone 13 128GB" }),
      makeListing({ id: 2, title: "iPhone 13 256GB" }),
      makeListing({ id: 3, title: "iPhone 13 128GB" }), // cache hit
    ]);

    expect(callTracker).toHaveBeenCalledTimes(2);
  });

  it("treats different titles as separate cache entries", () => {
    (extractProductSignals as ReturnType<typeof vi.fn>).mockReturnValue({
      ...BASE_SIGNALS,
      brand: "Apple",
      normalizedKey: "apple-unique-key",
    });
    (groupDuplicatesEngine as ReturnType<typeof vi.fn>).mockReturnValue([]);

    groupListingDuplicatesByKey([
      makeListing({ id: 1, title: "iPhone 13 128GB" }),
      makeListing({ id: 2, title: "Samsung S22 128GB" }),
      makeListing({ id: 3, title: "Xiaomi Note 11" }),
    ]);

    expect(extractProductSignals).toHaveBeenCalledTimes(3);
  });

  it("still caches correctly when titles repeat in phase 1 (brand) across the same brand", () => {
    const callTracker = vi.fn();
    (extractProductSignals as ReturnType<typeof vi.fn>).mockImplementation(
      (title: string) => {
        callTracker(title);
        return {
          ...BASE_SIGNALS,
          brand: "Apple",
          normalizedKey: title.includes("128")
            ? "apple-iphone-13-128gb"
            : "apple-iphone-13-256gb",
        };
      },
    );
    (groupDuplicatesEngine as ReturnType<typeof vi.fn>).mockReturnValue([]);

    // 5 listings, 3 unique titles: the repeated "iPhone 13 128GB" should be cached
    groupListingDuplicatesByKey([
      makeListing({ id: 1, title: "iPhone 13 128GB" }),
      makeListing({ id: 2, title: "iPhone 13 256GB" }),
      makeListing({ id: 3, title: "iPhone 13 128GB" }),
      makeListing({ id: 4, title: "iPhone 13 256GB" }),
      makeListing({ id: 5, title: "iPhone 13 128GB" }),
    ]);

    expect(callTracker).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// H5 — three separate groupDuplicatesEngine calls
// ---------------------------------------------------------------------------
describe("H5 — null-brand group boundary", () => {
  function brandSignal(brand: string, nk: string): ProductSignals {
    return { ...BASE_SIGNALS, brand, normalizedKey: nk };
  }

  /**
   * Helper: builds a signal that sends the listing to the null-key-within-brand
   * bucket by making normalizedKey match the title-derived fallback.
   */
  function nullKeySignal(brand: string, title: string): ProductSignals {
    return {
      ...BASE_SIGNALS,
      brand,
      normalizedKey: title.toLowerCase().replace(/\s+/g, "-"),
    };
  }

  const NULL_BRAND: ProductSignals = { ...BASE_SIGNALS, brand: null };

  it("calls groupDuplicatesEngine three times when all three buckets have items", () => {
    (extractProductSignals as ReturnType<typeof vi.fn>).mockImplementation(
      (title: string) => {
        if (title === "iPhone 13") return brandSignal("Apple", "apple-unique-key");
        if (title === "Galaxy Tab")
          return nullKeySignal("Samsung", title);
        return NULL_BRAND;
      },
    );
    (groupDuplicatesEngine as ReturnType<typeof vi.fn>).mockReturnValue([]);

    groupListingDuplicatesByKey([
      makeListing({ id: 1, title: "iPhone 13" }), // brand-matched
      makeListing({ id: 2, title: "Galaxy Tab" }), // null-key-within-brand
      makeListing({ id: 3, title: "Generic" }),    // null-brand
    ]);

    expect(groupDuplicatesEngine).toHaveBeenCalledTimes(3);
  });

  it("only makes one engine call when all items are brand-matched", () => {
    (extractProductSignals as ReturnType<typeof vi.fn>).mockImplementation(
      () => brandSignal("Apple", "apple-unique-key"),
    );
    (groupDuplicatesEngine as ReturnType<typeof vi.fn>).mockReturnValue([]);

    groupListingDuplicatesByKey([
      makeListing({ id: 1, title: "iPhone 13" }),
      makeListing({ id: 2, title: "iPhone 14" }),
    ]);

    expect(groupDuplicatesEngine).toHaveBeenCalledTimes(1);
  });

  it("skips engine call for an empty null-brand bucket", () => {
    (extractProductSignals as ReturnType<typeof vi.fn>).mockImplementation(
      (title: string) => {
        if (title === "iPhone 13") return brandSignal("Apple", "apple-unique-key");
        return nullKeySignal("Apple", title);
      },
    );
    (groupDuplicatesEngine as ReturnType<typeof vi.fn>).mockReturnValue([]);

    groupListingDuplicatesByKey([
      makeListing({ id: 1, title: "iPhone 13" }),
      makeListing({ id: 2, title: "iPhone 13 256GB" }),
    ]);

    // brand call + null-key call = 2 (no null-brand items)
    expect(groupDuplicatesEngine).toHaveBeenCalledTimes(2);
  });

  it("passes only null-brand items to the third engine call", () => {
    (extractProductSignals as ReturnType<typeof vi.fn>).mockImplementation(
      (title: string) => {
        if (title === "iPhone 13") return brandSignal("Apple", "apple-unique-key");
        if (title === "Galaxy Tab")
          return nullKeySignal("Samsung", title);
        return NULL_BRAND;
      },
    );
    (groupDuplicatesEngine as ReturnType<typeof vi.fn>).mockReturnValue([]);

    groupListingDuplicatesByKey([
      makeListing({ id: 1, title: "iPhone 13" }),
      makeListing({ id: 2, title: "Galaxy Tab" }),
      makeListing({ id: 3, title: "Generic A" }),
      makeListing({ id: 4, title: "Generic B" }),
    ]);

    const calls = (groupDuplicatesEngine as ReturnType<typeof vi.fn>).mock
      .calls;
    // calls[0] = brand-matched, calls[1] = null-key, calls[2] = null-brand
    expect(calls.length).toBe(3);

    const nullBrandInputs = (calls[2][0] as Array<{ id: string | number }>).map(
      (i: { id: string | number }) => i.id,
    );
    expect(nullBrandInputs).toEqual(
      expect.arrayContaining([3, 4]),
    );
    expect(nullBrandInputs).not.toContain(1);
    expect(nullBrandInputs).not.toContain(2);
  });

  it("produces groups merged from all three engine calls in the result", () => {
    (extractProductSignals as ReturnType<typeof vi.fn>).mockImplementation(
      (title: string) => {
        if (title === "iPhone 13") return brandSignal("Apple", "apple-unique-key");
        if (title === "Galaxy Tab")
          return nullKeySignal("Samsung", title);
        return NULL_BRAND;
      },
    );

    // Return different group counts per call
    (groupDuplicatesEngine as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce([{ key: "brand-group", items: [], duplicates: [] }])
      .mockReturnValueOnce([{ key: "nullkey-group", items: [], duplicates: [] }])
      .mockReturnValueOnce([{ key: "nullbrand-group", items: [], duplicates: [] }]);

    const result = groupListingDuplicatesByKey([
      makeListing({ id: 1, title: "iPhone 13" }),
      makeListing({ id: 2, title: "Galaxy Tab" }),
      makeListing({ id: 3, title: "Generic" }),
    ]);

    expect(result.groups).toHaveLength(3);
    expect(result.groups.map((g) => (g as { key?: string }).key)).toEqual([
      "brand-group",
      "nullkey-group",
      "nullbrand-group",
    ]);
  });

  it("reports comparisonsBefore as flat O(n²) and comparisonsAfter as sum of per-bucket O(n²)", () => {
    (extractProductSignals as ReturnType<typeof vi.fn>).mockImplementation(
      (title: string) => {
        if (title === "iPhone 13") return brandSignal("Apple", "apple-unique-key");
        if (title === "Galaxy Tab")
          return nullKeySignal("Samsung", title);
        return NULL_BRAND;
      },
    );
    (groupDuplicatesEngine as ReturnType<typeof vi.fn>).mockReturnValue([]);

    const result = groupListingDuplicatesByKey([
      makeListing({ id: 1, title: "iPhone 13" }),
      makeListing({ id: 2, title: "Galaxy Tab" }),
      makeListing({ id: 3, title: "Generic" }),
      makeListing({ id: 4, title: "Another Generic" }),
    ]);

    // 4 items → flat 6 comparisons
    expect(result.comparisonsBefore).toBe(6);
    // 1 brand item = 0, 1 null-key item = 0, 2 null-brand items = 1
    expect(result.comparisonsAfter).toBe(1);
  });
});
