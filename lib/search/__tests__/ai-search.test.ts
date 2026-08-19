import { describe, it, expect } from "vitest";
import { buildSearchPlan } from "../ai/planner";
import { isPlanValid } from "../ai/structured-search-plan";
import { buildSearchExplanation } from "../ai/explanation";
import {
  parsePriceIntent,
  parseReferenceProduct,
  parseSortAndPreferences,
  parseExclusions,
  extractPlanExtras,
} from "../ai/turkish-nl-parser";

// ─── Planner: hybrid routing + PUE-boundary guarantees ───

describe("planner routing (hybrid §13)", () => {
  it("routes a plain keyword to fast_search with zero structured signal", () => {
    const { plan } = buildSearchPlan("telefon");
    expect(plan.mode).toBe("fast_search");
    expect(plan.confidence).toBe(0);
    expect(plan.priceRange.min).toBeNull();
    expect(plan.priceRange.max).toBeNull();
    expect(plan.sort).toBeNull();
    expect(isPlanValid(plan)).toBe(true);
  });

  it("routes a price-carrying query to ai_search", () => {
    const { plan } = buildSearchPlan("10 bin TL altı telefon");
    expect(plan.mode).toBe("ai_search");
    expect(plan.confidence).toBeGreaterThan(0);
    expect(plan.priceRange.max).toBe(10000);
    expect(isPlanValid(plan)).toBe(true);
  });

  it("routes a comparator query to ai_search with relation captured", () => {
    const { plan } = buildSearchPlan("iPhone 15 Pro'dan ucuz telefon");
    expect(plan.mode).toBe("ai_search");
    expect(plan.referenceProduct).not.toBeNull();
    expect(plan.referenceProduct!.name).toBe("iphone 15 pro");
    expect(plan.referenceProduct!.relation).toBe("cheaper_than");
  });

  it("routes a sort word to ai_search", () => {
    const { plan } = buildSearchPlan("en ucuz PS5");
    expect(plan.mode).toBe("ai_search");
    expect(plan.sort).toBe("price-asc");
  });
});

describe("planner never authors product truth (§21 PUE override)", () => {
  // "xyz random stuff" has no recognized product — the live intent must leave
  // productType null, and the planner must never force-type it, even under an
  // ai_search price signal.
  it("keeps productType null when the live intent says null, even in ai_search", () => {
    const { plan } = buildSearchPlan("xyz random 10 bin altı stuff");
    expect(plan.mode).toBe("ai_search");
    expect(plan.intent.productType).toBeNull();
  });

  it("propagates a real product type from the live intent verbatim", () => {
    // "ekran koruyucu" triggers the live intent's accessory pattern -> accessory.
    const { plan } = buildSearchPlan("iPhone 15 ekran koruyucu");
    expect(plan.intent.productType).toBe("accessory");
    expect(plan.intent.isAccessorySearch).toBe(true);
  });

  it("keeps accessory queries as accessories when a price is added", () => {
    const { plan } = buildSearchPlan("iPhone 15 ekran koruyucu 500 TL altı");
    expect(plan.intent.isAccessorySearch).toBe(true);
  });
});

// ─── Parser: price intent ───

describe("parsePriceIntent", () => {
  it("parses 'aşağı' below-bounds", () => {
    const r = parsePriceIntent("10 bin altı telefon");
    expect(r.range.max).toBe(10000);
    expect(r.range.min).toBeNull();
  });

  it("parses 'üzeri' above-bounds", () => {
    const r = parsePriceIntent("3 bin üzeri kulaklık");
    expect(r.range.min).toBe(3000);
    expect(r.range.max).toBeNull();
  });

  it("parses an explicit band '10-15 bin'", () => {
    const r = parsePriceIntent("10-15 bin arası laptop");
    expect(r.range.min).toBe(10000);
    expect(r.range.max).toBe(15000);
    expect(r.signals).toBe(2);
  });

  it("parses 'civarı' as a center with tolerance", () => {
    const r = parsePriceIntent("10 bin civarı telefon");
    expect(r.range.target).toBe(10000);
    expect(r.range.tolerance).toBe(0.1);
  });

  it("treats a bare number as a center, never a fabricated list", () => {
    const r = parsePriceIntent("telefon 10000");
    expect(r.range.target).toBe(10000);
    expect(r.range.min).toBeNull();
    expect(r.range.max).toBeNull();
  });

  it("returns empty on garbage with no signal", () => {
    const r = parsePriceIntent("xyz qwerty");
    expect(r.signals).toBe(0);
    expect(r.range.min).toBeNull();
    expect(r.range.max).toBeNull();
  });
});

// ─── Parser: reference product ───

