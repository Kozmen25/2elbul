import { describe, expect, it } from "vitest";
import { toBigintId, toBigintIds } from "./supabase-ids";

describe("toBigintId", () => {
  it("passes numbers through and parses numeric strings", () => {
    expect(toBigintId(42)).toBe(42);
    expect(toBigintId("42")).toBe(42);
  });
});

describe("toBigintIds", () => {
  it("converts mixed ids and drops non-integers", () => {
    expect(toBigintIds(["1", 2, "abc", "3.5", ""])).toEqual([1, 2]);
  });

  it("accepts any iterable", () => {
    expect(toBigintIds(new Set(["7", "8"]))).toEqual([7, 8]);
  });
});
