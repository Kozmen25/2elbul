import { createProductSlug } from "@/lib/product-slug";

// Pure rules of the admin category editor: input validation, slugs, keyword
// parsing and ordering. No database or server-only imports, so client
// components can use them too. Database writes live in lib/category-admin.ts.

export type AdminCategory = {
  id: number;
  slug: string;
  parentId: number | null;
  name: string;
  icon: string | null;
  shortDescription: string | null;
  longDescription: string | null;
  matchKeywords: string[];
  excludeKeywords: string[];
  displayOrder: number;
  isActive: boolean;
  isFallback: boolean;
  /** Products assigned directly to this category (not its subcategories). */
  productCount: number;
};

/** Raw form values; keywords arrive as one comma/newline separated string. */
export type CategoryInput = {
  name: string;
  slug: string;
  parentId: number | null;
  icon: string | null;
  shortDescription: string;
  longDescription: string;
  matchKeywords: string;
  excludeKeywords: string;
  isActive: boolean;
};

export type CategoryValues = {
  name: string;
  slug: string;
  parent_id: number | null;
  icon: string | null;
  short_description: string | null;
  long_description: string | null;
  match_keywords: string[];
  exclude_keywords: string[];
  is_active: boolean;
};

export type CategoryField = keyof CategoryInput;
export type CategoryErrors = Partial<Record<CategoryField, string>>;

export type CategoryValidation =
  | { ok: true; values: CategoryValues }
  | { ok: false; errors: CategoryErrors };

export type CategoryOperationResult = { ok: boolean; message: string };

export const CATEGORY_LIMITS = {
  nameMin: 2,
  nameMax: 60,
  slugMax: 80,
  shortDescriptionMax: 160,
  longDescriptionMax: 600,
  keywordMax: 60,
  keywordCount: 120,
} as const;

/** Distance between display_order values, leaves room for manual inserts. */
export const DISPLAY_ORDER_STEP = 10;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugifyCategoryName(name: string): string {
  return createProductSlug(name);
}

/** "a, b\nc" -> ["a", "b", "c"]; trimmed, de-duplicated (case-insensitive). */
export function parseKeywordList(raw: string): string[] {
  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const part of raw.split(/[,\n]/)) {
    const keyword = part.trim();
    const key = keyword.toLocaleLowerCase("tr-TR");
    if (!keyword || seen.has(key)) continue;
    seen.add(key);
    keywords.push(keyword);
  }
  return keywords;
}

function validateKeywords(raw: string): { keywords: string[]; error?: string } {
  const keywords = parseKeywordList(raw);
  if (keywords.length > CATEGORY_LIMITS.keywordCount) {
    return { keywords, error: `En fazla ${CATEGORY_LIMITS.keywordCount} anahtar kelime girilebilir.` };
  }
  if (keywords.some((keyword) => keyword.length > CATEGORY_LIMITS.keywordMax)) {
    return {
      keywords,
      error: `Her anahtar kelime en fazla ${CATEGORY_LIMITS.keywordMax} karakter olabilir.`,
    };
  }
  return { keywords };
}

/**
 * Validates a create/edit form against the whole taxonomy.
 * `editingId` is null when creating. Returns field-level messages in Turkish.
 */
