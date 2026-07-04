import type { TaxonomyNode, CategoryPathResolution } from "./types";

export type CategoryResolutionResult = {
  categoryId: string;
  categoryLabel: string;
  subCategoryId?: string;
  subCategoryLabel?: string;
  source: "new-engine" | "legacy" | "default";
  confidence: "high" | "medium" | "low";
  fullPath?: CategoryPathResolution;
};

export interface ICategoryResolver {
  resolve(input: string, context?: Record<string, unknown>): Promise<CategoryResolutionResult>;
  resolveSync(input: string, context?: Record<string, unknown>): CategoryResolutionResult;
  canResolve(input: string): Promise<boolean>;
}

export type CategoryResolverFactory = {
  createResolver(): Promise<ICategoryResolver>;
  createResolverSync(): ICategoryResolver;
};

class FallbackCategoryResolver implements ICategoryResolver {
  private newEngineResolver: ICategoryResolver | null = null;
  private legacyResolver: ICategoryResolver;

  constructor(legacyResolver: ICategoryResolver, newEngineResolver: ICategoryResolver | null = null) {
    this.legacyResolver = legacyResolver;
    this.newEngineResolver = newEngineResolver;
  }

  async resolve(input: string, context?: Record<string, unknown>): Promise<CategoryResolutionResult> {
    if (this.newEngineResolver) {
      try {
        const newResult = await this.newEngineResolver.resolve(input, context);
        if (newResult) {
          return newResult;
        }
      } catch {
        // Fallback to legacy
      }
    }

    try {
      const legacyResult = await this.legacyResolver.resolve(input, context);
      if (legacyResult) {
        return legacyResult;
      }
    } catch {
      // Fallback to default
    }

    return {
      categoryId: "default",
      categoryLabel: "Diğer",
      source: "default",
      confidence: "low",
    };
  }

  resolveSync(input: string, context?: Record<string, unknown>): CategoryResolutionResult {
    if (this.newEngineResolver) {
      try {
        const newResult = this.newEngineResolver.resolveSync(input, context);
        if (newResult) {
          return newResult;
        }
      } catch {
        // Fallback to legacy
      }
    }

    try {
      const legacyResult = this.legacyResolver.resolveSync(input, context);
      if (legacyResult) {
        return legacyResult;
      }
    } catch {
      // Fallback to default
    }

    return {
      categoryId: "default",
      categoryLabel: "Diğer",
      source: "default",
      confidence: "low",
    };
  }

  async canResolve(input: string): Promise<boolean> {
    if (this.newEngineResolver && (await this.newEngineResolver.canResolve(input))) {
      return true;
    }
    return this.legacyResolver.canResolve(input);
  }
}

export function createCategoryResolver(
  legacyResolver: ICategoryResolver,
  newEngineResolver?: ICategoryResolver,
): ICategoryResolver {
  return new FallbackCategoryResolver(legacyResolver, newEngineResolver || null);
}

export type { ICategoryResolver as CategoryResolver };
