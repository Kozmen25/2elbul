import type { ICategoryResolver, CategoryResolutionResult } from "./integration";
import { CATEGORY_LABELS, getCategoryForProductType } from "./product-type-mapping";

/**
 * Keyword-based category detection rules used as lightweight fallback
 * when PUE product-type data is not available. These map product title
 * keywords to canonical category labels from CATEGORY_LABELS.
 *
 * The primary pipeline is PUE (Product Understanding Engine). This adapter
 * exists only for text-based resolution (e.g. search queries, product titles
 * without pre-computed PUE attributes).
 */
const KEYWORD_RULES: { pattern: RegExp; categoryLabel: string }[] = [
  // Service keywords
  { pattern: /tamir|onarim|servis|degisim|yenileme|bakim|kurtarma/i, categoryLabel: CATEGORY_LABELS.SERVICE },

  // Spare part keywords
  { pattern: /ekran paneli|batarya|sarj soketi|kamera modulu|hoparlor|ana kart|dokunmatik/i, categoryLabel: CATEGORY_LABELS.SPARE_PART },

  // Accessory keywords
  { pattern: /kilif|sarj aleti|powerbank|ekran koruyucu|adaptr|tutucu|kizak|lens|hub|mause|mouse|klavye|kulaklik|airpods|aksesuar|kablo/i, categoryLabel: CATEGORY_LABELS.ACCESSORY },

  // Phone brands
  { pattern: /iphone|samsung\s*galaxy|xiaomi|oppo|realme|vivo|honor|huawei/i, categoryLabel: CATEGORY_LABELS.PHONE },

  // Tablet
  { pattern: /tablet|ipad|galaxy\s*tab/i, categoryLabel: CATEGORY_LABELS.TABLET },

  // Computer / Laptop
  { pattern: /laptop|notebook|macbook|bilgisayar|pc|desktop/i, categoryLabel: CATEGORY_LABELS.COMPUTER },

  // Game consoles
  { pattern: /playstation|ps5|ps4|xbox|nintendo|switch|konsol/i, categoryLabel: CATEGORY_LABELS.CONSOLE },

  // Vehicles
  { pattern: /araba|araç|otomobil|motosiklet/i, categoryLabel: CATEGORY_LABELS.VEHICLE },

  // Real estate
  { pattern: /ev|daire|villa|emlak|arsa/i, categoryLabel: CATEGORY_LABELS.REAL_ESTATE },

  // TV / Audio
  { pattern: /tv|monitor|televizyon/i, categoryLabel: CATEGORY_LABELS.TV_AUDIO },
];

export class NewEngineAdapter implements ICategoryResolver {
  async resolve(input: string, context?: Record<string, unknown>): Promise<CategoryResolutionResult> {
    return this.resolveSync(input, context);
  }

  resolveSync(input: string, _context?: Record<string, unknown>): CategoryResolutionResult {
    if (!input || input.trim().length === 0) {
      return this.defaultResult();
    }

    const label = this.detectFromKeywords(input);
    if (label) {
      return {
        categoryId: label.toLowerCase().replace(/\s+\//g, "").replace(/\s+/g, "-"),
        categoryLabel: label,
        source: "new-engine",
        confidence: "medium",
      };
    }

    return this.defaultResult();
  }

  async canResolve(input: string): Promise<boolean> {
    if (!input || input.trim().length === 0) return false;
    return this.detectFromKeywords(input) !== null;
  }

  private detectFromKeywords(input: string): string | null {
    const lower = input.toLocaleLowerCase("tr-TR");
    for (const rule of KEYWORD_RULES) {
      if (rule.pattern.test(lower)) {
        return rule.categoryLabel;
      }
    }
    return null;
  }

  private defaultResult(): CategoryResolutionResult {
    return {
      categoryId: "default",
      categoryLabel: "Diğer",
      source: "new-engine",
      confidence: "low",
    };
  }
}

export const createNewEngineAdapter = (): ICategoryResolver => {
  return new NewEngineAdapter();
};
