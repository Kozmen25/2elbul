import { createCategoryResolver } from "./integration";
import { createNewEngineAdapter } from "./new-adapter";
import treeBuilder from "./tree";
import { CATEGORY_TAXONOMY } from "../category-taxonomy";
import type { ICategoryResolver } from "./integration";

let globalResolver: ICategoryResolver | null = null;

export function initializeCategoryResolver(): ICategoryResolver {
  if (!globalResolver) {
    // Populate TaxonomyRegistry from CATEGORY_TAXONOMY before creating resolvers
    treeBuilder.buildFromLegacy(CATEGORY_TAXONOMY);

    globalResolver = createCategoryResolver(createNewEngineAdapter());
  }
  return globalResolver;
}

export function getCategoryResolver(): ICategoryResolver {
  if (!globalResolver) {
    return initializeCategoryResolver();
  }
  return globalResolver;
}

export function resetCategoryResolver(): void {
  globalResolver = null;
}
