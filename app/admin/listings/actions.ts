"use server";

import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/admin";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const statuses = new Set(["pending", "published", "rejected"]);

export async function updateListing(formData: FormData) {
  await requireAdminUser("/admin/listings");
  const supabase = createSupabaseAdminClient();
  if (!supabase) return;

  const id = Number(formData.get("id"));
  const price = Number(formData.get("price"));
  const status = String(formData.get("status") ?? "");
  const payload = {
    product_id: Number(formData.get("product_id")),
    title: String(formData.get("title") ?? "").trim(),
    price,
    city: String(formData.get("city") ?? "").trim(),
    source: String(formData.get("source") ?? "").trim(),
    condition: String(formData.get("condition") ?? "").trim(),
    url: String(formData.get("url") ?? "").trim(),
    image_url: String(formData.get("image_url") ?? "").trim() || null,
    ...(statuses.has(status) ? { status } : {}),
  };

  if (
    !Number.isInteger(id) ||
    !Number.isInteger(payload.product_id) ||
    !payload.title ||
    !Number.isFinite(price) ||
    price <= 0 ||
    !payload.city ||
    !payload.source ||
    !payload.condition ||
    !payload.url
  ) {
    console.error("Admin listing update rejected: invalid payload", { id });
    return;
  }

  const { error } = await supabase.from("listings").update(payload).eq("id", id);
  if (error) console.error("Admin listing update failed:", error);
  revalidateAdminListings();
}

export async function setListingStatus(formData: FormData) {
  await requireAdminUser("/admin/listings");
  const supabase = createSupabaseAdminClient();
  if (!supabase) return;

  const id = Number(formData.get("id"));
  const status = String(formData.get("status") ?? "");
  if (!Number.isInteger(id) || !statuses.has(status)) return;

  const { error } = await supabase
    .from("listings")
    .update({ status })
    .eq("id", id);
  if (error) console.error("Admin listing status update failed:", error);
  revalidateAdminListings();
}

export async function deleteListing(formData: FormData) {
  await requireAdminUser("/admin/listings");
  const supabase = createSupabaseAdminClient();
  if (!supabase) return;
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;

  const { error } = await supabase.from("listings").delete().eq("id", id);
  if (error) console.error("Admin listing delete failed:", error);
  revalidateAdminListings();
}

export async function bulkDeleteListings(ids: number[]) {
  await requireAdminUser("/admin/listings");
  const supabase = createSupabaseAdminClient();
  const validIds = ids.filter(Number.isInteger);
  if (!supabase || validIds.length === 0) return { ok: false };

  const { error } = await supabase.from("listings").delete().in("id", validIds);
  if (error) {
    console.error("Admin bulk listing delete failed:", error);
    return { ok: false };
  }
  revalidateAdminListings();
  return { ok: true };
}

function revalidateAdminListings() {
  revalidatePath("/admin");
  revalidatePath("/admin/listings");
  revalidatePath("/");
  revalidatePath("/search");
}
