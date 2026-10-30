// Admin-assisted re-categorisation of products that fell into the fallback
// category ("Diğer"). The model only suggests; an admin applies each
// suggestion explicitly, so no category changes silently.

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { classifyProductWithAi, type CategoryChoice } from "@/lib/ai/features/classify-product";
import { getAiRuntimeSettings } from "@/lib/ai/settings";
import type { Category } from "@/lib/categories";
import type { Database } from "@/lib/database.types";

type AdminClient = SupabaseClient<Database>;

/** Products reviewed per click: keeps one action well inside the request budget. */
export const REVIEW_BATCH_SIZE = 8;

export type FallbackProduct = { id: number; name: string };

export type CategorySuggestion = {
  productId: number;
  productName: string;
  categorySlug: string;
  categoryLabel: string;
  confidence: number;
};

export type ReviewResult = {
  suggestions: CategorySuggestion[];
  /** Products the model could not place confidently enough. */
  unplaced: string[];
  /** Why the run stopped early (switch off, budget, error); null when complete. */
  stoppedReason: string | null;
};

/** Every non-fallback category the model may choose, subcategories labelled with their parent. */
export function buildCategoryChoices(categories: Category[]): CategoryChoice[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  return categories
    .filter((category) => !category.isFallback)
    .map((category) => ({
      slug: category.slug,
      name: category.name,
      parentName: category.parentId ? byId.get(category.parentId)?.name ?? null : null,
    }));
}

const STOP_MESSAGES: Record<string, string> = {
  disabled: "AI kapalı. Ayarlardan açın.",
  feature_off: "Ürün tanıma ve kategori özelliği kapalı.",
  no_key: "API anahtarı tanımlı değil.",
  budget: "Günlük istek sınırına ulaşıldı.",
  unavailable: "Veritabanı bağlantısı yok.",
  paused: "AI art arda hata aldığı için 5 dakika duraklatıldı (Bağlantıyı test et ile açılır).",
};

export async function loadFallbackProducts(
  admin: AdminClient,
  categories: Category[],
  limit = REVIEW_BATCH_SIZE,
): Promise<FallbackProduct[]> {
  const fallback = categories.find((category) => category.isFallback);
  if (!fallback) return [];

  const { data, error } = await admin
    .from("products")
    .select("id, name")
    .eq("category_id", fallback.id)
    .order("id", { ascending: true })
    .limit(limit);
  if (error) {
    console.error("Fallback products query failed:", error);
    return [];
  }
  return (data ?? []).map((row) => ({ id: Number(row.id), name: String(row.name) }));
}

export async function countFallbackProducts(admin: AdminClient, categories: Category[]): Promise<number> {
  const fallback = categories.find((category) => category.isFallback);
  if (!fallback) return 0;
  const { count } = await admin
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("category_id", fallback.id);
  return count ?? 0;
}

export async function suggestCategories(
  products: FallbackProduct[],
  categories: Category[],
): Promise<ReviewResult> {
  const settings = await getAiRuntimeSettings();
  const choices = buildCategoryChoices(categories);
  const labels = new Map(choices.map((choice) => [choice.slug, choice.parentName ? `${choice.parentName} › ${choice.name}` : choice.name]));

  const suggestions: CategorySuggestion[] = [];
  const unplaced: string[] = [];

  for (const product of products) {
    const outcome = await classifyProductWithAi(product.name, choices);
    if (outcome.status === "skipped") {
      return { suggestions, unplaced, stoppedReason: STOP_MESSAGES[outcome.reason] ?? "AI çağrısı atlandı." };
    }
    if (outcome.status === "error") {
      return { suggestions, unplaced, stoppedReason: outcome.error };
    }

    const { categorySlug, confidence } = outcome.classification;
    if (categorySlug && confidence >= settings.minConfidence) {
      suggestions.push({
        productId: product.id,
        productName: product.name,
        categorySlug,
        categoryLabel: labels.get(categorySlug) ?? categorySlug,
        confidence,
      });
    } else {
      unplaced.push(product.name);
    }
  }
  return { suggestions, unplaced, stoppedReason: null };
}

export type ApplyResult = { ok: true; categoryLabel: string } | { ok: false; message: string };

/** Writes the chosen category to the product (category_id plus the main-category name mirror). */
export async function applyCategory(
  admin: AdminClient,
  categories: Category[],
  productId: number,
  categorySlug: string,
): Promise<ApplyResult> {
  const category = categories.find((candidate) => candidate.slug === categorySlug);
  if (!category || category.isFallback) return { ok: false, message: "Geçersiz kategori." };
  if (!Number.isInteger(productId)) return { ok: false, message: "Geçersiz ürün." };

  const main = category.parentId ? categories.find((candidate) => candidate.id === category.parentId) : category;
  const { error } = await admin
    .from("products")
    .update({ category_id: category.id, category: main?.name ?? category.name })
    .eq("id", productId);

  if (error) {
    console.error("Apply AI category failed:", error);
    return { ok: false, message: "Kategori kaydedilemedi." };
  }
  return { ok: true, categoryLabel: category.name };
}
