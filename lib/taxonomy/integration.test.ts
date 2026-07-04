import { describe, it, expect } from "vitest";
import { createCategoryResolver } from "./integration";
import { createLegacyAdapter } from "./legacy-adapter";
import { createNewEngineAdapter } from "./new-adapter";

describe("Taxonomy Integration - Adapters", () => {
  describe("Legacy Adapter Interface", () => {
    it("should return a valid resolution result", () => {
      const adapter = createLegacyAdapter();
      const result = adapter.resolveSync("iPhone");
      
      expect(result).toBeDefined();
      expect(result.categoryId).toBeDefined();
      expect(result.categoryLabel).toBeDefined();
      expect(result.source).toBe("legacy");
      expect(["high", "medium", "low"]).toContain(result.confidence);
    });

    it("should handle empty input gracefully", () => {
      const adapter = createLegacyAdapter();
      const result = adapter.resolveSync("");
      
      expect(result).toBeDefined();
      expect(result.categoryLabel).toBe("Diğer");
      expect(result.confidence).toBe("low");
    });

    it("should support async resolution", async () => {
      const adapter = createLegacyAdapter();
      const result = await adapter.resolve("Samsung");
      
      expect(result).toBeDefined();
      expect(result.source).toBe("legacy");
    });

    it("should support canResolve check", async () => {
      const adapter = createLegacyAdapter();
      
      const canResolveNonEmpty = await adapter.canResolve("Samsung");
      expect(typeof canResolveNonEmpty).toBe("boolean");
      
      const canResolveEmpty = await adapter.canResolve("");
      expect(canResolveEmpty).toBe(false);
    });
  });

  describe("New Engine Adapter Interface", () => {
    it("should return a valid resolution result", () => {
      const adapter = createNewEngineAdapter();
      const result = adapter.resolveSync("Elektronik");
      
      expect(result).toBeDefined();
      expect(result.categoryId).toBeDefined();
      expect(result.categoryLabel).toBeDefined();
      expect(result.source).toBe("new-engine");
      expect(["high", "medium", "low"]).toContain(result.confidence);
    });

    it("should handle empty input gracefully", () => {
      const adapter = createNewEngineAdapter();
      const result = adapter.resolveSync("");
      
      expect(result).toBeDefined();
      expect(result.categoryLabel).toBe("Diğer");
      expect(result.confidence).toBe("low");
    });

    it("should support async resolution", async () => {
      const adapter = createNewEngineAdapter();
      const result = await adapter.resolve("Elektronik");
      
      expect(result).toBeDefined();
      expect(result.source).toBe("new-engine");
    });
  });

  describe("Fallback Category Resolver", () => {
    it("should create resolver with fallback chain", () => {
      const resolver = createCategoryResolver(
        createLegacyAdapter(),
        createNewEngineAdapter(),
      );
      
      expect(resolver).toBeDefined();
      expect(resolver.resolveSync).toBeDefined();
      expect(resolver.resolve).toBeDefined();
      expect(resolver.canResolve).toBeDefined();
    });

    it("should return valid result for any input", () => {
      const resolver = createCategoryResolver(
        createLegacyAdapter(),
        createNewEngineAdapter(),
      );
      
      const result = resolver.resolveSync("Any product");
      
      expect(result).toBeDefined();
      expect(result.categoryId).toBeDefined();
      expect(result.categoryLabel).toBeDefined();
      expect(["new-engine", "legacy", "default"]).toContain(result.source);
      expect(["high", "medium", "low"]).toContain(result.confidence);
    });

    it("should return default result for empty input", () => {
      const resolver = createCategoryResolver(
        createLegacyAdapter(),
        createNewEngineAdapter(),
      );
      
      const result = resolver.resolveSync("");
      
      expect(result.categoryLabel).toBe("Diğer");
      expect(result.source).toBe("new-engine");
      expect(result.confidence).toBe("low");
    });

    it("should support async resolution", async () => {
      const resolver = createCategoryResolver(
        createLegacyAdapter(),
        createNewEngineAdapter(),
      );
      
      const result = await resolver.resolve("Test Product");
      
      expect(result).toBeDefined();
      expect(["new-engine", "legacy", "default"]).toContain(result.source);
    });

    it("should have consistent resolution", () => {
      const resolver = createCategoryResolver(
        createLegacyAdapter(),
        createNewEngineAdapter(),
      );
      
      const result1 = resolver.resolveSync("Test");
      const result2 = resolver.resolveSync("Test");
      
      expect(result1.categoryId).toBe(result2.categoryId);
      expect(result1.categoryLabel).toBe(result2.categoryLabel);
      expect(result1.source).toBe(result2.source);
    });

    it("should support canResolve check", async () => {
      const resolver = createCategoryResolver(
        createLegacyAdapter(),
        createNewEngineAdapter(),
      );
      
      const canResolve = await resolver.canResolve("Product");
      expect(typeof canResolve).toBe("boolean");
      
      const cannotResolveEmpty = await resolver.canResolve("");
      expect(cannotResolveEmpty).toBe(false);
    });
  });

  describe("Adapter Composition", () => {
    it("should work with legacy adapter only", () => {
      const resolver = createCategoryResolver(createLegacyAdapter());
      const result = resolver.resolveSync("Test");
      
      expect(result).toBeDefined();
      expect(["legacy", "default"]).toContain(result.source);
    });

    it("should work with both adapters", () => {
      const resolver = createCategoryResolver(
        createLegacyAdapter(),
        createNewEngineAdapter(),
      );
      const result = resolver.resolveSync("Test");
      
      expect(result).toBeDefined();
      expect(["new-engine", "legacy", "default"]).toContain(result.source);
    });

    it("should handle resolution errors gracefully", () => {
      const resolver = createCategoryResolver(
        createLegacyAdapter(),
        createNewEngineAdapter(),
      );
      
      // Provide invalid input and expect fallback to default
      const result = resolver.resolveSync("   ");
      
      expect(result).toBeDefined();
      expect(result.categoryLabel).toBeDefined();
      expect(["high", "medium", "low"]).toContain(result.confidence);
    });
  });
});
