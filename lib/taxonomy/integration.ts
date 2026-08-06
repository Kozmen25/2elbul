import type { TaxonomyNode, CategoryPathResolution } from "./types";

export type CategoryResolutionResult = {
  categoryId: string;
  categoryLabel: string;
  subCategoryId?: string;
  subCategoryLabel?: string;
  source: "new-engine" | "default";
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

class DirectCategoryResolver implements ICategoryResolver {
  private newEngineResolver: ICategoryResolver | null = null;

  constructor(newEngineResolver: ICategoryResolver | null = null) {
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
        // Fallback to default
      }
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
        // Fallback to default
      }
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
    return false;
  }
}

export function createCategoryResolver(
  newEngineResolver?: ICategoryResolver,
): ICategoryResolver {
  return new DirectCategoryResolver(newEngineResolver || null);
}

export type { ICategoryResolver as CategoryResolver };
