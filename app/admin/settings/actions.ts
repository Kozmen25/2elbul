"use server";

import { revalidatePath } from "next/cache";
import { invalidateCacheTag, CACHE_TAGS } from "@/lib/cache-policy";
import { getAllCategories } from "@/lib/categories";
import { MAX_HEADER_CATEGORIES } from "@/lib/header-category-limits";
import { HEADER_CATEGORIES_KEY } from "@/lib/site-settings";
import { requireAdminUser } from "@/lib/admin";
import { isMissingSiteSettingsTable } from "@/lib/listing-status";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type SettingsActionResult = {
  ok: boolean;
  message: string;
};

export async function saveSiteGeneralSettings(input: {
  siteName: string;
  siteDescription: string;
}): Promise<SettingsActionResult> {
  await requireAdminUser("/admin/settings");
  const supabase = createSupabaseAdminClient();
  if (!supabase) return missingClient();

  const siteName = input.siteName.trim();
  const siteDescription = input.siteDescription.trim();
  if (!siteName || !siteDescription) {
    return { ok: false, message: "Site adı ve açıklama zorunludur." };
  }

  const { error } = await supabase.from("site_settings").upsert(
    {
      key: "general",
      value: { siteName, siteDescription },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  if (error) {
    if (isMissingSiteSettingsTable(error)) {
      return migrationRequired();
    }
    console.error("Site general settings save failed:", error);
    return { ok: false, message: `Kaydedilemedi: ${error.message}` };
  }

  refreshSiteSettings();
  return { ok: true, message: "Site bilgileri kaydedildi." };
}

export async function saveMaintenanceSettings(input: {
  enabled: boolean;
  message: string;
}): Promise<SettingsActionResult> {
  await requireAdminUser("/admin/settings");
  const supabase = createSupabaseAdminClient();
  if (!supabase) return missingClient();

  const message =
    input.message.trim() ||
    "Planlı bakım çalışması yapılıyor. Kısa süre içinde tekrar hizmetinizdeyiz.";

  const { error } = await supabase.from("site_settings").upsert(
    {
      key: "maintenance",
      value: { enabled: input.enabled, message },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  if (error) {
    if (isMissingSiteSettingsTable(error)) {
      return migrationRequired();
    }
    console.error("Maintenance settings save failed:", error);
    return { ok: false, message: `Kaydedilemedi: ${error.message}` };
  }

  refreshSiteSettings();
  return {
    ok: true,
    message: input.enabled
      ? "Bakım modu etkinleştirildi."
      : "Bakım modu kapatıldı.",
  };
}

/**
 * Public pages are cached (ISR) and embed the header, site name and the
 * maintenance gate, so a settings change must expire both the shared settings
 * cache and every cached page.
 */
function refreshSiteSettings() {
  invalidateCacheTag(CACHE_TAGS.siteSettings);
  revalidatePath("/", "layout");
}

export async function saveHeaderCategories(input: {
  /** `null` restores the default: every main category. */
  slugs: string[] | null;
}): Promise<SettingsActionResult> {
  await requireAdminUser("/admin/settings");
  const supabase = createSupabaseAdminClient();
  if (!supabase) return missingClient();

  let slugs: string[] | null = null;
  if (input.slugs !== null) {
    const known = new Set((await getAllCategories()).map((category) => category.slug));
    slugs = [...new Set(input.slugs)].filter((slug) => known.has(slug));
    if (slugs.length > MAX_HEADER_CATEGORIES) {
      return {
        ok: false,
        message: `Menüde en fazla ${MAX_HEADER_CATEGORIES} kategori gösterilebilir.`,
      };
    }
  }

  const { error } = await supabase.from("site_settings").upsert(
    {
      key: HEADER_CATEGORIES_KEY,
      value: { slugs },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  if (error) {
    if (isMissingSiteSettingsTable(error)) return migrationRequired();
    console.error("Header categories save failed:", error);
    return { ok: false, message: `Kaydedilemedi: ${error.message}` };
  }

  refreshSiteSettings();
  return {
    ok: true,
    message:
      slugs === null
        ? "Menü varsayılana döndü: tüm ana kategoriler gösterilecek."
        : `Menüde ${slugs.length} kategori gösterilecek.`,
  };
}

function missingClient(): SettingsActionResult {
  return {
    ok: false,
    message: "Supabase service-role bağlantısı yapılandırılmamış.",
  };
}

function migrationRequired(): SettingsActionResult {
  return {
    ok: false,
    message:
      "site_settings tablosu bulunamadı. Önce supabase/site-settings.sql dosyasını çalıştırın.",
  };
}
