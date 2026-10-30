import { describe, expect, it, beforeEach } from "vitest";
import {
  createSynonymRegistry,
  getSynonymRegistry,
  resetSynonymRegistryForTests,
} from "../synonym-registry";
import {
  expandSearchQuery,
  getExpandedSearchTerms,
  getSuggestionSearchTerms,
  limitSearchTerms,
} from "../query-expansion";

describe("SynonymRegistry", () => {
  beforeEach(() => {
    resetSynonymRegistryForTests();
  });

  it("expands laptop ↔ notebook ↔ dizüstü equivalents", () => {
    const registry = getSynonymRegistry();
    const terms = registry.expandToken("laptop");

    expect(terms).toEqual(
      expect.arrayContaining(["laptop", "notebook", "dizustu"]),
    );
    expect(registry.expandToken("notebook")).toEqual(
      expect.arrayContaining(["laptop", "notebook"]),
    );
    expect(registry.expandToken("dizüstü")).toEqual(
      expect.arrayContaining(["laptop", "notebook"]),
    );
  });

  it("does not treat brands as synonyms", () => {
    const registry = getSynonymRegistry();
    expect(registry.findGroupByTerm("asus")).toBeUndefined();
    expect(registry.findGroupByTerm("lenovo")).toBeUndefined();
    expect(registry.expandToken("asus")).toEqual(["asus"]);
  });

  it("builds phrase variants for compound queries", () => {
    const result = getSynonymRegistry().expandQuery("asus notebook");

    expect(result.phraseVariants).toEqual(
      expect.arrayContaining(["asus laptop", "asus dizustu"]),
    );
    expect(result.matchedGroupIds).toContain("laptop");
  });

  it("matches multi-word phrases like cep telefonu", () => {
    const result = getSynonymRegistry().expandQuery("cep telefonu");

    expect(result.matchedGroupIds).toContain("phone");
    expect(result.terms).toEqual(
      expect.arrayContaining(["telefon", "smartphone", "cep telefonu"]),
    );
  });

  it("supports isolated registries for custom groups", () => {
    const registry = createSynonymRegistry([
      {
        id: "test",
        canonical: "alpha",
        terms: ["alpha", "beta"],
      },
    ]);

    expect(registry.expandToken("beta")).toEqual(
      expect.arrayContaining(["alpha", "beta"]),
    );
    expect(registry.findGroupByTerm("laptop")).toBeUndefined();
  });
});

describe("query expansion pipeline", () => {
  beforeEach(() => {
    resetSynonymRegistryForTests();
  });

  it("makes laptop and notebook resolve to overlapping retrieval terms", () => {
    const laptopTerms = getExpandedSearchTerms("laptop");
    const notebookTerms = getExpandedSearchTerms("notebook");

    expect(laptopTerms).toEqual(expect.arrayContaining(["notebook", "laptop"]));
    expect(notebookTerms).toEqual(expect.arrayContaining(["laptop", "notebook"]));
  });

  it("keeps bilgisayar expansion and adds synonym coverage", () => {
    const terms = getExpandedSearchTerms("bilgisayar");

    expect(terms).toEqual(
      expect.arrayContaining(["laptop", "notebook", "pc", "bilgisayar"]),
    );
  });

  it("expands compound brand + synonym queries", () => {
    const terms = getExpandedSearchTerms("asus notebook");

    expect(terms).toEqual(
      expect.arrayContaining(["asus notebook", "asus laptop", "notebook", "laptop"]),
    );
  });

  it("does not cross-contaminate focused brand queries", () => {
    const iphoneTerms = getExpandedSearchTerms("iphone");

    expect(iphoneTerms).toEqual(expect.arrayContaining(["iphone", "telefon"]));
    expect(iphoneTerms).not.toContain("samsung");
    expect(iphoneTerms).not.toContain("xiaomi");
  });

  it("exposes synonym metadata via expandSearchQuery", () => {
    const expanded = expandSearchQuery("notebook");

    expect(expanded.matchedSynonymGroupIds).toContain("laptop");
    expect(expanded.synonymTerms).toEqual(
      expect.arrayContaining(["laptop", "notebook"]),
    );
    expect(expanded.terms.length).toBeGreaterThan(0);
    expect(expanded.terms.length).toBeLessThanOrEqual(24);
  });

  it("caps suggestion terms tighter than full search", () => {
    const suggestionTerms = getSuggestionSearchTerms("bilgisayar");
    const searchTerms = getExpandedSearchTerms("bilgisayar");

    expect(suggestionTerms.length).toBeLessThanOrEqual(8);
    expect(suggestionTerms.length).toBeLessThanOrEqual(searchTerms.length);
    expect(suggestionTerms[0]).toBe("bilgisayar");
  });

  it("limitSearchTerms keeps original first and prefers shorter terms", () => {
    const limited = limitSearchTerms(
      ["bilgisayar", "gaming pc lenovo thinkpad very long", "pc", "laptop"],
      "bilgisayar",
      3,
    );

    expect(limited[0]).toBe("bilgisayar");
    expect(limited).toHaveLength(3);
    expect(limited).toContain("pc");
  });
});
