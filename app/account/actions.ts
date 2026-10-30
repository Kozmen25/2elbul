"use server";

import { revalidatePath } from "next/cache";
import { isLikelyImage } from "@/lib/image-signature";
import { compactSettings } from "@/lib/notifications/preferences";
import { isPresetAvatarId, presetAvatarUrl } from "@/lib/preset-avatars";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getSupabaseConfig } from "@/lib/supabase-config";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export type AccountActionResult = {
  ok: boolean;
  message: string;
  requiresAuth?: boolean;
};

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB

// Canonicalize the many spellings browsers/OSes attach to the same image format
// (image/jpg vs image/jpeg, image/x-png vs image/png, image/pjpeg) so real
// uploads aren't wrongly rejected and the storage contentType stays canonical.
function normalizeMimeType(type: string): string {
  const t = String(type ?? "").toLowerCase().trim();
  if (t === "image/jpg" || t === "image/pjpeg") return "image/jpeg";
  if (t === "image/x-png") return "image/png";
  return t;
}

const ALLOWED_AVATAR_TYPES = new Set([
  normalizeMimeType("image/png"),
  normalizeMimeType("image/jpeg"),
  normalizeMimeType("image/webp"),
]);

// Uploaded avatars live under this storage bucket URL segment. Only URLs that
// contain it may ever have a storage object removed; preset avatars and any
// other path are served from /public and must never be deleted.
const AVATAR_STORAGE_MARKER = `/storage/v1/object/public/${AVATAR_BUCKET}/`;

function publicAvatarUrl(userId: string, extension: string) {
  const config = getSupabaseConfig();
  if (!config) return null;
  return `${config.url}/storage/v1/object/public/${AVATAR_BUCKET}/${userId}.${extension}`;
}

export async function uploadAvatar(
  formData: FormData,
): Promise<AccountActionResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, message: "Supabase bağlantısı yapılandırılmamış." };
  }
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return {
      ok: false,
      requiresAuth: true,
      message: "Bu işlem için giriş yapmalısınız.",
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Yüklenecek bir dosya seçin." };
  }
  const mimeType = normalizeMimeType(file.type);
  if (!ALLOWED_AVATAR_TYPES.has(mimeType)) {
    return {
      ok: false,
      message: "Sadece PNG, JPEG veya WebP dosyası yükleyebilirsiniz.",
    };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { ok: false, message: "Dosya en fazla 2 MB olabilir." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isLikelyImage(bytes)) {
    return { ok: false, message: "Dosya geçerli bir görsel değil." };
  }

  const ext =
    mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  const avatarUrl = publicAvatarUrl(user.id, ext);
  if (!avatarUrl) {
    return { ok: false, message: "Avatar adresi oluşturulamadı." };
  }

  const writeClient = createSupabaseAdminClient() ?? supabase;

  const { error: uploadError } = await writeClient.storage
    .from(AVATAR_BUCKET)
    .upload(`${user.id}.${ext}`, file, {
      contentType: mimeType,
      upsert: true,
      cacheControl: "3600",
    });

  if (uploadError) {
    console.error("Avatar upload failed:", uploadError);
    return { ok: false, message: "Avatar yüklenemedi. Lütfen tekrar deneyin." };
  }

  const { error: profileError } = await writeClient.from("profiles").upsert(
    {
      user_id: user.id,
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (profileError) {
    console.error("Profile avatar update failed:", profileError);
    return { ok: false, message: "Avatar kaydedilemedi. Lütfen tekrar deneyin." };
  }

  revalidatePath("/hesabim");
  return { ok: true, message: "Avatar güncellendi." };
}

export async function deleteAvatar(): Promise<AccountActionResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, message: "Supabase bağlantısı yapılandırılmamış." };
  }
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return {
      ok: false,
      requiresAuth: true,
      message: "Bu işlem için giriş yapmalısınız.",
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profile?.avatar_url) {
    const url = String(profile.avatar_url);
    // Only remove a real storage object. Preset avatars (and anything else,
    // e.g. /public paths) are never storage-backed and must not be removed.
    if (url.includes(AVATAR_STORAGE_MARKER)) {
      const objectPath = url.slice(url.indexOf(AVATAR_STORAGE_MARKER) + AVATAR_STORAGE_MARKER.length);
      if (objectPath) {
        const writeClient = createSupabaseAdminClient() ?? supabase;
        const { error } = await writeClient.storage
          .from(AVATAR_BUCKET)
          .remove([decodeURIComponent(objectPath)]);
        if (error) {
          console.error("Avatar delete failed:", error);
        }
      }
    }
  }

  const writeClient = createSupabaseAdminClient() ?? supabase;
  const { error: profileError } = await writeClient
    .from("profiles")
    .update({ avatar_url: null, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);

  if (profileError) {
    console.error("Profile avatar clear failed:", profileError);
    return { ok: false, message: profileWriteErrorMessage(profileError, "Avatar kaldırılamadı. Lütfen tekrar deneyin.") };
  }

  revalidatePath("/hesabim");
  return { ok: true, message: "Avatar kaldırıldı." };
}

