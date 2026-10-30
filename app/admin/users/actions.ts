"use server";

import { revalidatePath } from "next/cache";
import { isAdminEmail, requireAdminUser } from "@/lib/admin";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { logAdminAction } from "@/lib/auth/audit";
import { createRecoveryEmailClient } from "@/lib/auth/recovery-email";
import { getSiteUrl } from "@/lib/site-url";

const RECOVERY_LANDING_PATH = "/auth/recovery";
const ADMIN_USERS_PATH = "/admin/users";

/**
 * Where an admin-triggered password-reset link lands (implicit flow, see
 * lib/auth/recovery-email.ts). Derived at call time, never persisted, and the
 * one-time recovery token is never surfaced.
 */
function resetRedirect() {
  return `${getSiteUrl().replace(/\/$/, "")}${RECOVERY_LANDING_PATH}`;
}

export type AdminActionResult = {
  ok: boolean;
  message: string;
  action?: string;
};

function revalidateAdminPaths() {
  revalidatePath("/admin");
  revalidatePath(ADMIN_USERS_PATH);
}

/** Marks the target user's email as confirmed. */
export async function verifyUser(userId: string): Promise<AdminActionResult> {
  const admin = await requireAdminUser(ADMIN_USERS_PATH);
  const supabase = createSupabaseAdminClient();
  if (!supabase || !userId) {
    return { ok: false, message: "Kullanıcı bulunamadı." };
  }

  const { error } = await supabase.auth.admin.updateUserById(userId, {
    email_confirm: true,
  });
  if (error) {
    console.error("Admin user verify failed:", error);
    return { ok: false, message: "E-posta doğrulama başarısız. Lütfen tekrar deneyin." };
  }

  await logAdminAction(supabase, admin.id, {
    action: "USER_VERIFIED",
    targetUserId: userId,
    metadata: { source: "admin" },
  });
  revalidateAdminPaths();
  return { ok: true, message: "Kullanıcının e-postası doğrulandı.", action: "USER_VERIFIED" };
}

/**
 * Emails the user a password-reset link (Supabase recovery flow). The link and
 * its one-time token are never returned and never written to the audit log —
 * only the fact that a reset email was sent.
 */
export async function resetUserPassword(userId: string): Promise<AdminActionResult> {
  const admin = await requireAdminUser(ADMIN_USERS_PATH);
  const supabase = createSupabaseAdminClient();
  if (!supabase || !userId) {
    return { ok: false, message: "Kullanıcı bulunamadı." };
  }

  const { data: target } = await supabase.auth.admin.getUserById(userId);
  const email = target?.user?.email;
  if (!email) {
    return { ok: false, message: "Kullanıcının e-posta adresi bulunamadı." };
  }

  // resetPasswordForEmail lives on the regular auth client, not auth.admin, so
  // a dedicated implicit-flow client sends it (the admin client only looked up
  // the address). Never surface or log the recovery link or token.
  const mailer = createRecoveryEmailClient();
  if (!mailer) {
    return { ok: false, message: "Supabase bağlantısı yapılandırılmamış." };
  }
  const { error } = await mailer.auth.resetPasswordForEmail(email, {
    redirectTo: resetRedirect(),
  });
  if (error) {
    console.error("Admin password reset failed:", error);
    return { ok: false, message: "Sıfırlama e-postası gönderilemedi: " + error.message };
  }

  await logAdminAction(supabase, admin.id, {
    action: "RESET_EMAIL_SENT",
    targetUserId: userId,
    metadata: { via: "admin" },
  });
  revalidateAdminPaths();
  return { ok: true, message: "Şifre sıfırlama bağlantısı gönderildi.", action: "RESET_EMAIL_SENT" };
}

/** Bans the target user for ~100 years (effective permanent ban). */
export async function banUser(userId: string): Promise<AdminActionResult> {
  const admin = await requireAdminUser(ADMIN_USERS_PATH);
  const supabase = createSupabaseAdminClient();
  if (!supabase || !userId) {
    return { ok: false, message: "Kullanıcı bulunamadı." };
  }

  const { error } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: "876000h",
  });
  if (error) {
    console.error("Admin user ban failed:", error);
    return { ok: false, message: "Engelleme başarısız: " + error.message };
  }

  await logAdminAction(supabase, admin.id, {
    action: "USER_BANNED",
    targetUserId: userId,
  });
  revalidateAdminPaths();
  return { ok: true, message: "Kullanıcı engellendi.", action: "USER_BANNED" };
}

