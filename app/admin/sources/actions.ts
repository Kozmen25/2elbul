"use server";

import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/admin";
import {
  insertListingsLegacy,
  normalizeSyncStatus,
  syncListingsForSource,
} from "@/lib/bots/listing-sync";
import type { BotAdapterListing } from "@/lib/bots/types";
import { isSupportedScrapeSource, runSourceScrapeBot } from "@/lib/bots/source-runner";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createDemoListings } from "./demo-data";

export type SourceInput = {
  id?: number;
  name: string;
  slug: string;
  baseUrl: string;
  type: string;
  integrationType: "manual" | "scrape" | "api";
  botListingStatus: "pending" | "published";
  apiUrl: string;
  scrapeUrl: string;
  cronEnabled: boolean;
  cronSchedule: string;
  productLimit: number;
};

export type SourceActionResult = {
  ok: boolean;
  message: string;
};

export async function createSource(
  input: SourceInput,
): Promise<SourceActionResult> {
  await requireAdminUser("/admin/sources");
  const supabase = createSupabaseAdminClient();
  if (!supabase) return missingAdminClient();

  const validated = validateSource(input);
  if (!validated.ok) return validated;

  const payload = {
    name: input.name.trim(),
    slug: normalizeSlug(input.slug),
    base_url: normalizeOptionalUrl(input.baseUrl),
    type: input.type.trim() || "marketplace",
    integration_type: input.integrationType,
    bot_listing_status: input.botListingStatus,
    bot_import_mode: input.botListingStatus,
    api_url: normalizeOptionalUrl(input.apiUrl),
    scrape_url: normalizeOptionalUrl(input.scrapeUrl),
    cron_enabled: input.cronEnabled,
    cron_schedule: input.cronSchedule.trim(),
    product_limit: input.productLimit,
    fetch_limit: input.productLimit,
  };
  let insertResult = await supabase.from("sources").insert(payload);

  if (
    insertResult.error &&
    isMissingIntegrationSettingsColumn(insertResult.error)
  ) {
    insertResult = await supabase
      .from("sources")
      .insert(withoutIntegrationSettings(payload));
  }
  if (
    insertResult.error &&
    isMissingBotListingStatusColumn(insertResult.error)
  ) {
    const { bot_listing_status: _status, ...legacyPayload } =
      withoutIntegrationSettings(payload);
    insertResult = await supabase.from("sources").insert(legacyPayload);
  }

  if (insertResult.error) {
    console.error("Admin source create failed:", insertResult.error);
    return {
      ok: false,
      message: `Kaynak eklenemedi: ${insertResult.error.message}`,
    };
  }

  revalidateSources();
  return { ok: true, message: "Kaynak eklendi." };
}

export async function updateSource(
  input: SourceInput,
): Promise<SourceActionResult> {
  await requireAdminUser("/admin/sources");
  const supabase = createSupabaseAdminClient();
  if (!supabase) return missingAdminClient();

  const validated = validateSource(input);
  if (!validated.ok) return validated;
  if (!Number.isInteger(input.id)) {
    return { ok: false, message: "Geçersiz kaynak kimliği." };
  }

  const payload = {
    name: input.name.trim(),
    slug: normalizeSlug(input.slug),
    base_url: normalizeOptionalUrl(input.baseUrl),
    type: input.type.trim() || "marketplace",
    integration_type: input.integrationType,
    bot_listing_status: input.botListingStatus,
    bot_import_mode: input.botListingStatus,
    api_url: normalizeOptionalUrl(input.apiUrl),
    scrape_url: normalizeOptionalUrl(input.scrapeUrl),
    cron_enabled: input.cronEnabled,
    cron_schedule: input.cronSchedule.trim(),
    product_limit: input.productLimit,
    fetch_limit: input.productLimit,
  };
  let updateResult = await supabase
    .from("sources")
    .update(payload)
    .eq("id", input.id!);

  if (
    updateResult.error &&
    isMissingIntegrationSettingsColumn(updateResult.error)
  ) {
    updateResult = await supabase
      .from("sources")
      .update(withoutIntegrationSettings(payload))
      .eq("id", input.id!);
  }
  if (
    updateResult.error &&
    isMissingBotListingStatusColumn(updateResult.error)
  ) {
    const { bot_listing_status: _status, ...legacyPayload } =
      withoutIntegrationSettings(payload);
    updateResult = await supabase
      .from("sources")
      .update(legacyPayload)
      .eq("id", input.id!);
  }

  if (updateResult.error) {
    console.error("Admin source update failed:", updateResult.error);
    return {
      ok: false,
      message: `Kaynak güncellenemedi: ${updateResult.error.message}`,
    };
  }

  revalidateSources();
  return { ok: true, message: "Kaynak güncellendi." };
}

