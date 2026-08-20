"use server";

import { revalidatePath } from "next/cache";
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
const ALLOWED_AVATAR_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

// Uploaded avatars live under this storage bucket URL segment. Only URLs that
// contain it may ever have a storage object removed; preset avatars and any
// other path are served from /public and must never be deleted.
const AVATAR_STORAGE_MARKER = `/storage/v1/object/public/${AVATAR_BUCKET}/`;

function isLikelyImage(buf: Uint8Array) {
  if (buf.length < 8) return false;
  // PNG, JPEG (SOI + APP0/APP1), and WebP ("RIFF....WEBP") magic bytes.
  const head = Array.from(buf.slice(0, 8));
  const png = [137, 80, 78, 71, 13, 10, 26, 10];
  if (png.every((byte, i) => head[i] === byte)) return true;
  if (
    buf[0] === 0xff &&
    buf[1] === 0xd8 &&
    buf[2] === 0xff &&
    (buf[3] === 0xe0 || buf[3] === 0xe1)
  ) {
    return true;
  }
  const riff = Array.from(buf.slice(0, 4));
  const webp = Array.from(buf.slice(8, 12));
  if (
    [0x52, 0x49, 0x46, 0x46].every((byte, i) => riff[i] === byte) &&
    [0x57, 0x45, 0x42, 0x50].every((byte, i) => webp[i] === byte)
  ) {
    return true;
  }
  return false;
}

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
  if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
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
    file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const avatarUrl = publicAvatarUrl(user.id, ext);
  if (!avatarUrl) {
    return { ok: false, message: "Avatar adresi oluşturulamadı." };
  }

  const writeClient = createSupabaseAdminClient() ?? supabase;

  const { error: uploadError } = await writeClient.storage
    .from(AVATAR_BUCKET)
    .upload(`${user.id}.${ext}`, file, {
      contentType: file.type,
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
    return { ok: false, message: "Avatar kaldırılamadı. Lütfen tekrar deneyin." };
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
    return { ok: false, message: "Profil güncellenemedi. Lütfen tekrar deneyin." };
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
    return { ok: false, message: "Avatar kaydedilemedi. Lütfen tekrar deneyin." };
  }

  revalidatePath("/hesabim");
  return { ok: true, message: "Avatar güncellendi." };
}