export async function updateProfile(
  _previousState: AccountActionResult | undefined,
  formData: FormData,
): Promise<AccountActionResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, message: "Supabase bağlantısı yapılandırılmamış." };
  }
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return {
      ok: false,
      requiresAuth: true,
      message: "Bu işlem için giriş yapmalısınız.",
    };
  }

  const displayName = String(formData.get("displayName") ?? "").trim().slice(0, 80);
  const location = String(formData.get("location") ?? "").trim().slice(0, 120);
  const bio = String(formData.get("bio") ?? "").trim().slice(0, 300);

  const writeClient = createSupabaseAdminClient() ?? supabase;
  const { error } = await writeClient.from("profiles").upsert(
    {
      user_id: user.id,
      display_name: displayName || null,
      location: location || null,
      bio: bio || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("Profile update failed:", error);
    return { ok: false, message: profileWriteErrorMessage(error, "Profil güncellenemedi. Lütfen tekrar deneyin.") };
  }

  revalidatePath("/hesabim");
  return { ok: true, message: "Profil güncellendi." };
}

/**
 * Server action used by the avatar picker (non-form, no action state). Only a
 * whitelisted preset id accepted; the preset id is turned into its static URL.
 */
export async function setAvatarPreset(
  presetId: string,
): Promise<AccountActionResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, message: "Supabase bağlantısı yapılandırılmamış." };
  }
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return {
      ok: false,
      requiresAuth: true,
      message: "Bu işlem için giriş yapmalısınız.",
    };
  }

  if (!isPresetAvatarId(presetId)) {
    return { ok: false, message: "Geçersiz avatar seçildi." };
  }

  const avatarUrl = presetAvatarUrl(presetId);
  const writeClient = createSupabaseAdminClient() ?? supabase;
  const { error } = await writeClient.from("profiles").upsert(
    {
      user_id: user.id,
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("Profile preset avatar update failed:", error);
    return { ok: false, message: profileWriteErrorMessage(error) };
  }

  revalidatePath("/hesabim");
  return { ok: true, message: "Avatar güncellendi." };
}

/** Map PostgREST / Postgres write failures to a clear Turkish message. */
function profileWriteErrorMessage(
  error: { code?: string; message?: string } | null | undefined,
  fallback = "Avatar kaydedilemedi. Lütfen tekrar deneyin.",
): string {
  const code = String(error?.code ?? "");
  const msg = String(error?.message ?? "").toLowerCase();
  // Table missing (migration not applied) — PGRST205 / schema cache miss.
  if (
    code === "PGRST205" ||
    code === "42P01" ||
    msg.includes("could not find the table") ||
    msg.includes("does not exist")
  ) {
    return "Profil tablosu henüz kurulmamış. Supabase migration uygulanmalı.";
  }
  // RLS deny — no matching policy / row not visible.
  if (code === "42501" || msg.includes("row-level security") || msg.includes("permission denied")) {
    return "Profil yazma yetkisi yok. Lütfen tekrar giriş yapıp deneyin.";
  }
  return fallback;
}

/**
 * Switches e-mail copies of notifications (price alerts, price drops, saved
 * searches) on or off for the signed-in user. In-app notifications and account
 * e-mails (sign-up confirmation, password reset) are not affected.
 */
export async function setEmailNotifications(enabled: boolean): Promise<AccountActionResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, message: "Supabase bağlantısı yapılandırılmamış." };

  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false, requiresAuth: true, message: "Bu işlem için giriş yapmalısınız." };

  // upsert: the profile row is normally created at sign-up, but older accounts may lack it.
  const { error } = await supabase
    .from("profiles")
    .upsert({ user_id: data.user.id, email_notifications: Boolean(enabled) }, { onConflict: "user_id" });

  if (error) {
    console.error("Email notification preference save failed:", error);
    return { ok: false, message: "Tercih kaydedilemedi. Lütfen tekrar deneyin." };
  }

  revalidatePath("/hesabim");
  return {
    ok: true,
    message: enabled ? "E-posta bildirimleri açıldı." : "E-posta bildirimleri kapatıldı. Uygulama içi bildirimler devam eder.",
  };
}

/**
 * Saves which notification kinds the signed-in user wants in the app and by
 * e-mail. `grid` is the complete kind x channel grid from the account page;
 * only values that differ from the default ("on") are stored.
 */
export async function saveNotificationSettings(grid: unknown): Promise<AccountActionResult> {
  const settings = compactSettings(grid);
  if (!settings) return { ok: false, message: "Geçersiz bildirim tercihi." };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, message: "Supabase bağlantısı yapılandırılmamış." };

  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false, requiresAuth: true, message: "Bu işlem için giriş yapmalısınız." };

  const { error } = await supabase
    .from("profiles")
    .upsert({ user_id: data.user.id, notification_settings: settings }, { onConflict: "user_id" });

  if (error) {
    console.error("Notification settings save failed:", error);
    return { ok: false, message: "Tercih kaydedilemedi. Lütfen tekrar deneyin." };
  }

  revalidatePath("/hesabim");
  return { ok: true, message: "Bildirim tercihlerin kaydedildi." };
}
