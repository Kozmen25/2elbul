import "server-only";

import { unstable_cache } from "next/cache";
import { CACHE_SECONDS, CACHE_TAGS } from "@/lib/cache-policy";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { isMissingSiteSettingsTable } from "@/lib/listing-status";

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

async function readGeneralSettings(): Promise<SiteGeneralSettings> {
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

async function readMaintenanceSettings(): Promise<SiteMaintenanceSettings> {
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

/**
 * Category slugs shown in the header menu. `null` means "not configured":
 * the header then lists every main category.
 */
export type HeaderCategorySettings = {
  slugs: string[] | null;
};

export const HEADER_CATEGORIES_KEY = "header_categories";

async function readHeaderCategorySettings(): Promise<HeaderCategorySettings> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { slugs: null };

  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", HEADER_CATEGORIES_KEY)
    .maybeSingle();

  const slugs = (data?.value as { slugs?: unknown } | null)?.slugs;
  if (error || !Array.isArray(slugs)) return { slugs: null };
  return { slugs: slugs.filter((slug): slug is string => typeof slug === "string") };
}

// Settings are read on every page render, so they are cached across requests
// and invalidated by the admin save actions (CACHE_TAGS.siteSettings).
const cacheOptions = { revalidate: CACHE_SECONDS.siteSettings, tags: [CACHE_TAGS.siteSettings] };

export const getSiteGeneralSettings = unstable_cache(
  readGeneralSettings,
  ["site-settings:general"],
  cacheOptions,
);

export const getSiteMaintenanceSettings = unstable_cache(
  readMaintenanceSettings,
  ["site-settings:maintenance"],
  cacheOptions,
);

export const getHeaderCategorySettings = unstable_cache(
  readHeaderCategorySettings,
  ["site-settings:header-categories"],
  cacheOptions,
);
