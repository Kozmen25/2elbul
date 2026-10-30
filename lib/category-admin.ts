import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
  categoryScopeIds,
  countProductsInScope,
  nextDisplayOrder,
  planReorder,
  type AdminCategory,
  type CategoryOperationResult,
  type CategoryValues,
} from "@/lib/category-admin-rules";
import { HEADER_CATEGORIES_KEY } from "@/lib/site-settings";

// Admin-side writes for the category taxonomy (public.categories).
//
// The public read path stays in lib/categories.ts; validation and ordering
// rules are in lib/category-admin-rules.ts. This module keeps products
// consistent when categories change. All functions take the client as a
// parameter so they can be tested.

type AdminClient = SupabaseClient<Database>;

const PRODUCT_PAGE_SIZE = 1000;
const RECLASSIFY_BATCH = 10;
const RECLASSIFY_LIMIT = 1000;
const POSTGRES_UNIQUE_VIOLATION = "23505";

function fail(message: string): CategoryOperationResult {
  return { ok: false, message };
}

/** Every category (active or not) with the number of products assigned directly. */
export async function loadAdminCategories(admin: AdminClient): Promise<AdminCategory[]> {
  const { data, error } = await admin
    .from("categories")
    .select(
      "id, slug, parent_id, name, icon, short_description, long_description, match_keywords, exclude_keywords, display_order, is_active, is_fallback",
    )
    .order("display_order", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw error;

  const counts = new Map<number, number>();
  for (let offset = 0; ; offset += PRODUCT_PAGE_SIZE) {
    const page = await admin
      .from("products")
      .select("id, category_id")
      .order("id", { ascending: true })
      .range(offset, offset + PRODUCT_PAGE_SIZE - 1);
    if (page.error) throw page.error;
    for (const row of page.data ?? []) {
      counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
    }
    if ((page.data ?? []).length < PRODUCT_PAGE_SIZE) break;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    parentId: row.parent_id,
    name: row.name,
    icon: row.icon,
    shortDescription: row.short_description,
    longDescription: row.long_description,
    matchKeywords: row.match_keywords,
    excludeKeywords: row.exclude_keywords,
    displayOrder: row.display_order,
    isActive: row.is_active,
    isFallback: row.is_fallback,
    productCount: counts.get(row.id) ?? 0,
  }));
}

/**
 * products.category mirrors the main category's name and is maintained by the
 * products_assign_category trigger on UPDATE. Touching the rows re-runs it, so
 * renames and re-parenting reach the products without a schema change.
 */
async function resyncProductMirror(admin: AdminClient, categoryIds: number[], mainName: string) {
  const { error } = await admin.from("products").update({ category: mainName }).in("category_id", categoryIds);
  if (error) console.error("Category mirror resync failed:", error);
}