export async function toggleSource(
  id: number,
  isActive: boolean,
): Promise<SourceActionResult> {
  await requireAdminUser("/admin/sources");
  const supabase = createSupabaseAdminClient();
  if (!supabase) return missingAdminClient();
  if (!Number.isInteger(id)) {
    return { ok: false, message: "Geçersiz kaynak kimliği." };
  }

  const { error } = await supabase
    .from("sources")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) {
    console.error("Admin source toggle failed:", error);
    return { ok: false, message: `Durum değiştirilemedi: ${error.message}` };
  }

  revalidateSources();
  return {
    ok: true,
    message: isActive ? "Kaynak aktifleştirildi." : "Kaynak pasifleştirildi.",
  };
}

export async function deleteSource(id: number): Promise<SourceActionResult> {
  await requireAdminUser("/admin/sources");
  const supabase = createSupabaseAdminClient();
  if (!supabase) return missingAdminClient();
  if (!Number.isInteger(id)) {
    return { ok: false, message: "Geçersiz kaynak kimliği." };
  }

  const { error } = await supabase.from("sources").delete().eq("id", id);
  if (error) {
    console.error("Admin source delete failed:", error);
    return { ok: false, message: `Kaynak silinemedi: ${error.message}` };
  }

  revalidateSources();
  return { ok: true, message: "Kaynak silindi." };
}

