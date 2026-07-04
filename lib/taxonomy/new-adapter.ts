import type { ICategoryResolver, CategoryResolutionResult } from "./integration";
import { categoryResolver } from "./index";
import type { CategoryPathResolution } from "./types";

export class NewEngineAdapter implements ICategoryResolver {
  async resolve(input: string, context?: Record<string, unknown>): Promise<CategoryResolutionResult> {
    return this.resolveSync(input, context);
  }

  resolveSync(input: string, context?: Record<string, unknown>): CategoryResolutionResult {
    if (!input || input.trim().length === 0) {
      return {
        categoryId: "default",
        categoryLabel: "Diğer",
        source: "new-engine",
        confidence: "low",
      };
    }

    const resolution = categoryResolver.resolve(input);
    if (!resolution.category) {
      return {
        categoryId: "default",
        categoryLabel: "Diğer",
        source: "new-engine",
        confidence: "low",
      };
    }

    return this.buildResult(resolution, "new-engine");
  }

  async canResolve(input: string): Promise<boolean> {
    if (!input || input.trim().length === 0) {
      return false;
    }
    const resolution = categoryResolver.resolve(input);
    return resolution.category !== null;
  }

  private buildResult(
    path: CategoryPathResolution,
    source: "new-engine" | "legacy" | "default",
  ): CategoryResolutionResult {
    const category = path.category || path.mainCategory;

    if (!category) {
      return {
        categoryId: "default",
        categoryLabel: "Diğer",
        source,
        confidence: "low",
      };
    }

    return {
      categoryId: category.id,
      categoryLabel: category.label,
      subCategoryId: path.subCategory?.id,
      subCategoryLabel: path.subCategory?.label,
      source,
      confidence: path.subCategory ? "high" : "medium",
      fullPath: path,
    };
  }
}

export const createNewEngineAdapter = (): ICategoryResolver => {
  return new NewEngineAdapter();
};
