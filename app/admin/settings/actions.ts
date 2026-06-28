"use server";

import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/admin";
import { isMissingSiteSettingsTable } from "@/lib/site-settings";
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

  revalidatePath("/admin/settings");
  revalidatePath("/");
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

  revalidatePath("/admin/settings");
  revalidatePath("/");
  return {
    ok: true,
    message: input.enabled
      ? "Bakım modu etkinleştirildi."
      : "Bakım modu kapatıldı.",
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
