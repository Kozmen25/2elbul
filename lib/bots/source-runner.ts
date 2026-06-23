import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EASYCEP_PHONE_CATEGORY_URL,
  fetchEasyCepListings,
  fetchGetmobilListings,
  GETMOBIL_PHONE_CATEGORY_URL,
} from "@/lib/bots/adapters";
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
  skipped: number;
  errorCount: number;
  errorMessage: string | null;
};

type RunSourceOptions = {
  runType: "real_test" | "scheduled";
  maxLimit?: number;
  forceStatus?: "pending" | "published";
};

export function isSupportedScrapeSource(slug: string) {
  return ["easycep", "getmobil"].includes(slug);
}

export async function runSourceScrapeBot(
  supabase: SupabaseClient,
  source: SourceRunRecord,
  options: RunSourceOptions,
): Promise<SourceRunResult> {
  if (!isSupportedScrapeSource(source.slug)) {
    return {
      ok: false,
      sourceId: source.id,
      sourceName: source.name,
      status: "failed",
      found: 0,
      imported: 0,
      skipped: 0,
      errorCount: 1,
      errorMessage:
        "Gerçek çekim şu anda yalnızca EasyCep ve Getmobil için hazır.",
    };
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
    return {
      ok: false,
      sourceId: source.id,
      sourceName: source.name,
      status: "failed",
      found: 0,
      imported: 0,
      skipped: 0,
      errorCount: 1,
      errorMessage: message,
    };
  }

  const runId = Number(botRun.id);
  const limit = normalizeLimit(
    source.fetch_limit ?? source.product_limit ?? 10,
    options.maxLimit,
  );
  const listingStatus =
    options.forceStatus ?? normalizeImportMode(source.bot_import_mode) ??
    normalizeImportMode(source.bot_listing_status) ??
    "pending";

  let listings: BotAdapterListing[] = [];
  let imported = 0;
  let skipped = 0;
  let errorCount = 0;
  const errors: string[] = [];
  let finalStatus: "success" | "failed" = "success";

  try {
    listings =
      source.slug === "easycep"
        ? await fetchEasyCepListings(
            source.scrape_url || EASYCEP_PHONE_CATEGORY_URL,
            limit,
          )
        : await fetchGetmobilListings(
            source.scrape_url || GETMOBIL_PHONE_CATEGORY_URL,
            limit,
          );
    listings = listings.slice(0, limit).map((listing) => ({
      ...listing,
      status: listingStatus,
    }));

    if (!listings.length) {
      errors.push("Ürün bulunamadı veya HTML yapısı değişmiş olabilir");
    } else {
      const result = await importListings(supabase, listings);
      imported = result.imported;
      skipped = result.skipped;
      errorCount = result.errorCount;
      errors.push(...result.errors);
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
  const { error: runUpdateError } = await supabase
    .from("bot_runs")
    .update({
      status: finalStatus,
      found_count: listings.length,
      imported_count: imported,
      skipped_count: skipped,
      error_count: errorCount,
      error_message: errorMessage,
      finished_at: finishedAt,
    })
    .eq("id", runId);

  if (runUpdateError) {
    console.error("Source bot run finalization failed:", runUpdateError);
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
    skipped,
    errorCount,
    errorMessage,
  };
}

async function importListings(
  supabase: SupabaseClient,
  listings: BotAdapterListing[],
) {
  let imported = 0;
  let skipped = 0;
  let errorCount = 0;
  const errors: string[] = [];
  const productNames = [
    ...new Set(listings.map((listing) => listing.product_name)),
  ];
  const { data: existingProducts, error: productLookupError } = await supabase
    .from("products")
    .select("id, name")
    .in("name", productNames);

  if (productLookupError) throw productLookupError;

  const productIds = new Map(
    (existingProducts ?? []).map((product) => [
      String(product.name),
      product.id as string | number,
    ]),
  );

  for (const productName of productNames) {
    if (productIds.has(productName)) continue;
    const { data: createdProduct, error: productInsertError } = await supabase
      .from("products")
      .insert({ name: productName })
      .select("id")
      .single();

    if (productInsertError || !createdProduct) {
      const message =
        productInsertError?.message ?? `${productName} oluşturulamadı.`;
      console.error("Source bot product insert failed:", productInsertError);
      errors.push(`${productName}: ${message}`);
      continue;
    }
    productIds.set(productName, createdProduct.id);
  }

  const { data: existingListings, error: duplicateError } = await supabase
    .from("listings")
    .select("url")
    .in(
      "url",
      listings.map((listing) => listing.url),
    );

  if (duplicateError) throw duplicateError;
  const existingUrls = new Set(
    (existingListings ?? []).map((listing) => String(listing.url)),
  );

  for (const listing of listings) {
    if (existingUrls.has(listing.url)) {
      skipped += 1;
      continue;
    }

    const productId = productIds.get(listing.product_name);
    if (!productId) {
      errorCount += 1;
      errors.push(`${listing.title}: ürün kimliği bulunamadı.`);
      continue;
    }

    const { error: listingInsertError } = await supabase
      .from("listings")
      .insert({
        product_id: productId,
        title: listing.title,
        price: listing.price,
        city: listing.city,
        source: listing.source,
        url: listing.url,
        condition: listing.condition,
        image_url: listing.image_url ?? listing.image_urls[0] ?? null,
        status: listing.status,
      });

    if (listingInsertError) {
      console.error("Source bot listing insert failed:", listingInsertError);
      errorCount += 1;
      errors.push(`${listing.title}: ${listingInsertError.message}`);
      continue;
    }

    existingUrls.add(listing.url);
    imported += 1;
  }

  return { imported, skipped, errorCount, errors };
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
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: string; message?: string; details?: string };
  const text = `${record.message ?? ""} ${record.details ?? ""}`.toLowerCase();
  return (
    record.code === "42703" ||
    record.code === "PGRST204" ||
    columns.some((column) => text.includes(column))
  );
}
