"use server";

import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/admin";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function deleteUser(userId: string) {
  const currentAdmin = await requireAdminUser("/admin/users");
  const supabase = createSupabaseAdminClient();
  if (!supabase || !userId || userId === currentAdmin.id) {
    return { ok: false, message: "Bu kullanıcı silinemez." };
  }

  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) {
    console.error("Admin user delete failed:", error);
    return { ok: false, message: error.message };
  }
  revalidatePath("/admin");
  revalidatePath("/admin/users");
  return { ok: true, message: "Kullanıcı silindi." };
}
