import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type SiteGeneralSettings = {
  siteName: string;
  siteDescription: string;
};

export type SiteMaintenanceSettings = {
  enabled: boolean;
  message: string;
};

const DEFAULT_GENERAL: SiteGeneralSettings = {
  siteName: "2ElBul",
  siteDescription: "İkinci elin fiyat rehberi.",
};

const DEFAULT_MAINTENANCE: SiteMaintenanceSettings = {
  enabled: false,
  message:
    "Planlı bakım çalışması yapılıyor. Kısa süre içinde tekrar hizmetinizdeyiz.",
};

export async function getSiteGeneralSettings(): Promise<SiteGeneralSettings> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return DEFAULT_GENERAL;

  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "general")
    .maybeSingle();

  if (error || !data?.value) return DEFAULT_GENERAL;
  const value = data.value as Partial<SiteGeneralSettings>;
  return {
    siteName: String(value.siteName ?? DEFAULT_GENERAL.siteName),
    siteDescription: String(
      value.siteDescription ?? DEFAULT_GENERAL.siteDescription,
    ),
  };
}

export async function getSiteMaintenanceSettings(): Promise<SiteMaintenanceSettings> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return DEFAULT_MAINTENANCE;

  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "maintenance")
    .maybeSingle();

  if (error || !data?.value) return DEFAULT_MAINTENANCE;
  const value = data.value as Partial<SiteMaintenanceSettings>;
  return {
    enabled: Boolean(value.enabled),
    message: String(value.message ?? DEFAULT_MAINTENANCE.message),
  };
}

export function isMissingSiteSettingsTable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: string; message?: string; details?: string };
  const text = `${record.message ?? ""} ${record.details ?? ""}`.toLowerCase();
  return (
    record.code === "42P01" ||
    record.code === "PGRST205" ||
    (text.includes("site_settings") &&
      (text.includes("relation") || text.includes("schema cache")))
  );
}
