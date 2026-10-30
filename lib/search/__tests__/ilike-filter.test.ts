import { describe, expect, it } from "vitest";
import { buildIlikeOrFilter, containsPattern, ilikeClause } from "../ilike-filter";

describe("ilikeClause", () => {
  it("wraps a plain term in a quoted ilike pattern", () => {
    expect(ilikeClause("name", "iphone 13")).toBe('name.ilike."%iphone 13%"');
  });

  it("escapes commas and parentheses that would otherwise break .or() syntax", () => {
    expect(ilikeClause("name", "iphone 13, (128gb)")).toBe(
      'name.ilike."%iphone 13, (128gb)%"',
    );
  });

  it("escapes double quotes and backslashes inside the term", () => {
    expect(ilikeClause("name", 'a "b" c\\d')).toBe(
      'name.ilike."%a \\"b\\" c\\\\d%"',
    );
  });

  it("escapes literal SQL LIKE wildcards so they are matched literally", () => {
    expect(ilikeClause("name", "50% indirim")).toBe('name.ilike."%50\\% indirim%"');
    expect(ilikeClause("name", "a_b")).toBe('name.ilike."%a\\_b%"');
  });
});

describe("buildIlikeOrFilter", () => {
  it("joins multiple terms with commas", () => {
    expect(buildIlikeOrFilter("title", ["laptop", "notebook"])).toBe(
      'title.ilike."%laptop%",title.ilike."%notebook%"',
    );
  });

  it("returns an empty string for no terms", () => {
    expect(buildIlikeOrFilter("title", [])).toBe("");
  });
});

describe("containsPattern", () => {
  it("wraps a term for a single .ilike() call", () => {
    expect(containsPattern("iphone 13, (128gb)")).toBe("%iphone 13, (128gb)%");
  });

  it("escapes LIKE wildcards and backslashes but not quotes", () => {
    expect(containsPattern('50% "a_b" c\\d')).toBe('%50\\% "a\\_b" c\\\\d%');
  });
});
