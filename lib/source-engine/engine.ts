import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isSourceDueForRun } from "@/lib/bots/cron-schedule";
import {
  isSupportedScrapeSource,
  runSourceScrapeBot,
  type SourceRunRecord,
  type SourceRunResult,
} from "@/lib/bots/source-runner";
import type {
  SourceEngineRunOptions,
  SourceEngineSkippedSource,
  SourceEngineSource,
  SourceEngineSummary,
} from "./types";

export async function runSourceEngine(
  supabase: SupabaseClient,
  options: SourceEngineRunOptions,
): Promise<SourceEngineSummary> {
  const started = Date.now();
  const sources = await loadSources(supabase, options);
  const runnable: SourceEngineSource[] = [];
  const skippedSources: SourceEngineSkippedSource[] = [];

  for (const source of sources) {
    const reason = getSkipReason(source, options);
    if (reason) {
      skippedSources.push({
        id: Number(source.id),
        name: source.name,
        slug: source.slug,
        reason,
      });
    } else {
      runnable.push(source);
    }
  }

  const results: SourceRunResult[] = [];
  for (const source of runnable) {
    const result = await runSourceScrapeBot(supabase, source, {
      runType: options.mode === "scheduled" ? "scheduled" : "real_test",
      maxLimit: options.limit,
      forceStatus: options.mode === "debug" || options.mode === "real_test" ? "pending" : undefined,
      skipInactiveMarking: options.mode !== "scheduled" || Boolean(options.limit),
    });
    results.push(result);
  }

  const totals = results.reduce(
    (total, result) => {
      total.found += result.found;
      total.imported += result.imported;
      total.updated += result.updated;
      total.inactive += result.inactive;
      total.reactivated += result.reactivated;
      total.matchedProducts += result.matchedProducts;
      total.errorCount += result.errorCount;
      return total;
    },
    {
      found: 0,
      imported: 0,
      updated: 0,
      inactive: 0,
      reactivated: 0,
      matchedProducts: 0,
      errorCount: 0,
    },
  );

  return {
    ok: results.every((result) => result.ok),
    mode: options.mode,
    force: Boolean(options.force),
    scanned: sources.length,
    ran: results.length,
    skipped: skippedSources.length,
    ...totals,
    durationMs: Date.now() - started,
    skippedSources,
    results,
  };
}

async function loadSources(
  supabase: SupabaseClient,
  options: SourceEngineRunOptions,
): Promise<SourceEngineSource[]> {
  let query = supabase
    .from("sources")
    .select(
      "id, name, slug, is_active, cron_enabled, cron_schedule, last_run_at, integration_type, fetch_limit, product_limit, bot_import_mode, bot_listing_status, scrape_url, total_imported",
    )
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (options.sourceId) query = query.eq("id", options.sourceId);
  if (options.sourceSlug) query = query.eq("slug", options.sourceSlug);
  if (!options.force && options.mode === "scheduled") query = query.eq("cron_enabled", true);

  let result: { data: unknown[] | null; error: unknown } = await query;

  if (result.error && isMissingColumn(result.error, ["integration_type", "fetch_limit", "bot_import_mode"])) {
    let legacyQuery = supabase
      .from("sources")
      .select(
        "id, name, slug, is_active, cron_enabled, cron_schedule, last_run_at, product_limit, bot_listing_status, scrape_url, total_imported",
      )
      .eq("is_active", true)
      .order("name", { ascending: true });
    if (options.sourceId) legacyQuery = legacyQuery.eq("id", options.sourceId);
    if (options.sourceSlug) legacyQuery = legacyQuery.eq("slug", options.sourceSlug);
    if (!options.force && options.mode === "scheduled") legacyQuery = legacyQuery.eq("cron_enabled", true);
    result = await legacyQuery;
  }

  if (result.error) throw result.error;
  return (result.data ?? []) as SourceEngineSource[];
}

function getSkipReason(source: SourceEngineSource, options: SourceEngineRunOptions) {
  if (!source.is_active) return "kaynak pasif";
  if (!options.includeUnsupported && !isSupportedScrapeSource(source.slug)) {
    return "gerçek adapter hazır değil";
  }
  if (source.integration_type && source.integration_type !== "scrape") {
    return "integration_type scrape değil";
  }
  if (options.force || options.mode !== "scheduled") return null;
  if (!source.cron_enabled) return "cron kapalı";
  if (!isSourceDueForRun(source.cron_schedule ?? "0 */6 * * *", source.last_run_at)) {
    return "cron_schedule aralığı dolmadı";
  }
  return null;
}

export function summarizeSourceEngineResults(results: SourceRunResult[]) {
  return results.map((result) => ({
    sourceId: result.sourceId,
    sourceName: result.sourceName,
    status: result.status,
    found: result.found,
    imported: result.imported,
    updated: result.updated,
    inactive: result.inactive,
    reactivated: result.reactivated,
    skipped: result.skipped,
    matchedProducts: result.matchedProducts,
    errorCount: result.errorCount,
    errorMessage: result.errorMessage,
    durationMs: result.durationMs,
  }));
}

function isMissingColumn(error: unknown, columns: string[]) {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: string; message?: string; details?: string };
  const text = `${record.message ?? ""} ${record.details ?? ""}`.toLowerCase();
  return (
    record.code === "42703" ||
    record.code === "PGRST204" ||
    columns.some((column) => text.includes(column))
  );
}
