import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SCRAPE_READY_SLUGS,
  getStandardSourceAdapter,
} from "@/lib/bots/connectors";
import { isRecord } from "@/lib/records";
import {
  normalizeSyncStatus,
  syncListingsForSource,
} from "@/lib/bots/listing-sync";
import type { DuplicateBatchSummary } from "@/lib/product-matcher";
import type { BotAdapterListing } from "@/lib/bots/types";

export type SourceRunRecord = {
  id: number;
  name: string;
  slug: string;
  scrape_url?: string | null;
  total_imported?: number | null;
  fetch_limit?: number | null;
  product_limit?: number | null;
  bot_import_mode?: string | null;
  bot_listing_status?: string | null;
};

export type SourceRunResult = {
  ok: boolean;
  sourceId: number;
  sourceName: string;
  status: "success" | "failed";
  found: number;
  imported: number;
  updated: number;
  inactive: number;
  reactivated: number;
  skipped: number;
  matchedProducts: number;
  errorCount: number;
  errorMessage: string | null;
  durationMs: number;
  duplicateSummary: DuplicateBatchSummary | null;
};

type RunSourceOptions = {
  runType: "real_test" | "scheduled";
  maxLimit?: number;
  forceStatus?: "pending" | "published" | "active";
  skipInactiveMarking?: boolean;
};

export function isSupportedScrapeSource(slug: string) {
  return SCRAPE_READY_SLUGS.includes(slug);
}

export async function runSourceScrapeBot(
  supabase: SupabaseClient,
  source: SourceRunRecord,
  options: RunSourceOptions,
): Promise<SourceRunResult> {
  if (!isSupportedScrapeSource(source.slug)) {
    return emptyFailedResult(
      source,
      "Gerçek çekim bu kaynak için henüz hazır değil. Desteklenen kaynaklar: EasyCep, Getmobil, Yenilenmiş Market, Teknosa, Hepsiburada ve MediaMarkt.",
    );
  }

  const startedAt = new Date().toISOString();
  const { data: botRun, error: runInsertError } = await supabase
    .from("bot_runs")
    .insert({
      source_id: source.id,
      status: "running",
      run_type: options.runType,
      started_at: startedAt,
    })
    .select("id")
    .single();

  if (runInsertError || !botRun) {
    const message =
      runInsertError?.message ?? "Bot çalışma kaydı oluşturulamadı.";
    console.error("Source bot run insert failed:", runInsertError);
    return emptyFailedResult(source, message);
  }

  const runId = Number(botRun.id);
  const limit = normalizeLimit(
    source.fetch_limit ?? source.product_limit ?? 10,
    options.maxLimit,
  );
  const listingStatus = normalizeSyncStatus(
    options.forceStatus ??
      normalizeImportMode(source.bot_import_mode) ??
      normalizeImportMode(source.bot_listing_status) ??
      "published",
  );

  let listings: BotAdapterListing[] = [];
  let imported = 0;
  let updated = 0;
  let inactive = 0;
  let reactivated = 0;
  let skipped = 0;
  let matchedProducts = 0;
  let errorCount = 0;
  const errors: string[] = [];
  let duplicateSummary: DuplicateBatchSummary | null = null;
  let finalStatus: "success" | "failed" = "success";
  let durationMs = 0;

  try {
    const adapter = getStandardSourceAdapter({
      sourceId: source.id,
      sourceName: source.name,
      sourceSlug: source.slug,
      apiUrl: null,
      scrapeUrl: source.scrape_url ?? null,
      cronEnabled: true,
      cronSchedule: "",
      productLimit: limit,
    });
    const adapterResult = await adapter.sync();
    durationMs = adapterResult.duration_ms;
    const adapterSkipped = adapterResult.skipped;
    errorCount += adapterResult.errors.length;
    errors.push(...adapterResult.errors);

    listings = adapterResultToBotListings(adapterResult.listings);
    listings = listings.slice(0, limit).map((listing) => ({
      ...listing,
      status: listingStatus,
    }));

    if (!listings.length) {
      errors.push("Ürün bulunamadı veya HTML yapısı değişmiş olabilir");
    } else {
      const result = await syncListingsForSource(supabase, source.id, listings, {
        skipInactiveMarking: options.skipInactiveMarking,
      });
      imported = result.imported;
      updated = result.updated;
      inactive = result.inactive;
      reactivated = result.reactivated;
      skipped = result.skipped + adapterSkipped;
      matchedProducts = result.matchedProducts;
      errorCount += result.errorCount;
      errors.push(...result.errors);
      duplicateSummary = result.duplicateSummary;
      if (errorCount > 0) finalStatus = "failed";
    }
  } catch (error) {
    console.error("Source bot execution failed:", error);
    finalStatus = "failed";
    errorCount = 1;
    errors.push(getErrorMessage(error));
  }

  const finishedAt = new Date().toISOString();
  const errorMessage = errors.length ? errors.join(" | ").slice(0, 4000) : null;
  const runPayload = {
    status: finalStatus,
    found_count: listings.length,
    imported_count: imported,
    updated_count: updated,
    inactive_count: inactive,
    reactivated_count: reactivated,
    matched_product_count: matchedProducts,
    skipped_count: skipped,
    error_count: errorCount,
    error_message: errorMessage,
    finished_at: finishedAt,
  };
  let runUpdate = await supabase
    .from("bot_runs")
    .update(runPayload)
    .eq("id", runId);

  if (
    runUpdate.error &&
    isMissingColumn(runUpdate.error, [
      "updated_count",
      "inactive_count",
      "reactivated_count",
    ])
  ) {
    const {
      updated_count: _updatedCount,
      inactive_count: _inactiveCount,
      reactivated_count: _reactivatedCount,
      matched_product_count: _matchedProductCount,
      ...legacyRunPayload
    } = runPayload;
    runUpdate = await supabase
      .from("bot_runs")
      .update(legacyRunPayload)
      .eq("id", runId);
  }

  if (runUpdate.error) {
    console.error("Source bot run finalization failed:", runUpdate.error);
    finalStatus = "failed";
    errorCount += 1;
  }

  await updateSourceStats(supabase, source, finishedAt, imported, finalStatus);

  return {
    ok: finalStatus === "success",
    sourceId: source.id,
    sourceName: source.name,
    status: finalStatus,
    found: listings.length,
    imported,
    updated,
    inactive,
    reactivated,
    skipped,
    matchedProducts,
    errorCount,
    errorMessage,
    durationMs,
    duplicateSummary,
  };
}

