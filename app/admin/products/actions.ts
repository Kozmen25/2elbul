"use server";

import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/admin";
import { createProductSlug } from "@/lib/product-slug";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function updateProduct(formData: FormData) {
  await requireAdminUser("/admin/products");
  const supabase = createSupabaseAdminClient();
  if (!supabase) return;

  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const slug =
    String(formData.get("slug") ?? "").trim() || createProductSlug(name);
  if (!Number.isInteger(id) || !name || !slug) return;

  const { error } = await supabase
    .from("products")
    .update({ name, slug })
    .eq("id", id);
  if (error) console.error("Admin product update failed:", error);
  revalidateProducts();
}

export async function deleteProduct(formData: FormData) {
  await requireAdminUser("/admin/products");
  const supabase = createSupabaseAdminClient();
  if (!supabase) return;
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;

  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) console.error("Admin product delete failed:", error);
  revalidateProducts();
}

function revalidateProducts() {
  revalidatePath("/admin");
  revalidatePath("/admin/products");
  revalidatePath("/");
  revalidatePath("/search");
}