/** Keeps the saved header-menu selection valid when a slug changes. */
async function renameSlugInHeaderSelection(admin: AdminClient, oldSlug: string, newSlug: string) {
  const { data } = await admin
    .from("site_settings")
    .select("value")
    .eq("key", HEADER_CATEGORIES_KEY)
    .maybeSingle();
  const slugs = (data?.value as { slugs?: unknown } | null)?.slugs;
  if (!Array.isArray(slugs) || !slugs.includes(oldSlug)) return;

  const { error } = await admin.from("site_settings").upsert(
    {
      key: HEADER_CATEGORIES_KEY,
      value: { slugs: slugs.map((slug) => (slug === oldSlug ? newSlug : slug)) },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (error) console.error("Header selection slug update failed:", error);
}

function describeWriteError(error: { code?: string; message: string }): string {
  return error.code === POSTGRES_UNIQUE_VIOLATION
    ? "Bu slug başka bir kategoride kullanılıyor."
    : `Kaydedilemedi: ${error.message}`;
}

export async function createCategory(
  admin: AdminClient,
  validated: CategoryValues,
  existing: AdminCategory[],
): Promise<CategoryOperationResult & { id?: number }> {
  const { data, error } = await admin
    .from("categories")
    .insert({ ...validated, display_order: nextDisplayOrder(existing, validated.parent_id) })
    .select("id")
    .single();
  if (error) return fail(describeWriteError(error));
  return { ok: true, message: `"${validated.name}" eklendi.`, id: data.id };
}

export async function updateCategory(
  admin: AdminClient,
  id: number,
  validated: CategoryValues,
  existing: AdminCategory[],
): Promise<CategoryOperationResult> {
  const current = existing.find((c) => c.id === id);
  if (!current) return fail("Kategori bulunamadı.");

  // A hidden category drops out of navigation, so products must not sit in it.
  if (current.isActive && !validated.is_active) {
    const products = countProductsInScope(existing, id);
    if (products > 0) {
      return fail(`Bu kategoride (alt kategorileriyle) ${products} ürün var. Kapatmadan önce ürünleri başka bir kategoriye taşıyın.`);
    }
  }

  const { error } = await admin.from("categories").update(validated).eq("id", id);
  if (error) return fail(describeWriteError(error));

  if (current.slug !== validated.slug) {
    await renameSlugInHeaderSelection(admin, current.slug, validated.slug);
  }

  const parentChanged = current.parentId !== validated.parent_id;
  if (current.name !== validated.name || parentChanged) {
    const parent = validated.parent_id === null ? null : existing.find((c) => c.id === validated.parent_id);
    const scope = categoryScopeIds(existing, id);
    await resyncProductMirror(admin, scope, parent?.name ?? validated.name);
  }

  return { ok: true, message: `"${validated.name}" güncellendi.` };
}

export async function moveCategory(
  admin: AdminClient,
  existing: AdminCategory[],
  id: number,
  direction: "up" | "down",
): Promise<CategoryOperationResult> {
  const updates = planReorder(existing, id, direction);
  if (!updates) return fail("Kategori bu yönde daha fazla taşınamaz.");

  const results = await Promise.all(
    updates.map((update) =>
      admin.from("categories").update({ display_order: update.displayOrder }).eq("id", update.id),
    ),
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) return fail(`Sıralama kaydedilemedi: ${failed.error.message}`);
  return { ok: true, message: "Sıralama güncellendi." };
}

/** Moves the products assigned directly to `fromId` into `toId`. */
export async function moveCategoryProducts(
  admin: AdminClient,
  existing: AdminCategory[],
  fromId: number,
  toId: number,
): Promise<CategoryOperationResult & { moved?: number }> {
  const from = existing.find((c) => c.id === fromId);
  const to = existing.find((c) => c.id === toId);
  if (!from || !to) return fail("Kategori bulunamadı.");
  if (from.id === to.id) return fail("Kaynak ve hedef kategori aynı olamaz.");
  if (!to.isActive) return fail("Ürünler kapalı bir kategoriye taşınamaz.");

  const { error } = await admin.from("products").update({ category_id: to.id }).eq("category_id", from.id);
  if (error) return fail(`Ürünler taşınamadı: ${error.message}`);
  return {
    ok: true,
    message: `${from.productCount} ürün "${from.name}" kategorisinden "${to.name}" kategorisine taşındı.`,
    moved: from.productCount,
  };
}

export async function deleteCategory(
  admin: AdminClient,
  existing: AdminCategory[],
  id: number,
  moveProductsToId: number | null,
): Promise<CategoryOperationResult> {
  const category = existing.find((c) => c.id === id);
  if (!category) return fail("Kategori bulunamadı.");
  if (category.isFallback) return fail(`"${category.name}" silinemez; eşleşmeyen ürünler burada toplanır.`);

  const children = existing.filter((c) => c.parentId === id);
  if (children.length > 0) {
    return fail(`Önce ${children.length} alt kategoriyi silin veya başka bir kategoriye taşıyın.`);
  }

  if (category.productCount > 0) {
    if (moveProductsToId === null) {
      return fail(`Bu kategoride ${category.productCount} ürün var. Silmek için ürünlerin taşınacağı kategoriyi seçin.`);
    }
    const moved = await moveCategoryProducts(admin, existing, id, moveProductsToId);
    if (!moved.ok) return moved;
  }

  // products.category_id is ON DELETE RESTRICT: a product added meanwhile
  // blocks the delete instead of being orphaned.
  const { error } = await admin.from("categories").delete().eq("id", id);
  if (error) return fail(`Silinemedi: ${error.message}`);
  return { ok: true, message: `"${category.name}" silindi.` };
}

/**
 * Runs the database classification rules again over the products waiting in
 * the fallback category ("Diğer"), e.g. after adding a category or keywords.
 * Products already placed in a real category are never touched, so manual and
 * AI placements survive.
 */
export async function reclassifyFallbackProducts(
  admin: AdminClient,
  existing: AdminCategory[],
): Promise<CategoryOperationResult & { moved?: number; checked?: number }> {
  const fallback = existing.find((c) => c.isFallback);
  if (!fallback) return fail("Yedek kategori (Diğer) bulunamadı.");

  const { data, error } = await admin
    .from("products")
    .select("id, name")
    .eq("category_id", fallback.id)
    .order("id", { ascending: true })
    .limit(RECLASSIFY_LIMIT);
  if (error) return fail(`Ürünler okunamadı: ${error.message}`);

  const products = data ?? [];
  let moved = 0;
  for (let start = 0; start < products.length; start += RECLASSIFY_BATCH) {
    const batch = products.slice(start, start + RECLASSIFY_BATCH);
    const results = await Promise.all(
      batch.map(async (product) => {
        const { data: categoryId, error: rpcError } = await admin.rpc("classify_product_category", {
          p_name: product.name,
        });
        if (rpcError || categoryId === null || categoryId === fallback.id) return false;
        const { error: updateError } = await admin
          .from("products")
          .update({ category_id: categoryId })
          .eq("id", product.id);
        return !updateError;
      }),
    );
    moved += results.filter(Boolean).length;
  }

  return {
    ok: true,
    message:
      moved > 0
        ? `"${fallback.name}" içindeki ${products.length} üründen ${moved} tanesi yeni kategorilere yerleştirildi.`
        : `"${fallback.name}" içindeki ${products.length} ürün için eşleşen yeni bir kategori bulunamadı.`,
    moved,
    checked: products.length,
  };
}