describe("parseReferenceProduct", () => {
  it("reads cheaper_than direction", () => {
    const ref = parseReferenceProduct("iPhone 15 Pro'dan ucuz telefon");
    expect(ref).not.toBeNull();
    expect(ref!.name).toBe("iphone 15 pro");
    expect(ref!.relation).toBe("cheaper_than");
  });

  it("reads pricier_than direction", () => {
    const ref = parseReferenceProduct("galaxy s24'ten pahalı");
    expect(ref!.relation).toBe("pricier_than");
  });

  it("never fabricates a price for the reference", () => {
    const ref = parseReferenceProduct("iPhone 15 Pro'dan ucuz telefon");
    expect(ref!.rawPhrase).toContain("ucuz");
    // There is no price field on ReferenceProduct by design.
    expect("price" in (ref as unknown as Record<string, unknown>)).toBe(false);
  });
});

// ─── Parser: sort / conditions / exclusions ───

describe("parseSortAndPreferences", () => {
  it("maps 'en ucuz' to price-asc using existing client vocab", () => {
    const { sort } = parseSortAndPreferences("en ucuz PS5");
    expect(sort).toBe("price-asc");
  });

  it("maps 'fiyat performans' to best-opportunity", () => {
    const { sort } = parseSortAndPreferences("fiyat performans laptop");
    expect(sort).toBe("best-opportunity");
  });

  it("captures 'garantili' and 'sıfır' condition intents", () => {
    const { conditions } = parseSortAndPreferences("garantili sıfır telefon");
    expect(conditions).toContain("garantili");
    expect(conditions).toContain("sifir");
  });
});

describe("parseExclusions", () => {
  it("flags part/service exclusion terms", () => {
    const ex = parseExclusions("kasa ve batarya");
    expect(ex).toContain("kasa");
    expect(ex).toContain("batarya");
  });

  it("returns empty when the query is about the product itself", () => {
    expect(parseExclusions("telefon")).toEqual([]);
  });
});

// ─── extractPlanExtras composition ───

describe("extractPlanExtras", () => {
  it("composes all parsers into a single extras object", () => {
    const extras = extractPlanExtras("10 bin altı iPhone 15 Pro'dan ucuz garantili telefon");
    expect(extras.priceRange.max).toBe(10000);
    expect(extras.referenceProduct).not.toBeNull();
    expect(extras.conditions).toContain("garantili");
    expect(extras.confidence).toBeGreaterThan(0);
  });

  it("keeps confidence in [0,1]", () => {
    for (const q of ["telefon", "10 bin altı telefon", "en ucuz PS5"]) {
      const c = extractPlanExtras(q).confidence;
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    }
  });
});

// ─── Explanation grounding: never invents numbers (§21) ───

describe("buildSearchExplanation grounding", () => {
  const basePlan = buildSearchPlan("10 bin altı telefon").plan;

  it("echoes the user's own query, not fabricated market prose", () => {
    const text = buildSearchExplanation({
      plan: basePlan,
      products: [],
    });
    expect(text).toContain("10 bin altı telefon");
    expect(text).toContain("Eşleşen ürün bulunamadı");
  });

  it("lifts existing prose verbatim instead of recomputing", () => {
    const text = buildSearchExplanation({
      plan: basePlan,
      products: [
        {
          name: "Test Telefon",
          slug: "test-telefon",
          decisionInsight: {
            smartPrice: { summary: "GERÇEK akıllı fiyat yorumu" },
          } as never,
        },
      ],
    });
    expect(text).toContain("GERÇEK akıllı fiyat yorumu");
  });

  it("never fills an absent grounding field with a guessed number", () => {
    const text = buildSearchExplanation({
      plan: basePlan,
      products: [
        {
          name: "Yalın Ürün",
          slug: "yalin-urun",
          // no decisionInsight / marketSummary / etc. — nothing to lift
        },
      ],
    });
    // It must admit the truth is unavailable rather than inventing a figure.
    expect(text).not.toMatch(/[0-9]+\s*TL/);
    expect(text).toContain("yeterli fiyat yorumu");
  });

  it("renders nothing structurally broken when the plan is a safe fast_search", () => {
    const text = buildSearchExplanation({
      plan: buildSearchPlan("telefon").plan,
      products: [],
    });
    expect(typeof text).toBe("string");
    expect(text.length).toBeGreaterThan(0);
  });
});

// ─── Negative / safety guarantees (§21) ───

describe("safety guarantees", () => {
  it("never lets a null product-type intent leak into a forced type", () => {
    for (const q of ["xyz 5 bin", "rastgele 5 bin altı"]) {
      const { plan } = buildSearchPlan(q);
      // If missing, productType is null — the route only filters when non-null.
      expect(plan.intent.productType).toBeNull();
    }
  });

  it("fast_search keeps signal fields empty so the existing pipeline runs untouched", () => {
    const { plan } = buildSearchPlan("telefon");
    expect(plan.priceRange.min).toBeNull();
    expect(plan.priceRange.max).toBeNull();
    expect(plan.exclusions).toEqual([]);
    expect(plan.conditions).toEqual([]);
    expect(plan.referenceProduct).toBeNull();
    expect(plan.sort).toBeNull();
  });
});
