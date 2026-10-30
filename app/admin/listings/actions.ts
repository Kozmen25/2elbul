"use server";

import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/admin";
import type { AdminActionResult } from "@/lib/admin-action-result";
import { manualStatusFields } from "@/lib/listing-status";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const statuses = new Set(["pending", "published", "active", "inactive", "rejected"]);

export type BulkListingAction =
  | "publish"
  | "pending"
  | "deactivate"
  | "reject"
  | "delete";

export type BulkListingResult = {
  ok: boolean;
  message: string;
};

const NO_CLIENT: AdminActionResult = { ok: false, message: "Supabase bağlantısı yapılandırılmamış." };

export async function updateListing(formData: FormData): Promise<AdminActionResult> {
  await requireAdminUser("/admin/listings");
  const supabase = createSupabaseAdminClient();
  if (!supabase) return NO_CLIENT;

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
    ...(statuses.has(status) ? manualStatusFields(status) : {}),
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
    return { ok: false, message: "Başlık, ürün, şehir, kaynak, durum, adres ve sıfırdan büyük bir fiyat zorunlu." };
  }

  const { error } = await supabase.from("listings").update(payload).eq("id", id);
  if (error) {
    console.error("Admin listing update failed:", error);
    return { ok: false, message: `İlan kaydedilemedi: ${error.message}` };
  }
  revalidateAdminListings();
  return { ok: true, message: "İlan güncellendi." };
}

export async function setListingStatus(formData: FormData): Promise<AdminActionResult> {
  await requireAdminUser("/admin/listings");
  const supabase = createSupabaseAdminClient();
  if (!supabase) return NO_CLIENT;

  const id = Number(formData.get("id"));
  const status = String(formData.get("status") ?? "");
  if (!Number.isInteger(id) || !statuses.has(status)) return { ok: false, message: "Geçersiz ilan ya da durum." };

  const { error } = await supabase
    .from("listings")
    .update(manualStatusFields(status))
    .eq("id", id);
  if (error) {
    console.error("Admin listing status update failed:", error);
    return { ok: false, message: `Durum değiştirilemedi: ${error.message}` };
  }
  revalidateAdminListings();
  return { ok: true, message: "İlan durumu güncellendi." };
}

export async function deleteListing(formData: FormData): Promise<AdminActionResult> {
  await requireAdminUser("/admin/listings");
  const supabase = createSupabaseAdminClient();
  if (!supabase) return NO_CLIENT;
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return { ok: false, message: "Geçersiz ilan." };

  const { error } = await supabase.from("listings").delete().eq("id", id);
  if (error) {
    console.error("Admin listing delete failed:", error);
    return { ok: false, message: `İlan silinemedi: ${error.message}` };
  }
  revalidateAdminListings();
  return { ok: true, message: "İlan silindi." };
}

export async function bulkListingAction(
  ids: number[],
  action: BulkListingAction,
): Promise<BulkListingResult> {
  await requireAdminUser("/admin/listings");
  const supabase = createSupabaseAdminClient();
  const validIds = [...new Set(ids.filter(Number.isInteger))];

  if (!supabase) {
    return {
      ok: false,
      message: "Supabase service-role bağlantısı yapılandırılmamış.",
    };
  }
  if (validIds.length === 0) {
    return { ok: false, message: "İşlem yapılacak ilan seçilmedi." };
  }

  const statusByAction = {
    publish: "published",
    pending: "pending",
    deactivate: "inactive",
    reject: "rejected",
  } as const;
  const result =
    action === "delete"
      ? await supabase.from("listings").delete().in("id", validIds)
      : action in statusByAction
        ? await supabase
            .from("listings")
            .update(manualStatusFields(statusByAction[action as keyof typeof statusByAction]))
            .in("id", validIds)
        : null;

  if (!result) {
    return { ok: false, message: "Geçersiz toplu işlem." };
  }
  if (result.error) {
    console.error(`Admin bulk listing ${action} failed:`, result.error);
    return {
      ok: false,
      message: `Toplu işlem tamamlanamadı: ${result.error.message}`,
    };
  }

  revalidateAdminListings();
  const labels: Record<BulkListingAction, string> = {
    publish: "yayına alındı",
    pending: "beklemeye alındı",
    deactivate: "pasife alındı",
    reject: "reddedildi",
    delete: "silindi",
  };
  return {
    ok: true,
    message: `${validIds.length} ilan ${labels[action]}.`,
  };
}

function revalidateAdminListings() {
  revalidatePath("/admin");
  revalidatePath("/admin/listings");
  revalidatePath("/admin/problem-listings");
  revalidatePath("/admin/market-signals");
  revalidatePath("/");
  revalidatePath("/search");
}
