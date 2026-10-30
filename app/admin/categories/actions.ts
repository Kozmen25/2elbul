"use server";

import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/admin";
import { logAdminAction } from "@/lib/auth/audit";
import { CACHE_TAGS, invalidateCacheTag } from "@/lib/cache-policy";
import {
  createCategory,
  deleteCategory,
  loadAdminCategories,
  moveCategory,
  moveCategoryProducts,
  reclassifyFallbackProducts,
  updateCategory,
} from "@/lib/category-admin";
import {
  validateCategoryInput,
  type CategoryErrors,
  type CategoryInput,
  type CategoryOperationResult,
} from "@/lib/category-admin-rules";
import { CATEGORY_ICON_MAP } from "@/lib/categories";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const CATEGORIES_ADMIN_PATH = "/admin/categories";
const ALLOWED_ICONS = Object.keys(CATEGORY_ICON_MAP);

export type CategoryActionResult = CategoryOperationResult & { errors?: CategoryErrors };

type AuditedOperation = {
  action: string;
  metadata: Record<string, unknown>;
};

const NO_CLIENT: CategoryActionResult = { ok: false, message: "Supabase bağlantısı yapılandırılmamış." };

/**
 * Categories are cached across requests and embedded in cached public pages
 * (menu, homepage tiles, category pages), so every successful write expires both.
 */
function refreshPublicCategories() {
  invalidateCacheTag(CACHE_TAGS.categories);
  revalidatePath("/", "layout");
}

async function finish(
  adminId: string,
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  result: CategoryActionResult,
  audit: AuditedOperation,
): Promise<CategoryActionResult> {
  if (!result.ok) return result;
  await logAdminAction(admin, adminId, { action: audit.action, metadata: audit.metadata });
  refreshPublicCategories();
  return result;
}

export async function createCategoryAction(input: CategoryInput): Promise<CategoryActionResult> {
  const adminUser = await requireAdminUser(CATEGORIES_ADMIN_PATH);
  const admin = createSupabaseAdminClient();
  if (!admin) return NO_CLIENT;

  const existing = await loadAdminCategories(admin);
  const validation = validateCategoryInput(input, existing, null, ALLOWED_ICONS);
  if (!validation.ok) return { ok: false, message: "Formdaki hataları düzeltin.", errors: validation.errors };

  const result = await createCategory(admin, validation.values, existing);
  return finish(adminUser.id, admin, result, {
    action: "CATEGORY_CREATED",
    metadata: { categoryId: result.id, slug: validation.values.slug, parentId: validation.values.parent_id },
  });
}

export async function updateCategoryAction(id: number, input: CategoryInput): Promise<CategoryActionResult> {
  const adminUser = await requireAdminUser(CATEGORIES_ADMIN_PATH);
  const admin = createSupabaseAdminClient();
  if (!admin) return NO_CLIENT;

  const existing = await loadAdminCategories(admin);
  const validation = validateCategoryInput(input, existing, id, ALLOWED_ICONS);
  if (!validation.ok) return { ok: false, message: "Formdaki hataları düzeltin.", errors: validation.errors };

  const result = await updateCategory(admin, id, validation.values, existing);
  return finish(adminUser.id, admin, result, {
    action: "CATEGORY_UPDATED",
    metadata: { categoryId: id, slug: validation.values.slug },
  });
}

export async function moveCategoryAction(id: number, direction: "up" | "down"): Promise<CategoryActionResult> {
  const adminUser = await requireAdminUser(CATEGORIES_ADMIN_PATH);
  const admin = createSupabaseAdminClient();
  if (!admin) return NO_CLIENT;

  const result = await moveCategory(admin, await loadAdminCategories(admin), id, direction);
  return finish(adminUser.id, admin, result, {
    action: "CATEGORY_REORDERED",
    metadata: { categoryId: id, direction },
  });
}

export async function deleteCategoryAction(
  id: number,
  moveProductsToId: number | null,
): Promise<CategoryActionResult> {
  const adminUser = await requireAdminUser(CATEGORIES_ADMIN_PATH);
  const admin = createSupabaseAdminClient();
  if (!admin) return NO_CLIENT;

  const result = await deleteCategory(admin, await loadAdminCategories(admin), id, moveProductsToId);
  return finish(adminUser.id, admin, result, {
    action: "CATEGORY_DELETED",
    metadata: { categoryId: id, movedProductsTo: moveProductsToId },
  });
}

export async function moveCategoryProductsAction(fromId: number, toId: number): Promise<CategoryActionResult> {
  const adminUser = await requireAdminUser(CATEGORIES_ADMIN_PATH);
  const admin = createSupabaseAdminClient();
  if (!admin) return NO_CLIENT;

  const result = await moveCategoryProducts(admin, await loadAdminCategories(admin), fromId, toId);
  return finish(adminUser.id, admin, result, {
    action: "CATEGORY_PRODUCTS_MOVED",
    metadata: { fromId, toId, moved: result.moved },
  });
}

export async function reclassifyFallbackAction(): Promise<CategoryActionResult> {
  const adminUser = await requireAdminUser(CATEGORIES_ADMIN_PATH);
  const admin = createSupabaseAdminClient();
  if (!admin) return NO_CLIENT;

  const result = await reclassifyFallbackProducts(admin, await loadAdminCategories(admin));
  return finish(adminUser.id, admin, result, {
    action: "CATEGORY_FALLBACK_RECLASSIFIED",
    metadata: { moved: result.moved, checked: result.checked },
  });
}
