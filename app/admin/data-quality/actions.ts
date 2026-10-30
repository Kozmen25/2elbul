"use server";

import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/admin";
import { logAdminAction } from "@/lib/auth/audit";
import { CACHE_TAGS, invalidateCacheTag } from "@/lib/cache-policy";
import { regroupAllProducts, type RegroupResult } from "@/lib/duplicate-engine/group-repository";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type RegroupActionResult =
  | { ok: true; result: RegroupResult }
  | { ok: false; message: string };

/** Recomputes duplicate groups for every product (same job as the daily cron). */
export async function regroupDuplicatesAction(): Promise<RegroupActionResult> {
  const admin = await requireAdminUser("/admin/data-quality");
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { ok: false, message: "Supabase bağlantısı yapılandırılmamış." };

  try {
    const result = await regroupAllProducts(supabase);
    await logAdminAction(supabase, admin.id, {
      action: "DUPLICATE_GROUPS_RECOMPUTED",
      metadata: { ...result },
    });
    // Listing counts and statistics changed: expire cached counts and pages.
    invalidateCacheTag(CACHE_TAGS.categories);
    revalidatePath("/", "layout");
    return { ok: true, result };
  } catch (error) {
    console.error("Duplicate regroup failed:", error);
    return { ok: false, message: error instanceof Error ? error.message : "Bilinmeyen hata" };
  }
}
