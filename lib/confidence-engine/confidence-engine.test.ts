import { describe, expect, it } from "vitest";
import { calculateDuplicateScoreForInputs } from "../duplicate-engine/engine";
import {
  compareListings,
  findDuplicateMatches,
  getHighestScoringDuplicate,
  groupDuplicates,
} from "../duplicate-engine/matcher";
import { createComparisonInput } from "../duplicate-engine/helpers";
import { calculateConfidence } from "./engine";
import {
  buildConfidenceReasons,
  buildDuplicateConfidenceInput,
  buildProductMatcherConfidenceInput,
  scoreSourceCount,
  scoreSourceReliability,
  scoreTaxonomySignal,
  scoreTitleSimilarity,
  toConfidenceMetadata,
} from "./helpers";
import { calculateConfidenceLevel, calculateConfidenceScore, clampScore } from "./scoring";
import type { ConfidenceResult, ConfidenceSignalScores } from "./types";

const fullSignals = {
  normalizationScore: 100,
  taxonomyScore: 100,
  brandScore: 100,
  modelScore: 100,
  storageScore: 100,
  ramScore: 100,
  variantScore: 100,
  duplicateScore: 100,
  priceConsistency: 100,
  titleSimilarity: 100,
  sourceCount: 100,
  sourceReliability: 100,
} satisfies ConfidenceSignalScores;

