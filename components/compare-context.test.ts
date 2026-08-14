import { describe, expect, it } from "vitest";
import {
  buildCompareUrl,
  selectNextEntry,
  type CompareSelectionEntry,
} from "@/components/compare-context";

const entry = (listingId: string, productName = listingId): CompareSelectionEntry => ({
  listingId,
  productName,
});

describe("selectNextEntry", () => {
  it("adds the first entry to an empty selection", () => {
    const result = selectNextEntry([], entry("listing-1", "iPhone 13"));
    expect(result.selection).toEqual([entry("listing-1", "iPhone 13")]);
    expect(result.overflow).toBe(false);
  });

  it("adds a second entry without overflow", () => {
    const current = [entry("listing-1", "iPhone 13")];
    const result = selectNextEntry(current, entry("listing-2", "Galaxy S22"));
    expect(result.selection).toHaveLength(2);
    expect(result.selection[1].listingId).toBe("listing-2");
    expect(result.overflow).toBe(false);
  });

  it("adds a third entry without overflow", () => {
    const current = [
      entry("listing-1", "iPhone 13"),
      entry("listing-2", "Galaxy S22"),
    ];
    const result = selectNextEntry(current, entry("listing-3", "Pixel 8"));
    expect(result.selection).toHaveLength(3);
    expect(result.selection[2].listingId).toBe("listing-3");
    expect(result.overflow).toBe(false);
  });

  it("adds a fourth entry without overflow", () => {
    const current = [
      entry("listing-1", "iPhone 13"),
      entry("listing-2", "Galaxy S22"),
      entry("listing-3", "Pixel 8"),
    ];
    const result = selectNextEntry(current, entry("listing-4", "Redmi Note 12"));
    expect(result.selection).toHaveLength(4);
    expect(result.selection[3].listingId).toBe("listing-4");
    expect(result.overflow).toBe(false);
  });

  it("drops the oldest entry and marks overflow on the fifth selection", () => {
    const current = [
      entry("listing-1", "iPhone 13"),
      entry("listing-2", "Galaxy S22"),
      entry("listing-3", "Pixel 8"),
      entry("listing-4", "Redmi Note 12"),
    ];
    const result = selectNextEntry(current, entry("listing-5", "OnePlus 12"));
    expect(result.selection).toHaveLength(4);
    expect(result.selection[0].listingId).toBe("listing-2");
    expect(result.selection[1].listingId).toBe("listing-3");
    expect(result.selection[2].listingId).toBe("listing-4");
    expect(result.selection[3].listingId).toBe("listing-5");
    expect(result.overflow).toBe(true);
  });

  it("does not duplicate an already-selected listing", () => {
    const current = [entry("listing-1", "iPhone 13")];
    const result = selectNextEntry(current, entry("listing-1", "iPhone 13"));
    expect(result.selection).toEqual(current);
    expect(result.overflow).toBe(false);
  });
});

describe("buildCompareUrl", () => {
  it("returns null when fewer than two listings are selected", () => {
    expect(buildCompareUrl([])).toBeNull();
    expect(buildCompareUrl([entry("listing-1")])).toBeNull();
  });

  it("builds the compare URL from two selected listings (comma-separated)", () => {
    const url = buildCompareUrl([entry("listing-1"), entry("listing-2")]);
    expect(url).toBe("/compare?ids=listing-1,listing-2");
  });

  it("builds the compare URL from three selected listings", () => {
    const url = buildCompareUrl([
      entry("listing-1"),
      entry("listing-2"),
      entry("listing-3"),
    ]);
    expect(url).toBe("/compare?ids=listing-1,listing-2,listing-3");
  });

  it("builds the compare URL from four selected listings", () => {
    const url = buildCompareUrl([
      entry("listing-1"),
      entry("listing-2"),
      entry("listing-3"),
      entry("listing-4"),
    ]);
    expect(url).toBe("/compare?ids=listing-1,listing-2,listing-3,listing-4");
  });

  it("encodes special characters in listing ids", () => {
    const url = buildCompareUrl([entry("a&b"), entry("c d")]);
    expect(url).toBe("/compare?ids=a%26b,c%20d");
  });

  it("still works for exactly 2 entries (no longer returns null)", () => {
    const url = buildCompareUrl([entry("a"), entry("b")]);
    expect(url).toBe("/compare?ids=a,b");
  });
});