export function validateCategoryInput(
  input: CategoryInput,
  existing: AdminCategory[],
  editingId: number | null,
  allowedIcons: readonly string[],
): CategoryValidation {
  const errors: CategoryErrors = {};
  const current = editingId === null ? null : existing.find((c) => c.id === editingId) ?? null;

  const name = input.name.trim();
  if (name.length < CATEGORY_LIMITS.nameMin || name.length > CATEGORY_LIMITS.nameMax) {
    errors.name = `Ad ${CATEGORY_LIMITS.nameMin}-${CATEGORY_LIMITS.nameMax} karakter olmalı.`;
  }

  const slug = input.slug.trim() ? input.slug.trim().toLowerCase() : slugifyCategoryName(name);
  if (!slug || slug.length > CATEGORY_LIMITS.slugMax || !SLUG_PATTERN.test(slug)) {
    errors.slug = "Slug yalnızca küçük harf, rakam ve tire içermeli (ör. cep-telefonu).";
  } else if (existing.some((c) => c.slug === slug && c.id !== editingId)) {
    errors.slug = "Bu slug başka bir kategoride kullanılıyor.";
  }

  const parentId = input.parentId;
  if (parentId !== null) {
    const parent = existing.find((c) => c.id === parentId);
    if (!parent) errors.parentId = "Üst kategori bulunamadı.";
    else if (parent.parentId !== null) errors.parentId = "Alt kategorinin altına kategori eklenemez (en fazla iki seviye).";
    else if (parent.isFallback) errors.parentId = `"${parent.name}" altına alt kategori eklenemez.`;
    else if (parent.id === editingId) errors.parentId = "Kategori kendi altına taşınamaz.";
    else if (current && existing.some((c) => c.parentId === current.id)) {
      errors.parentId = "Alt kategorisi olan bir kategori başka bir kategorinin altına taşınamaz.";
    }
  }
  if (current?.isFallback && parentId !== null) {
    errors.parentId = `"${current.name}" ana kategori olarak kalmalı.`;
  }

  if (input.icon !== null && !allowedIcons.includes(input.icon)) {
    errors.icon = "Geçersiz simge.";
  }

  const shortDescription = input.shortDescription.trim();
  if (shortDescription.length > CATEGORY_LIMITS.shortDescriptionMax) {
    errors.shortDescription = `Kısa açıklama en fazla ${CATEGORY_LIMITS.shortDescriptionMax} karakter olabilir.`;
  }
  const longDescription = input.longDescription.trim();
  if (longDescription.length > CATEGORY_LIMITS.longDescriptionMax) {
    errors.longDescription = `Uzun açıklama en fazla ${CATEGORY_LIMITS.longDescriptionMax} karakter olabilir.`;
  }

  const match = validateKeywords(input.matchKeywords);
  if (match.error) errors.matchKeywords = match.error;
  const exclude = validateKeywords(input.excludeKeywords);
  if (exclude.error) errors.excludeKeywords = exclude.error;

  if (current?.isFallback && !input.isActive) {
    errors.isActive = `"${current.name}" kategorisi kapatılamaz; eşleşmeyen ürünler burada toplanır.`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    values: {
      name,
      slug,
      parent_id: parentId,
      icon: input.icon,
      short_description: shortDescription || null,
      long_description: longDescription || null,
      match_keywords: match.keywords,
      exclude_keywords: exclude.keywords,
      is_active: input.isActive,
    },
  };
}

function compareOrder(a: AdminCategory, b: AdminCategory): number {
  return a.displayOrder - b.displayOrder || a.id - b.id;
}

/** Siblings that can be reordered: same parent, fallback category stays pinned last. */
function reorderableSiblings(categories: AdminCategory[], parentId: number | null): AdminCategory[] {
  return categories
    .filter((c) => c.parentId === parentId && !c.isFallback)
    .sort(compareOrder);
}

export type OrderUpdate = { id: number; displayOrder: number };

/**
 * Moves a category one step among its siblings and renumbers the siblings
 * (10, 20, 30 ...). Returns only the rows whose order changes, or null when
 * the move is not possible (edge of the list, fallback category, unknown id).
 */
export function planReorder(
  categories: AdminCategory[],
  id: number,
  direction: "up" | "down",
): OrderUpdate[] | null {
  const target = categories.find((c) => c.id === id);
  if (!target || target.isFallback) return null;

  const siblings = reorderableSiblings(categories, target.parentId);
  const index = siblings.findIndex((c) => c.id === id);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= siblings.length) return null;

  const reordered = [...siblings];
  [reordered[index], reordered[swapWith]] = [reordered[swapWith], reordered[index]];

  return reordered
    .map((category, position) => ({ id: category.id, displayOrder: (position + 1) * DISPLAY_ORDER_STEP }))
    .filter((update) => categories.find((c) => c.id === update.id)?.displayOrder !== update.displayOrder);
}

/** Order value that appends a new category after its siblings. */
export function nextDisplayOrder(categories: AdminCategory[], parentId: number | null): number {
  const siblings = reorderableSiblings(categories, parentId);
  const last = siblings[siblings.length - 1];
  return last ? last.displayOrder + DISPLAY_ORDER_STEP : DISPLAY_ORDER_STEP;
}

/** The category and its direct subcategories: where its products can live. */
export function categoryScopeIds(categories: AdminCategory[], id: number): number[] {
  return [id, ...categories.filter((c) => c.parentId === id).map((c) => c.id)];
}

export function countProductsInScope(categories: AdminCategory[], id: number): number {
  const scope = new Set(categoryScopeIds(categories, id));
  return categories.filter((c) => scope.has(c.id)).reduce((sum, c) => sum + c.productCount, 0);
}

