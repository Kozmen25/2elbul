"use server";

import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/admin";
import type { AdminActionResult } from "@/lib/admin-action-result";
import { CACHE_TAGS, invalidateCacheTag } from "@/lib/cache-policy";
import { createProductSlug } from "@/lib/product-slug";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const POSTGRES_UNIQUE_VIOLATION = "23505";
const POSTGRES_FOREIGN_KEY_VIOLATION = "23503";
const NO_CLIENT: AdminActionResult = { ok: false, message: "Supabase bağlantısı yapılandırılmamış." };

export async function createProduct(formData: FormData): Promise<AdminActionResult> {
  await requireAdminUser("/admin/products");
  const supabase = createSupabaseAdminClient();
  if (!supabase) return NO_CLIENT;

  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim() || createProductSlug(name);
  const categoryId = Number(formData.get("categoryId"));
  if (name.length < 2) return { ok: false, message: "Ürün adı en az 2 karakter olmalı." };
  if (!slug) return { ok: false, message: "Ürün adından geçerli bir adres (slug) üretilemedi." };

  // No category chosen: let the database rules pick one, as for imported products.
  let categoryForInsert = Number.isInteger(categoryId) && categoryId > 0 ? categoryId : null;
  if (categoryForInsert === null) {
    const classified = await supabase.rpc("classify_product_category", { p_name: name });
    if (classified.error || classified.data == null) return { ok: false, message: "Kategori belirlenemedi; bir kategori seçin." };
    categoryForInsert = classified.data;
  }

  const key = await supabase.rpc("compute_normalized_key", { value: name });
  const { error } = await supabase.from("products").insert({
    name,
    slug,
    category_id: categoryForInsert,
    normalized_key: key.error ? null : key.data,
  });

  if (error) {
    if (error.code === POSTGRES_UNIQUE_VIOLATION) return { ok: false, message: "Bu ada ya da adrese sahip bir ürün zaten var." };
    console.error("Admin product create failed:", error);
    return { ok: false, message: `Ürün eklenemedi: ${error.message}` };
  }
  revalidateProducts();
  return { ok: true, message: `"${name}" eklendi.` };
}

export async function updateProduct(formData: FormData): Promise<AdminActionResult> {
  await requireAdminUser("/admin/products");
  const supabase = createSupabaseAdminClient();
  if (!supabase) return NO_CLIENT;

  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim() || createProductSlug(name);
  if (!Number.isInteger(id) || !name || !slug) return { ok: false, message: "Ürün adı ve adresi (slug) boş olamaz." };

  // The products_assign_category trigger keeps products.category in sync.
  const categoryId = Number(formData.get("categoryId"));
  const { error } = await supabase
    .from("products")
    .update(
      Number.isInteger(categoryId) && categoryId > 0
        ? { name, slug, category_id: categoryId }
        : { name, slug },
    )
    .eq("id", id);

  if (error) {
    if (error.code === POSTGRES_UNIQUE_VIOLATION) return { ok: false, message: "Bu ada ya da adrese sahip başka bir ürün var." };
    console.error("Admin product update failed:", error);
    return { ok: false, message: `Ürün kaydedilemedi: ${error.message}` };
  }
  revalidateProducts();
  return { ok: true, message: "Ürün güncellendi." };
}

export async function deleteProduct(formData: FormData): Promise<AdminActionResult> {
  await requireAdminUser("/admin/products");
  const supabase = createSupabaseAdminClient();
  if (!supabase) return NO_CLIENT;
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return { ok: false, message: "Geçersiz ürün." };

  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) {
    if (error.code === POSTGRES_FOREIGN_KEY_VIOLATION) {
      return { ok: false, message: "Bu ürüne bağlı ilanlar var. Önce ilanları silin ya da başka bir ürüne taşıyın." };
    }
    console.error("Admin product delete failed:", error);
    return { ok: false, message: `Ürün silinemedi: ${error.message}` };
  }
  revalidateProducts();
  return { ok: true, message: "Ürün silindi." };
}

function revalidateProducts() {
  revalidatePath("/admin");
  revalidatePath("/admin/products");
  revalidatePath("/");
  revalidatePath("/search");
  invalidateCacheTag(CACHE_TAGS.categories);
}
