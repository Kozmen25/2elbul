import { describe, expect, it, vi } from "vitest";
import type { AiTaskResult } from "@/lib/ai/gateway";
import { classifyProductWithAi, parseClassification, type CategoryChoice } from "./classify-product";
import { judgeProductMatch, parseJudgement } from "./judge-match";
import {
  applyInterpretation,
  interpretSearchWithAi,
  parseInterpretation,
  shouldInterpretWithAi,
  type SearchInterpretation,
} from "./interpret-search";
import { buildSearchPlan } from "@/lib/search/ai/planner";

const categories: CategoryChoice[] = [
  { slug: "telefon", name: "Telefon", parentName: null },
  { slug: "konsol-playstation", name: "PlayStation", parentName: "Oyun Konsolu" },
];

const ok = (json: unknown): AiTaskResult => ({ status: "ok", json, model: "m", latencyMs: 1 });

describe("classification", () => {
  it("keeps only slugs from the provided taxonomy", () => {
    const parsed = parseClassification(
      { categorySlug: "uydurma", brand: "Apple", model: "iPhone 13", kind: "primary_product", canonicalName: "Apple iPhone 13", confidence: 0.9 },
      categories,
    );
    expect(parsed?.categorySlug).toBeNull();
    expect(parsed?.brand).toBe("Apple");
  });

  it("rejects unknown kinds and clamps confidence", () => {
    expect(parseClassification({ kind: "weird", confidence: 1 }, categories)).toBeNull();
    expect(parseClassification({ kind: "accessory", categorySlug: "telefon", confidence: 7 }, categories)?.confidence).toBe(1);
  });

  it("returns the classification, or passes skips and errors through", async () => {
    const run = vi.fn().mockResolvedValue(ok({ categorySlug: "konsol-playstation", brand: "Sony", model: "PS5", kind: "primary_product", canonicalName: "Sony PS5", confidence: 0.95 }));
    const outcome = await classifyProductWithAi("PS5 slim", categories, run);
    expect(outcome).toMatchObject({ status: "ok", classification: { categorySlug: "konsol-playstation" } });
    expect(String(run.mock.calls[0][0].userText)).toContain("konsol-playstation = Oyun Konsolu > PlayStation");

    expect(await classifyProductWithAi("x", categories, vi.fn().mockResolvedValue({ status: "skipped", reason: "budget" }))).toEqual({ status: "skipped", reason: "budget" });
    expect(await classifyProductWithAi("x", categories, vi.fn().mockResolvedValue({ status: "error", error: "boom" }))).toEqual({ status: "error", error: "boom" });
  });
});

describe("match judgement", () => {
  const candidates = [{ id: "1", name: "iPhone 13" }, { id: "2", name: "iPhone 13 Pro" }];

  it("only accepts a candidate it was given", () => {
    expect(parseJudgement({ matchedId: "99", confidence: 0.9, reason: "x" }, candidates)?.matchedId).toBeNull();
    expect(parseJudgement({ matchedId: "2", confidence: 0.9, reason: "x" }, candidates)?.matchedId).toBe("2");
  });

  it("does not call the model without candidates", async () => {
    const run = vi.fn();
    const outcome = await judgeProductMatch("iPhone", [], run);
    expect(run).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({ status: "ok", judgement: { matchedId: null } });
  });
});

describe("search interpretation", () => {
  it("sanitises prices, sort and terms from the model", () => {
    const parsed = parseInterpretation({
      isShoppingQuery: true,
      priceMin: 20000,
      priceMax: 10000,
      sort: "hack",
      exclusions: ["Kasasız", "kasasız", "x"],
      keywords: ["Gaming Laptop", 5],
      confidence: 0.8,
    });
    expect(parsed).toMatchObject({ priceMin: 10000, priceMax: 20000, sort: null, exclusions: ["kasasız"], keywords: ["gaming laptop"] });
  });

  it("asks the model only for multi-word queries the parser barely read", () => {
    const simple = buildSearchPlan("iphone 13").plan;
    expect(shouldInterpretWithAi(simple, "iphone 13")).toBe(false);
    const long = buildSearchPlan("oyun oynamak icin guclu bir bilgisayar").plan;
    expect(shouldInterpretWithAi(long, "oyun oynamak icin guclu bir bilgisayar")).toBe(true);
  });

  const interpretation: SearchInterpretation = {
    isShoppingQuery: true,
    priceMin: null,
    priceMax: 30000,
    sort: "price-asc",
    exclusions: ["kasasız"],
    keywords: ["gaming laptop"],
    confidence: 0.85,
  };

  it("fills only what the deterministic plan left empty and never touches intent", () => {
    const { plan } = buildSearchPlan("oyun oynamak icin guclu bir bilgisayar");
    const result = applyInterpretation(plan, interpretation, 0.7);

    expect(result.applied).toBe(true);
    expect(result.plan.mode).toBe("ai_search");
    expect(result.plan.priceRange.max).toBe(30000);
    expect(result.plan.sort).toBe("price-asc");
    expect(result.plan.intent).toBe(plan.intent);
    expect(result.extraTerms).toEqual(["gaming laptop"]);
  });

  it("keeps a deterministic price band over the model's", () => {
    const { plan } = buildSearchPlan("10 bin altı telefon");
    const result = applyInterpretation(plan, { ...interpretation, priceMax: 99999, sort: null, exclusions: [] }, 0.7);
    expect(result.plan.priceRange.max).toBe(plan.priceRange.max);
  });

  it("ignores unsure, non-shopping or structure-less answers", () => {
    const { plan } = buildSearchPlan("oyun oynamak icin guclu bir bilgisayar");
    expect(applyInterpretation(plan, { ...interpretation, confidence: 0.4 }, 0.7).applied).toBe(false);
    expect(applyInterpretation(plan, { ...interpretation, isShoppingQuery: false }, 0.7).applied).toBe(false);
    expect(applyInterpretation(plan, { ...interpretation, priceMax: null, sort: null, exclusions: [] }, 0.7).applied).toBe(false);
  });

  it("interprets through the injected runner", async () => {
    const run = vi.fn().mockResolvedValue(ok({ isShoppingQuery: true, priceMin: null, priceMax: 5000, sort: null, exclusions: [], keywords: [], confidence: 0.9 }));
    expect(await interpretSearchWithAi("5 bin altı telefon", run)).toMatchObject({ status: "ok", interpretation: { priceMax: 5000 } });
  });
});