/** Removes an active ban, restoring normal access. */
export async function unbanUser(userId: string): Promise<AdminActionResult> {
  const admin = await requireAdminUser(ADMIN_USERS_PATH);
  const supabase = createSupabaseAdminClient();
  if (!supabase || !userId) {
    return { ok: false, message: "Kullanıcı bulunamadı." };
  }

  const { error } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: "none",
  });
  if (error) {
    console.error("Admin user unban failed:", error);
    return { ok: false, message: "Engel kaldırılamadı: " + error.message };
  }

  await logAdminAction(supabase, admin.id, {
    action: "USER_UNBANNED",
    targetUserId: userId,
  });
  revalidateAdminPaths();
  return { ok: true, message: "Kullanıcının engeli kaldırıldı.", action: "USER_UNBANNED" };
}

/** Grants real admin access by inserting a grant row into `admin_roles`. Idempotent. */
export async function makeAdmin(userId: string): Promise<AdminActionResult> {
  const admin = await requireAdminUser(ADMIN_USERS_PATH);
  const supabase = createSupabaseAdminClient();
  if (!supabase || !userId) {
    return { ok: false, message: "Kullanıcı bulunamadı." };
  }

  const { error } = await supabase
    .from("admin_roles")
    .upsert({ user_id: userId, granted_by: admin.id }, { onConflict: "user_id" });
  if (error) {
    console.error("Admin grant failed:", error);
    return { ok: false, message: "Admin yetkisi verilemedi: " + error.message };
  }

  await logAdminAction(supabase, admin.id, {
    action: "ADMIN_ROLE_GRANTED",
    targetUserId: userId,
  });
  revalidateAdminPaths();
  return { ok: true, message: "Kullanıcı admin yapıldı.", action: "ADMIN_ROLE_GRANTED" };
}

/**
 * Revokes a DB grant row from `admin_roles`.
 *
 * Self-protection + env-lock (§4): an admin can never demote themselves, and a
 * user whose admin access comes from the ADMIN_EMAILS allow-list is refused
 * rather than silently "revoked" — deleting a row can't change an env grant.
 */
export async function removeAdmin(userId: string): Promise<AdminActionResult> {
  const admin = await requireAdminUser(ADMIN_USERS_PATH);
  const supabase = createSupabaseAdminClient();
  if (!supabase || !userId) {
    return { ok: false, message: "Kullanıcı bulunamadı." };
  }

  if (userId === admin.id) {
    return { ok: false, message: "Kendinizi admin olmaktan çıkaramazsınız." };
  }

  const { data: target } = await supabase.auth.admin.getUserById(userId);
  const email = target?.user?.email;
  if (isAdminEmail(email)) {
    return { ok: false, message: "Bu kullanıcı ortam izniyle admin; buradan çıkarılamaz." };
  }

  const { error } = await supabase
    .from("admin_roles")
    .delete()
    .eq("user_id", userId);
  if (error) {
    console.error("Admin revocation failed:", error);
    return { ok: false, message: "Admin yetkisi kaldırılamadı: " + error.message };
  }

  await logAdminAction(supabase, admin.id, {
    action: "ADMIN_ROLE_REVOKED",
    targetUserId: userId,
  });
  revalidateAdminPaths();
  return { ok: true, message: "Admin yetkisi kaldırıldı.", action: "ADMIN_ROLE_REVOKED" };
}

/** Permanently deletes an auth user. Refuses self-deletion. */
export async function deleteUser(userId: string): Promise<AdminActionResult> {
  const admin = await requireAdminUser(ADMIN_USERS_PATH);
  const supabase = createSupabaseAdminClient();
  if (!supabase || !userId || userId === admin.id) {
    return { ok: false, message: "Bu kullanıcı silinemez." };
  }

  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) {
    console.error("Admin user delete failed:", error);
    return { ok: false, message: "Kullanıcı silinemedi: " + error.message };
  }

  await logAdminAction(supabase, admin.id, {
    action: "USER_DELETED",
    targetUserId: userId,
  });
  revalidateAdminPaths();
  return { ok: true, message: "Kullanıcı silindi.", action: "USER_DELETED" };
}