describe("confidence engine", () => {
  describe("calculateConfidenceScore", () => {
    it("returns 100 when every signal is perfect", () => {
      expect(calculateConfidenceScore(fullSignals)).toBe(100);
    });

    it("returns 100 for a single perfect signal", () => {
      expect(calculateConfidenceScore({ modelScore: 100 })).toBe(100);
    });

    it("returns the weighted average for mixed signals", () => {
      expect(
        calculateConfidenceScore({
          normalizationScore: 100,
          modelScore: 0,
        }),
      ).toBe(40);
    });

    it("ignores invalid signals", () => {
      expect(
        calculateConfidenceScore({
          modelScore: 100,
          brandScore: Number.NaN,
          sourceReliability: Number.POSITIVE_INFINITY,
        }),
      ).toBe(100);
    });

    it("returns 0 when no valid signals are present", () => {
      expect(calculateConfidenceScore({})).toBe(0);
    });
  });

  describe("calculateConfidenceLevel", () => {
    it.each([
      [100, "very-high"],
      [95, "very-high"],
      [85, "high"],
      [70, "medium"],
      [50, "low"],
      [49, "very-low"],
    ] as const)("maps %s to %s", (score, level) => {
      expect(calculateConfidenceLevel(score)).toBe(level);
    });
  });

  describe("clampScore", () => {
    it.each([
      [-10, 0],
      [0, 0],
      [42.4, 42],
      [100.6, 100],
      [150, 100],
    ] as const)("clamps %s to %s", (value, expected) => {
      expect(clampScore(value)).toBe(expected);
    });
  });

  describe("scoreSourceCount", () => {
    it.each([
      [0, 0],
      [1, 40],
      [2, 70],
      [3, 86],
      [4, 95],
      [10, 95],
    ] as const)("scores %s as %s", (count, expected) => {
      expect(scoreSourceCount(count)).toBe(expected);
    });

    it("returns null for missing source count", () => {
      expect(scoreSourceCount(undefined)).toBeNull();
    });
  });

  describe("scoreSourceReliability", () => {
    it.each([
      [120, undefined, undefined, 100],
      [-5, undefined, undefined, 0],
      [undefined, "EasyCep", undefined, 92],
      [undefined, "Getmobil", undefined, 90],
      [undefined, "Sahibinden", undefined, 68],
      [undefined, undefined, ["EasyCep", "Getmobil"], 91],
      [undefined, undefined, ["Unknown"], 65],
    ] as const)(
      "scores reliability from explicit value or source name",
      (reliability, sourceName, sourceNames, expected) => {
        const resolvedSourceNames = sourceNames ? [...sourceNames] : undefined;
        expect(scoreSourceReliability(reliability, sourceName, resolvedSourceNames)).toBe(expected);
      },
    );

    it("returns null when there is nothing to inspect", () => {
      expect(scoreSourceReliability(undefined)).toBeNull();
    });
  });

  describe("scoreTaxonomySignal", () => {
    it("returns null without category info", () => {
      expect(scoreTaxonomySignal(undefined)).toBeNull();
    });

    it.each([
      [
        {
          categoryLabel: "Telefon",
          taxonomyConfidence: "high",
          taxonomyHasFullPath: true,
          taxonomyAttributeCount: 4,
        },
        100,
      ],
      [
        {
          categoryLabel: "Telefon",
          taxonomyConfidence: "medium",
          taxonomyHasFullPath: false,
          taxonomyAttributeCount: 1,
        },
        74,
      ],
      [
        {
          categoryLabel: "Telefon",
          taxonomyConfidence: "low",
          taxonomyHasFullPath: false,
          taxonomyAttributeCount: 0,
        },
        46,
      ],
      [
        {
          categoryLabel: "Telefon",
          taxonomyHasFullPath: false,
          taxonomyAttributeCount: 0,
        },
        66,
      ],
    ] as const)("scores taxonomy context", (context, expected) => {
      expect(scoreTaxonomySignal(context)).toBe(expected);
    });
  });

  describe("scoreTitleSimilarity", () => {
    it.each([
      ["iPhone 15 Pro Max", "iPhone 15 Pro Max", 100],
      ["iPhone 15 Pro", "iPhone 15", 67],
      ["iPhone 15", "Samsung Galaxy", 0],
    ] as const)("scores similarity between %s and %s", (left, right, expected) => {
      expect(scoreTitleSimilarity(left, right)).toBe(expected);
    });

    it("returns null for missing inputs", () => {
      expect(scoreTitleSimilarity(undefined, "iPhone")).toBeNull();
      expect(scoreTitleSimilarity("iPhone", undefined)).toBeNull();
    });
  });

  describe("confidence assembly", () => {
    it("builds duplicate confidence input with inferred source count", () => {
      const input = buildDuplicateConfidenceInput({
        duplicateScore: 88,
        signals: {
          normalization: 100,
          brand: 100,
          model: 100,
          storage: 100,
          ram: 100,
          variant: 100,
          price: 90,
          titleSimilarity: 100,
          sourceDiversity: 50,
        },
        sourceName: "EasyCep",
        categoryLabel: "Telefon",
        taxonomyConfidence: "high",
        taxonomyHasFullPath: true,
        taxonomyAttributeCount: 4,
        normalizedTitle: "iphone 15 pro max 256gb",
        canonicalTitle: "iphone 15 pro max 256gb",
      });

      expect(input.signals.sourceCount).toBe(70);
      expect(input.signals.sourceReliability).toBe(92);
      expect(input.signals.taxonomyScore).toBe(100);
      expect(input.context?.sourceCount).toBe(2);
      expect(input.context?.categoryLabel).toBe("Telefon");
    });

    it("builds product matcher confidence input from complete signals", () => {
      const input = buildProductMatcherConfidenceInput({
        signals: {
          brand: "apple",
          model: "iphone-15-pro-max",
          storage: "256gb",
          ram: "8gb",
          color: "black",
          category: "Telefon",
          normalizedKey: "apple-iphone-15-pro-max-256gb",
        },
        normalizedTitle: "iphone 15 pro max 256gb",
        canonicalTitle: "iphone 15 pro max 256gb",
        sourceName: "EasyCep",
      });

      expect(input.signals.normalizationScore).toBe(96);
      expect(input.signals.brandScore).toBe(96);
      expect(input.signals.modelScore).toBe(98);
      expect(input.signals.storageScore).toBe(94);
      expect(input.signals.ramScore).toBe(92);
      expect(input.signals.variantScore).toBe(92);
      expect(input.signals.sourceReliability).toBe(92);
    });

    it("lowers scores when storage is missing", () => {
      const withStorage = buildProductMatcherConfidenceInput({
        signals: {
          brand: "apple",
          model: "iphone-15",
          storage: "128gb",
          ram: "6gb",
          category: "Telefon",
          normalizedKey: "apple-iphone-15-128gb",
        },
      });
      const withoutStorage = buildProductMatcherConfidenceInput({
        signals: {
          brand: "apple",
          model: "iphone-15",
          storage: null,
          ram: "6gb",
          category: "Telefon",
          normalizedKey: "apple-iphone-15",
        },
      });

      expect(withStorage.signals.storageScore).toBe(94);
      expect(withoutStorage.signals.storageScore).toBe(40);
      expect(withStorage.signals.normalizationScore).toBe(96);
      expect(withoutStorage.signals.normalizationScore).toBe(88);
    });

    it("treats missing ram as weaker evidence", () => {
      const input = buildProductMatcherConfidenceInput({
        signals: {
          brand: "apple",
          model: "iphone-15",
          storage: "128gb",
          ram: null,
          category: "Telefon",
          normalizedKey: "apple-iphone-15-128gb",
        },
      });

      expect(input.signals.ramScore).toBe(45);
    });

    it("detects variant markers", () => {
      const variant = buildProductMatcherConfidenceInput({
        signals: {
          brand: "apple",
          model: "iphone-15-pro-max",
          storage: "256gb",
          ram: "8gb",
          category: "Telefon",
          normalizedKey: "apple-iphone-15-pro-max-256gb",
        },
      });
      const plain = buildProductMatcherConfidenceInput({
        signals: {
          brand: "apple",
          model: "iphone-15",
          storage: "256gb",
          ram: "8gb",
          category: "Telefon",
          normalizedKey: "apple-iphone-15-256gb",
        },
      });

      expect(variant.signals.variantScore).toBe(92);
      expect(plain.signals.variantScore).toBe(76);
    });
  });

  describe("confidence reasons", () => {
    it("prefers the strongest duplicate reasons", () => {
      const result = calculateConfidence({
        signals: {
          normalizationScore: 100,
          taxonomyScore: 66,
          brandScore: 70,
          modelScore: 100,
          storageScore: 100,
          ramScore: 70,
          variantScore: 70,
          duplicateScore: 60,
          priceConsistency: 60,
          titleSimilarity: 100,
          sourceCount: 86,
          sourceReliability: 92,
        },
        context: {
          categoryLabel: "Telefon",
          sourceCount: 3,
          sourceReliability: 92,
        },
      });

      expect(result.reasons).toEqual([
        "Başlık tamamen eşleşiyor",
        "Başlık normalizasyonu çok güçlü",
        "Model aynı",
        "Depolama aynı",
      ]);
    });

    it("adds source count and reliability reasons when they matter", () => {
      const result = calculateConfidence({
        signals: {
          normalizationScore: null,
          taxonomyScore: null,
          brandScore: null,
          modelScore: null,
          storageScore: null,
          ramScore: null,
          variantScore: null,
          duplicateScore: null,
          priceConsistency: null,
          titleSimilarity: null,
          sourceCount: 40,
          sourceReliability: 40,
        },
        context: {
          sourceCount: 1,
          sourceReliability: 40,
        },
      });

      expect(result.reasons).toEqual([
        "Tek kaynak",
        "Kaynak güvenilirliği düşük",
      ]);
    });

    it("falls back to a generic message when no signal is available", () => {
      const result = calculateConfidence({ signals: {} });

      expect(result.reasons).toEqual(["Sinyaller zayıf"]);
      expect(result.level).toBe("very-low");
    });

    it("maps to confidence metadata cleanly", () => {
      const result: ConfidenceResult = {
        score: 91,
        level: "high",
        reasons: ["Model aynı"],
        signals: {
          modelScore: 100,
        },
      };

      expect(toConfidenceMetadata(result)).toEqual({
        confidenceScore: 91,
        confidenceLevel: "high",
        confidenceReasons: ["Model aynı"],
      });
    });
  });

  describe("duplicate engine integration", () => {
    it("attaches confidence metadata to duplicate scores", () => {
      const input1 = createComparisonInput("iPhone 15 Pro Max 256GB", {
        brand: "apple",
        model: "iphone-15-pro-max",
        storage: "256gb",
        ram: "8gb",
      });
      const input2 = createComparisonInput("Apple iPhone 15 Pro Max 256 GB", {
        brand: "apple",
        model: "iphone-15-pro-max",
        storage: "256gb",
        ram: "8gb",
      });

      const result = calculateDuplicateScoreForInputs(input1, input2);

      expect(result.score).toBeGreaterThanOrEqual(95);
      expect(result.confidenceScore).toBeGreaterThanOrEqual(85);
      expect(result.confidenceLevel).toBe("high");
      expect(result.confidenceReasons.length).toBeGreaterThan(0);
    });

    it("keeps the same confidence data through compareListings", () => {
      const input1 = createComparisonInput("Galaxy S24 Ultra 256GB", {
        brand: "samsung",
        model: "galaxy-s24-ultra",
        storage: "256gb",
      });
      const input2 = createComparisonInput("Samsung Galaxy S24 Ultra 256GB", {
        brand: "samsung",
        model: "galaxy-s24-ultra",
        storage: "256gb",
      });

      const result = compareListings(input1, input2);

      expect(result.confidenceScore).toBeGreaterThan(0);
      expect(result.confidenceReasons).toBeDefined();
    });

    it("finds duplicate pairs with confidence metadata", () => {
      const matches = findDuplicateMatches([
        { id: 1, ...createComparisonInput("iPhone 15 Pro Max 256GB", { brand: "apple", model: "iphone-15-pro-max", storage: "256gb" }) },
        { id: 2, ...createComparisonInput("Apple iPhone 15 Pro Max 256GB", { brand: "apple", model: "iphone-15-pro-max", storage: "256gb" }) },
        { id: 3, ...createComparisonInput("Samsung Galaxy S24 Ultra 256GB", { brand: "samsung", model: "galaxy-s24-ultra", storage: "256gb" }) },
      ]);

      expect(matches).toHaveLength(1);
      expect(matches[0].confidenceScore).toBeGreaterThan(0);
      expect(matches[0].confidenceLevel).toBeDefined();
      expect(matches[0].confidenceReasons.length).toBeGreaterThan(0);
    });

    it("groups duplicates with confidence metadata on each item", () => {
      const groups = groupDuplicates([
        { id: 1, ...createComparisonInput("iPhone 15 Pro Max 256GB", { brand: "apple", model: "iphone-15-pro-max", storage: "256gb" }) },
        { id: 2, ...createComparisonInput("Apple iPhone 15 Pro Max 256GB", { brand: "apple", model: "iphone-15-pro-max", storage: "256gb" }) },
        { id: 3, ...createComparisonInput("Samsung Galaxy S24 Ultra 256GB", { brand: "samsung", model: "galaxy-s24-ultra", storage: "256gb" }) },
      ]);

      expect(groups).toHaveLength(1);
      expect(groups[0].duplicates[0].confidenceScore).toBeGreaterThan(0);
      expect(groups[0].duplicates[0].confidenceLevel).toBeDefined();
    });

    it("returns the highest scoring duplicate with confidence metadata", () => {
      const best = getHighestScoringDuplicate(
        createComparisonInput("iPhone 15 Pro Max 256GB", {
          brand: "apple",
          model: "iphone-15-pro-max",
          storage: "256gb",
        }),
        [
          { id: 1, ...createComparisonInput("Apple iPhone 15 Pro Max 256GB", { brand: "apple", model: "iphone-15-pro-max", storage: "256gb" }) },
          { id: 2, ...createComparisonInput("iPhone 15 Pro 256GB", { brand: "apple", model: "iphone-15-pro", storage: "256gb" }) },
        ],
      );

      expect(best).not.toBeNull();
      expect(best?.confidenceScore).toBeGreaterThan(0);
      expect(best?.confidenceLevel).toBeDefined();
    });
  });
});