function adapterResultToBotListings(
  listings: Array<{
    external_id: string;
    title: string;
    price: number;
    url: string;
    image_url: string | null;
    source_name: string;
    location: string | null;
    condition: string;
    raw_payload: Record<string, unknown> | null;
  }>,
): BotAdapterListing[] {
  return listings.map((listing) => ({
    external_id: listing.external_id,
    product_name: getRawString(listing.raw_payload, "product_name") || listing.title,
    title: listing.title,
    price: listing.price,
    city: listing.location ?? "Türkiye",
    source: listing.source_name,
    url: listing.url,
    condition: listing.condition,
    image_url: listing.image_url,
    image_urls: listing.image_url ? [listing.image_url] : [],
    brand: getRawString(listing.raw_payload, "brand"),
    model: getRawString(listing.raw_payload, "model"),
    category: getRawString(listing.raw_payload, "category"),
    status: "published",
    raw_payload: listing.raw_payload,
  }));
}

function getRawString(payload: Record<string, unknown> | null, key: string) {
  const value = payload?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

async function updateSourceStats(
  supabase: SupabaseClient,
  source: SourceRunRecord,
  finishedAt: string,
  imported: number,
  finalStatus: "success" | "failed",
) {
  const payload = {
    last_run_at: finishedAt,
    total_imported: Number(source.total_imported ?? 0) + imported,
    ...(finalStatus === "success" ? { last_success: finishedAt } : {}),
  };
  let result = await supabase.from("sources").update(payload).eq("id", source.id);

  if (result.error && isMissingColumn(result.error, ["last_success"])) {
    const { last_success: _lastSuccess, ...legacyPayload } = payload;
    result = await supabase
      .from("sources")
      .update(legacyPayload)
      .eq("id", source.id);
  }

  if (result.error) {
    console.error("Source bot stats update failed:", result.error);
  }
}

function emptyFailedResult(
  source: SourceRunRecord,
  errorMessage: string,
): SourceRunResult {
  return {
    ok: false,
    sourceId: source.id,
    sourceName: source.name,
    status: "failed",
    found: 0,
    imported: 0,
    updated: 0,
    inactive: 0,
    reactivated: 0,
    skipped: 0,
    matchedProducts: 0,
    errorCount: 1,
    errorMessage,
    durationMs: 0,
    duplicateSummary: null,
  };
}

function normalizeLimit(value: unknown, maxLimit?: number) {
  const parsed = Number(value);
  const limit = Number.isFinite(parsed) ? Math.trunc(parsed) : 10;
  return Math.min(Math.max(limit, 1), maxLimit ?? 1000);
}

function normalizeImportMode(value: unknown) {
  return value === "published" || value === "pending" ? value : null;
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

function isMissingColumn(error: unknown, columns: string[]) {
  if (!isRecord(error)) return false;
  const record = error;
  const code = typeof record.code === "string" ? record.code : undefined;
  const message = typeof record.message === "string" ? record.message : "";
  const details = typeof record.details === "string" ? record.details : "";
  const text = `${message} ${details}`.toLowerCase();
  return (
    code === "42703" ||
    code === "PGRST204" ||
    columns.some((column) => text.includes(column))
  );
}
