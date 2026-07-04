import { describe, expect, it } from "vitest";
import {
  resolveSearchIntent,
  scoreSearchResult,
  SEARCH_CATEGORY_TREE,
} from "./search-intent";

function termsFor(query: string) {
  return resolveSearchIntent(query).terms.map((term) => term.term);
}

describe("search intent over category taxonomy", () => {
  it("keeps the platform-wide top level taxonomy available", () => {
    const slugs = SEARCH_CATEGORY_TREE.map((category) => category.slug);

    expect(slugs).toEqual(
      expect.arrayContaining([
        "vehicles",
        "real-estate",
        "shopping",
        "parts-accessories",
        "industrial",
        "life-services",
        "animals",
      ]),
    );
  });

  it("expands broad phone searches into common brands", () => {
    expect(termsFor("telefon")).toEqual(
      expect.arrayContaining(["iphone", "samsung", "xiaomi"]),
    );
  });

  it("expands computer searches into laptop and notebook terms", () => {
    expect(termsFor("bilgisayar")).toEqual(
      expect.arrayContaining(["laptop", "macbook", "notebook"]),
    );
  });

  it("keeps specific iphone search focused", () => {
    const intent = resolveSearchIntent("iphone");
    const terms = intent.terms.map((term) => term.term);

    expect(terms[0]).toBe("iphone");
    expect(terms).toContain("telefon");
    expect(terms).not.toContain("samsung");
    expect(terms).not.toContain("xiaomi");
  });

  it("keeps specific ps5 search focused around PlayStation", () => {
    const terms = termsFor("ps5");

    expect(terms).toEqual(expect.arrayContaining(["ps5", "playstation", "konsol"]));
    expect(terms).not.toContain("xbox");
  });

  it("scores relevant broad category results higher", () => {
    const intent = resolveSearchIntent("telefon");
    const iphoneScore = scoreSearchResult(intent, {
      title: "iPhone 13 128 GB temiz",
      productName: "iPhone 13",
    });
    const tableScore = scoreSearchResult(intent, {
      title: "Ahşap yemek masası",
      productName: "Mobilya",
    });

    expect(iphoneScore).toBeGreaterThan(tableScore);
  });
});
