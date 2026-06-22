"use server";

import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/admin";
import {
  EASYCEP_PHONE_CATEGORY_URL,
  fetchEasyCepListings,
  fetchGetmobilListings,
  GETMOBIL_PHONE_CATEGORY_URL,
} from "@/lib/bots/adapters";
import type { BotAdapterListing } from "@/lib/bots/types";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createDemoListings } from "./demo-data";

export type SourceInput = {
  id?: number;
  name: string;
  slug: string;
  baseUrl: string;
  type: string;
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
    bot_listing_status: input.botListingStatus,
    api_url: normalizeOptionalUrl(input.apiUrl),
    scrape_url: normalizeOptionalUrl(input.scrapeUrl),
    cron_enabled: input.cronEnabled,
    cron_schedule: input.cronSchedule.trim(),
    product_limit: input.productLimit,
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
    bot_listing_status: input.botListingStatus,
    api_url: normalizeOptionalUrl(input.apiUrl),
    scrape_url: normalizeOptionalUrl(input.scrapeUrl),
    cron_enabled: input.cronEnabled,
    cron_schedule: input.cronSchedule.trim(),
    product_limit: input.productLimit,
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
    .select("id, name, slug, total_imported, bot_listing_status")
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
    source.bot_listing_status === "published" ? "published" : "pending",
  );
  let imported = 0;
  let skipped = 0;
  let errorCount = 0;
  const errors: string[] = [];

  try {
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
        console.error("Demo bot product insert failed:", productInsertError);
        errors.push(`${productName}: ${message}`);
        continue;
      }
      productIds.set(productName, createdProduct.id);
    }

    const urls = listings.map((listing) => listing.url);
    const { data: existingListings, error: duplicateError } = await supabase
      .from("listings")
      .select("url")
      .in("url", urls);

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
        console.error("Demo bot listing insert failed:", listingInsertError);
        errorCount += 1;
        errors.push(`${listing.title}: ${listingInsertError.message}`);
        continue;
      }
      imported += 1;
    }
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
        ? `Test çekimi tamamlandı: ${imported} eklendi, ${skipped} atlandı.`
        : `Test çekimi hatayla tamamlandı: ${imported} eklendi, ${skipped} atlandı, ${errorCount} hata.`,
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
    .select("id, name, slug, total_imported, scrape_url, product_limit")
    .eq("id", sourceId)
    .maybeSingle();

  if (
    sourceResult.error &&
    isMissingIntegrationSettingsColumn(sourceResult.error)
  ) {
    sourceResult = await supabase
      .from("sources")
      .select("id, name, slug, total_imported")
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

  if (!["easycep", "getmobil"].includes(source.slug)) {
    return {
      ok: false,
      message: "Gerçek test çekimi şu anda yalnızca EasyCep ve Getmobil için hazır.",
    };
  }

  const startedAt = new Date().toISOString();
  const { data: botRun, error: runInsertError } = await supabase
    .from("bot_runs")
    .insert({
      source_id: sourceId,
      status: "running",
      run_type: "real_test",
      started_at: startedAt,
    })
    .select("id")
    .single();

  if (runInsertError || !botRun) {
    if (runInsertError) {
      console.error("Real bot run insert failed:", runInsertError);
    }
    return {
      ok: false,
      message: runInsertError
        ? `Bot çalışması başlatılamadı: ${runInsertError.message}`
        : "Bot çalışma kaydı oluşturulamadı.",
    };
  }

  const runId = Number(botRun.id);
  let listings: BotAdapterListing[] = [];
  let imported = 0;
  let skipped = 0;
  let errorCount = 0;
  const errors: string[] = [];
  let finalStatus = "success";

  try {
    const limit = Math.min(
      Math.max(Number(source.product_limit ?? 10), 1),
      10,
    );
    if (source.slug === "easycep") {
      listings = await fetchEasyCepListings(
        source.scrape_url || EASYCEP_PHONE_CATEGORY_URL,
        limit,
      );
    } else {
      listings = await fetchGetmobilListings(
        source.scrape_url || GETMOBIL_PHONE_CATEGORY_URL,
        limit,
      );
    }

    if (!listings.length) {
      errors.push("Ürün bulunamadı veya HTML yapısı değişmiş olabilir");
    } else {
      const result = await importRealListings(supabase, listings);
      imported = result.imported;
      skipped = result.skipped;
      errorCount = result.errorCount;
      errors.push(...result.errors);
      if (errorCount > 0) finalStatus = "failed";
    }
  } catch (error) {
    console.error("Real bot execution failed:", error);
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
    console.error("Real bot run finalization failed:", runUpdateError);
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
      "Real bot source stats update failed:",
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

  if (!listings.length && finalStatus === "success") {
    return {
      ok: true,
      message: "Çekim tamamlandı ancak ürün bulunamadı. HTML yapısı değişmiş olabilir.",
    };
  }

  return {
    ok: finalStatus === "success",
    message:
      finalStatus === "success"
        ? `Gerçek test çekimi tamamlandı: ${imported} eklendi, ${skipped} atlandı.`
        : `Gerçek test çekimi hatayla tamamlandı: ${imported} eklendi, ${skipped} atlandı, ${errorCount} hata.`,
  };
}

async function importRealListings(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
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
      console.error("Real bot product insert failed:", productInsertError);
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
        status: "pending",
      });

    if (listingInsertError) {
      console.error("Real bot listing insert failed:", listingInsertError);
      errorCount += 1;
      errors.push(`${listing.title}: ${listingInsertError.message}`);
      continue;
    }

    existingUrls.add(listing.url);
    imported += 1;
  }

  return { imported, skipped, errorCount, errors };
}

function validateSource(input: SourceInput): SourceActionResult {
  const name = input.name.trim();
  const slug = normalizeSlug(input.slug);
  const type = input.type.trim();
  const botListingStatus = input.botListingStatus;
  const productLimit = Number(input.productLimit);

  if (
    !name ||
    !slug ||
    !type ||
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
    ...legacyPayload
  } = payload;
  return legacyPayload;
}

function revalidateSources() {
  revalidatePath("/admin/sources");
  revalidatePath("/admin/bot-runs");
}