export async function runDemoBot(
  sourceId: number,
): Promise<SourceActionResult> {
  await requireAdminUser("/admin/sources");
  const supabase = createSupabaseAdminClient();
  if (!supabase) return missingAdminClient();
  if (!Number.isInteger(sourceId)) {
    return { ok: false, message: "Geçersiz kaynak kimliği." };
  }

  const { data: source, error: sourceError } = await supabase
    .from("sources")
    .select("id, name, slug, total_imported, bot_listing_status, bot_import_mode")
    .eq("id", sourceId)
    .maybeSingle();

  if (sourceError || !source) {
    if (sourceError) console.error("Demo bot source lookup failed:", sourceError);
    return {
      ok: false,
      message: sourceError
        ? `Kaynak okunamadı: ${sourceError.message}`
        : "Kaynak bulunamadı.",
    };
  }

  const startedAt = new Date();
  const { data: botRun, error: runInsertError } = await supabase
    .from("bot_runs")
    .insert({
      source_id: sourceId,
      status: "running",
      run_type: "test",
      started_at: startedAt.toISOString(),
    })
    .select("id")
    .single();

  if (runInsertError || !botRun) {
    if (runInsertError) {
      console.error("Demo bot run insert failed:", runInsertError);
    }
    return {
      ok: false,
      message: runInsertError
        ? `Bot çalışması başlatılamadı: ${runInsertError.message}`
        : "Bot çalışma kaydı oluşturulamadı.",
    };
  }

  const runId = Number(botRun.id);
  const runToken = `${Date.now()}-${runId}`;
  const listings = createDemoListings(
    String(source.name),
    String(source.slug),
    runToken,
    source.bot_import_mode === "published" ||
      source.bot_listing_status === "published"
      ? "published"
      : "pending",
  );
  let imported = 0;
  let updated = 0;
  let inactive = 0;
  let reactivated = 0;
  let skipped = 0;
  let errorCount = 0;
  const errors: string[] = [];

  try {
    const syncListings: BotAdapterListing[] = listings.map((listing) => ({
      ...listing,
      status:
        listing.status === "pending"
          ? "pending"
          : (normalizeSyncStatus(listing.status) as BotAdapterListing["status"]),
    }));

    let result;
    try {
      result = await syncListingsForSource(supabase, sourceId, syncListings);
    } catch (syncError) {
      console.warn("Demo bot sync RPC unavailable, falling back:", syncError);
      result = await insertListingsLegacy(supabase, syncListings);
    }

    imported = result.imported;
    updated = result.updated;
    inactive = result.inactive;
    reactivated = result.reactivated;
    skipped = result.skipped;
    errorCount = result.errorCount;
    errors.push(...result.errors);
  } catch (error) {
    console.error("Demo bot execution failed:", error);
    errorCount += Math.max(listings.length - imported - skipped, 1);
    errors.push(getErrorMessage(error));
  }

  const finishedAt = new Date().toISOString();
  const finalStatus = errorCount > 0 ? "failed" : "success";
  const errorMessage = errors.length ? errors.join(" | ").slice(0, 4000) : null;

  const { error: runUpdateError } = await supabase
    .from("bot_runs")
    .update({
      status: finalStatus,
      found_count: listings.length,
      imported_count: imported,
      updated_count: updated,
      inactive_count: inactive,
      reactivated_count: reactivated,
      skipped_count: skipped,
      error_count: errorCount,
      error_message: errorMessage,
      finished_at: finishedAt,
    })
    .eq("id", runId);

  if (runUpdateError) {
    console.error("Demo bot run finalization failed:", runUpdateError);
  }

  const sourceStatsPayload = {
    last_run_at: finishedAt,
    total_imported: Number(source.total_imported ?? 0) + imported,
    ...(finalStatus === "success" ? { last_success: finishedAt } : {}),
  };
  let sourceUpdateResult = await supabase
    .from("sources")
    .update(sourceStatsPayload)
    .eq("id", sourceId);

  if (
    sourceUpdateResult.error &&
    isMissingIntegrationSettingsColumn(sourceUpdateResult.error)
  ) {
    const { last_success: _lastSuccess, ...legacyStatsPayload } =
      sourceStatsPayload;
    sourceUpdateResult = await supabase
      .from("sources")
      .update(legacyStatsPayload)
      .eq("id", sourceId);
  }

  if (sourceUpdateResult.error) {
    console.error(
      "Demo bot source stats update failed:",
      sourceUpdateResult.error,
    );
  }

  revalidateSources();
  revalidatePath("/admin/listings");
  revalidatePath("/admin");

  if (runUpdateError || sourceUpdateResult.error) {
    return {
      ok: false,
      message:
        "İlanlar işlendi ancak bot istatistiklerinin bir bölümü güncellenemedi.",
    };
  }

  return {
    ok: finalStatus === "success",
    message:
      finalStatus === "success"
        ? `Test çekimi tamamlandı: ${imported} yeni, ${updated} güncellendi, ${skipped} atlandı.`
        : `Test çekimi hatayla tamamlandı: ${imported} yeni, ${updated} güncellendi, ${skipped} atlandı, ${errorCount} hata.`,
  };
}

