import type { ICategoryResolver, CategoryResolutionResult } from "./integration";
import { normalizeCategoryText, findCategoryMatches } from "../category-taxonomy";
import { CATEGORY_TAXONOMY } from "../category-taxonomy";
import { extractBrand, isBareIphoneModel } from "../normalization";

export class LegacyAdapter implements ICategoryResolver {
  async resolve(input: string, context?: Record<string, unknown>): Promise<CategoryResolutionResult> {
    return this.resolveSync(input, context);
  }

  resolveSync(input: string, context?: Record<string, unknown>): CategoryResolutionResult {
    if (!input || input.trim().length === 0) {
      return {
        categoryId: "default",
        categoryLabel: "Diğer",
        source: "legacy",
        confidence: "low",
      };
    }

    const normalized = normalizeCategoryText(input);
    const matches = findCategoryMatches(input);

    if (matches.length > 0) {
      const topMatch = matches[0];
      return {
        categoryId: topMatch.category.id,
        categoryLabel: topMatch.category.label,
        source: "legacy",
        confidence: "high",
      };
    }

    const mainCategory = this.detectCategoryByBrand(input);
    if (mainCategory) {
      return {
        categoryId: mainCategory.id,
        categoryLabel: mainCategory.label,
        source: "legacy",
        confidence: "medium",
      };
    }

    return {
      categoryId: "default",
      categoryLabel: "Diğer",
      source: "legacy",
      confidence: "low",
    };
  }

  async canResolve(input: string): Promise<boolean> {
    if (!input || input.trim().length === 0) {
      return false;
    }
    const matches = findCategoryMatches(input);
    if (matches.length > 0) return true;
    return this.detectCategoryByBrand(input) !== null;
  }

  private detectCategoryByBrand(normalized: string): { id: string; label: string } | null {
    const lower = normalized.toLocaleLowerCase("tr-TR");
    const brand = extractBrand(lower);

    if (brand === "apple" && (lower.includes("iphone") || isBareIphoneModel(lower))) {
      return this.findCategoryByLabel("Telefon");
    }

    if (brand === "samsung" && /\b(galaxy|s\d{2}|a\d{2})\b/.test(lower)) {
      return this.findCategoryByLabel("Telefon");
    }

    if (lower.includes("ipad") || lower.includes("tablet")) {
      return this.findCategoryByLabel("Tablet");
    }

    if (lower.includes("macbook") || lower.includes("laptop")) {
      return this.findCategoryByLabel("Bilgisayar");
    }

    if (lower.includes("playstation") || lower.includes("ps5")) {
      return this.findCategoryByLabel("Oyun Konsolu");
    }

    if (lower.includes("rtx") || lower.includes("ekran karti")) {
      return this.findCategoryByLabel("Elektronik");
    }

    return null;
  }

  private findCategoryByLabel(label: string) {
    for (const category of CATEGORY_TAXONOMY) {
      if (category.label.toLocaleLowerCase("tr-TR") === label.toLocaleLowerCase("tr-TR")) {
        return { id: category.id, label: category.label };
      }
      if (category.children) {
        for (const child of category.children) {
          if (child.label.toLocaleLowerCase("tr-TR") === label.toLocaleLowerCase("tr-TR")) {
            return { id: child.id, label: child.label };
          }
        }
      }
    }
    return null;
  }
}

export const createLegacyAdapter = (): ICategoryResolver => {
  return new LegacyAdapter();
};
