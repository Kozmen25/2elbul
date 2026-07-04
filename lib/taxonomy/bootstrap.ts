import { createCategoryResolver } from "./integration";
import { createLegacyAdapter } from "./legacy-adapter";
import { createNewEngineAdapter } from "./new-adapter";
import type { ICategoryResolver } from "./integration";

let globalResolver: ICategoryResolver | null = null;

export function initializeCategoryResolver(): ICategoryResolver {
  if (!globalResolver) {
    globalResolver = createCategoryResolver(
      createLegacyAdapter(),
      createNewEngineAdapter(),
    );
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