export async function runRealBot(
  sourceId: number,
): Promise<SourceActionResult> {
  await requireAdminUser("/admin/sources");
  const supabase = createSupabaseAdminClient();
  if (!supabase) return missingAdminClient();
  if (!Number.isInteger(sourceId)) {
    return { ok: false, message: "Geçersiz kaynak kimliği." };
  }

  let sourceResult = await supabase
    .from("sources")
    .select(
      "id, name, slug, total_imported, scrape_url, product_limit, fetch_limit, bot_import_mode, bot_listing_status",
    )
    .eq("id", sourceId)
    .maybeSingle();

  if (
    sourceResult.error &&
    isMissingIntegrationSettingsColumn(sourceResult.error)
  ) {
    sourceResult = await supabase
      .from("sources")
      .select("id, name, slug, total_imported, scrape_url, product_limit, bot_listing_status")
      .eq("id", sourceId)
      .maybeSingle();
  }

  const source = sourceResult.data as {
    id: number;
    name: string;
    slug: string;
    total_imported: number | null;
    scrape_url?: string | null;
    product_limit?: number | null;
    fetch_limit?: number | null;
    bot_import_mode?: string | null;
    bot_listing_status?: string | null;
  } | null;

  if (sourceResult.error || !source) {
    if (sourceResult.error) {
      console.error("Real bot source lookup failed:", sourceResult.error);
    }
    return {
      ok: false,
      message: sourceResult.error
        ? `Kaynak okunamadı: ${sourceResult.error.message}`
        : "Kaynak bulunamadı.",
    };
  }

  if (!isSupportedScrapeSource(source.slug)) {
    return {
      ok: false,
      message:
        "Gerçek test çekimi bu kaynak için henüz hazır değil.",
    };
  }

  const result = await runSourceScrapeBot(supabase, source, {
    runType: "real_test",
    maxLimit: 10,
    forceStatus: "pending",
  });

  revalidateSources();
  revalidatePath("/admin/listings");
  revalidatePath("/admin");

  if (!result.found && result.ok) {
    return {
      ok: true,
      message: `${source.name} çekimi tamamlandı ancak ürün bulunamadı. Kaynak HTML yapısı değişmiş veya ürün verisini geçici olarak kaldırmış olabilir.`,
    };
  }

  return {
    ok: result.ok,
    message: result.ok
      ? `Gerçek test çekimi tamamlandı: ${result.imported} yeni, ${result.updated} güncellendi, ${result.inactive} pasif, ${result.reactivated} tekrar aktif, ${result.skipped} atlandı.`
      : `Gerçek test çekimi tamamlanamadı: ${result.errorMessage ?? `${result.errorCount} hata oluştu.`}`,
  };
}
function validateSource(input: SourceInput): SourceActionResult {
  const name = input.name.trim();
  const slug = normalizeSlug(input.slug);
  const type = input.type.trim();
  const integrationType = input.integrationType;
  const botListingStatus = input.botListingStatus;
  const productLimit = Number(input.productLimit);

  if (
    !name ||
    !slug ||
    !type ||
    !["manual", "scrape", "api"].includes(integrationType) ||
    !["pending", "published"].includes(botListingStatus) ||
    !input.cronSchedule.trim() ||
    !Number.isInteger(productLimit) ||
    productLimit < 1 ||
    productLimit > 1000
  ) {
    return {
      ok: false,
      message:
        "Ad, slug, kaynak tipi, çekim sıklığı ve 1-1000 arası ürün limiti zorunludur.",
    };
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return {
      ok: false,
      message: "Slug yalnızca küçük harf, sayı ve tire içerebilir.",
    };
  }
  for (const [label, value] of [
    ["Kaynak linki", input.baseUrl],
    ["API adresi", input.apiUrl],
    ["Tarama adresi", input.scrapeUrl],
  ]) {
    if (!value.trim()) continue;
    try {
      const url = new URL(value.trim());
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    } catch {
      return { ok: false, message: `${label} geçerli bir URL olmalıdır.` };
    }
  }
  return { ok: true, message: "" };
}

function normalizeSlug(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

function normalizeOptionalUrl(value: string) {
  return value.trim() || null;
}

function missingAdminClient(): SourceActionResult {
  return {
    ok: false,
    message: "Supabase service-role bağlantısı yapılandırılmamış.",
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "Bilinmeyen bot hatası";
}

function isMissingBotListingStatusColumn(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: string; message?: string; details?: string };
  const text = `${record.message ?? ""} ${record.details ?? ""}`.toLowerCase();
  return (
    record.code === "42703" ||
    record.code === "PGRST204" ||
    (text.includes("bot_listing_status") &&
      (text.includes("column") || text.includes("schema cache")))
  );
}

function isMissingIntegrationSettingsColumn(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: string; message?: string; details?: string };
  const text = `${record.message ?? ""} ${record.details ?? ""}`.toLowerCase();
  return (
    record.code === "42703" ||
    record.code === "PGRST204" ||
    [
      "api_url",
      "scrape_url",
      "cron_enabled",
      "cron_schedule",
      "product_limit",
      "fetch_limit",
      "integration_type",
      "bot_import_mode",
      "last_success",
    ]
      .some((column) => text.includes(column))
  );
}

function withoutIntegrationSettings<T extends Record<string, unknown>>(
  payload: T,
) {
  const {
    api_url: _apiUrl,
    scrape_url: _scrapeUrl,
    cron_enabled: _cronEnabled,
    cron_schedule: _cronSchedule,
    product_limit: _productLimit,
    fetch_limit: _fetchLimit,
    integration_type: _integrationType,
    bot_import_mode: _botImportMode,
    ...legacyPayload
  } = payload;
  return legacyPayload;
}

function revalidateSources() {
  revalidatePath("/admin/sources");
  revalidatePath("/admin/bot-runs");
}
