import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getInstantSearchAdapters,
  type NormalizedListing,
  type SourceAdapter,
} from "@/lib/source-adapters";
import { findOrCreateMatchedProduct } from "@/lib/product-matcher";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type QueueJob = {
  id: string;
  demand_id: string;
  query: string;
  normalized_query: string;
  source_id: number | null;
  attempts: number;
  max_attempts: number;
};

type SourceRow = {
  id: number;
  name: string;
  slug: string;
};

type ImportedListingResult = {
  imported: number;
  updated: number;
  skipped: number;
};

type SearchAdapterResult = {
  adapterSlug: string;
  sourceName: string;
  listings: NormalizedListing[];
  triedAdapters: Array<{ slug: string; found: number }>;
};

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET tanımlı değil." },
      { status: 500 },
    );
  }
  if (!hasValidSecret(request, secret)) {
    return NextResponse.json(
      { ok: false, error: "Yetkisiz cron isteği." },
      { status: 401 },
    );
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Supabase service-role bağlantısı yok." },
      { status: 500 },
    );
  }

  const { data, error } = await supabase
    .from("bot_queue")
    .select("id, demand_id, query, normalized_query, source_id, attempts, max_attempts")
    .eq("status", "pending")
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(20);

  if (error) {
    console.error("Search queue query failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message,
        migration: "supabase/search-demand-queue.sql",
      },
      { status: 500 },
    );
  }

  const jobs = (data ?? []) as QueueJob[];
  const sourceMap = await loadSources(supabase, jobs);
  let completed = 0;
  let failed = 0;
  let skipped = 0;
  let imported = 0;
  let updated = 0;
  const results = [];

  for (const job of jobs) {
    const startedAt = new Date().toISOString();
    const nextAttempts = Number(job.attempts ?? 0) + 1;

    const startUpdate = await supabase
      .from("bot_queue")
      .update({
        status: "processing",
        attempts: nextAttempts,
        started_at: startedAt,
        finished_at: null,
        error_message: null,
      })
      .eq("id", job.id)
      .eq("status", "pending");

    if (startUpdate.error) {
      console.error("Search queue job start failed:", startUpdate.error);
      failed += 1;
      results.push({ id: job.id, ok: false, error: startUpdate.error.message });
      continue;
    }

    try {
      const source = getJobSource(job, sourceMap);
      const searchResult = await runInstantSearchAdapters(source, job);
      const listings = searchResult.listings;
      if (!listings.length) {
        const finishedAt = new Date().toISOString();
        const message = createNoResultsMessage(searchResult.triedAdapters);

        await updateQueueNoResults(
          supabase,
          job,
          finishedAt,
          nextAttempts,
          message,
        );

        skipped += 1;
        results.push({
          id: job.id,
          ok: true,
          status: "no_results",
          found: 0,
          imported: 0,
          updated: 0,
          skipped: 1,
          triedAdapters: searchResult.triedAdapters,
          message,
        });
        continue;
      }

      const importSource = {
        id: source.id,
        name: searchResult.sourceName || source.name,
        slug: searchResult.adapterSlug || source.slug,
      };
      const importResult = await importAdapterListings(
        supabase,
        job,
        importSource,
        listings,
      );
      const finishedAt = new Date().toISOString();

      await updateQueueSuccess(
        supabase,
        job,
        finishedAt,
        nextAttempts,
        listings.length,
        importResult,
        searchResult,
      );

      completed += 1;
      imported += importResult.imported;
      updated += importResult.updated;
      skipped += importResult.skipped;
      results.push({
        id: job.id,
        ok: true,
        status: "completed",
        adapter: searchResult.adapterSlug,
        sourceName: searchResult.sourceName,
        found: listings.length,
        ...importResult,
      });
    } catch (jobError) {
      const finishedAt = new Date().toISOString();
      const message = getErrorMessage(jobError);
      const shouldRetry = nextAttempts < Number(job.max_attempts ?? 3);
      const status = shouldRetry ? "pending" : "failed";

      await supabase
        .from("bot_queue")
        .update({
          status,
          finished_at: shouldRetry ? null : finishedAt,
          error_message: message,
        })
        .eq("id", job.id);

      await supabase
        .from("search_demands")
        .update({
          status: shouldRetry ? "queued" : "failed",
          last_processed_at: finishedAt,
          process_count: nextAttempts,
          error_message: message,
        })
        .eq("id", job.demand_id);

      failed += 1;
      results.push({ id: job.id, ok: false, error: message, retry: shouldRetry });
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: jobs.length,
    completed,
    skipped,
    failed,
    imported,
    updated,
    results,
  });
}

async function loadSources(supabase: SupabaseClient, jobs: QueueJob[]) {
  const ids = [
    ...new Set(
      jobs
        .map((job) => job.source_id)
        .filter((id): id is number => typeof id === "number"),
    ),
  ];
  if (!ids.length) return new Map<number, SourceRow>();

  const { data, error } = await supabase
    .from("sources")
    .select("id, name, slug")
    .in("id", ids);

  if (error) {
    console.error("Search queue sources query failed:", error);
    return new Map<number, SourceRow>();
  }

  return new Map(
    ((data ?? []) as SourceRow[]).map((source) => [Number(source.id), source]),
  );
}

function getJobSource(job: QueueJob, sourceMap: Map<number, SourceRow>): SourceRow {
  if (job.source_id && sourceMap.has(job.source_id)) {
    return sourceMap.get(job.source_id)!;
  }

  return {
    id: job.source_id ?? 0,
    name: "2ElBul Demo",
    slug: "mock",
  };
}

async function runInstantSearchAdapters(
  source: SourceRow,
  job: QueueJob,
): Promise<SearchAdapterResult> {
  const adapters = getInstantSearchAdapters();
  const triedAdapters: Array<{ slug: string; found: number }> = [];

  for (const adapter of adapters) {
    const listings = await searchAdapter(adapter, source, job);
    triedAdapters.push({ slug: adapter.slug, found: listings.length });
    if (listings.length > 0) {
      return {
        adapterSlug: adapter.slug,
        sourceName: listings[0]?.sourceName ?? source.name,
        listings,
        triedAdapters,
      };
    }
  }

  return {
    adapterSlug: adapters[0]?.slug ?? "none",
    sourceName: source.name,
    listings: [],
    triedAdapters,
  };
}

async function searchAdapter(
  adapter: SourceAdapter,
  source: SourceRow,
  job: QueueJob,
) {
  try {
    return await adapter.search({
      query: job.query,
      normalizedQuery: job.normalized_query,
      sourceId: source.id,
      sourceName: source.name,
      sourceSlug: source.slug,
      limit: 3,
    });
  } catch (error) {
    console.error(`Instant search adapter failed: ${adapter.slug}`, error);
    return [];
  }
}

async function importAdapterListings(
  supabase: SupabaseClient,
  job: QueueJob,
  source: SourceRow,
  listings: NormalizedListing[],
): Promise<ImportedListingResult> {
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  for (const listing of listings) {
    const productId = await ensureProduct(supabase, listing, job.query);
    const externalId = ensureExternalId(job, source, listing);
    const existing = await findExistingListing(supabase, listing, externalId);
    const previousPrice = existing?.price ? Number(existing.price) : null;

    const payload: Record<string, unknown> = {
      product_id: productId,
      source_id: source.id || null,
      external_id: externalId,
      title: listing.title,
      price: listing.price,
      city: listing.city ?? "Türkiye",
      source: listing.sourceName,
      url: listing.url,
      condition: "İkinci El",
      image_url: listing.imageUrl,
      status: "published",
      imported_at: new Date().toISOString(),
      raw_payload: listing.rawData,
      last_seen_at: new Date().toISOString(),
    };

    const data = await saveListingWithSchemaFallback(
      supabase,
      payload,
      existing?.id ?? null,
    );

    if (existing) updated += 1;
    else imported += 1;

    if (
      data?.id &&
      previousPrice !== null &&
      previousPrice !== Number(listing.price)
    ) {
      await insertPriceHistorySafely(supabase, {
        productId,
        listingId: Number(data.id),
        source: listing.sourceName,
        price: Number(listing.price),
      });
    }
  }

  if (!listings.length) skipped += 1;
  return { imported, updated, skipped };
}

async function ensureProduct(
  supabase: SupabaseClient,
  listing: NormalizedListing,
  query: string,
) {
  const product = await findOrCreateMatchedProduct({
    supabase,
    title: listing.title || query,
    productName: listing.model || query,
    category: listing.category,
  });
  return Number(product.id);
}

async function ensureProductLegacy(
  supabase: SupabaseClient,
  query: string,
) {
  const productName = normalizeProductName(query);

  const existing = await supabase
    .from("products")
    .select("id")
    .eq("name", productName)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data?.id) return Number(existing.data.id);

  const { data, error } = await supabase
    .from("products")
    .insert({ name: productName })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Ürün oluşturulamadı.");
  }

  return Number(data.id);
}

async function saveListingWithSchemaFallback(
  supabase: SupabaseClient,
  payload: Record<string, unknown>,
  existingId: string | number | null,
) {
  let currentPayload = { ...payload };

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const result = existingId
      ? await supabase
          .from("listings")
          .update(currentPayload)
          .eq("id", existingId)
          .select("id, price")
          .single()
      : await supabase
          .from("listings")
          .insert(currentPayload)
          .select("id, price")
          .single();

    if (!result.error) return result.data;

    const missingColumn = getMissingSchemaColumn(result.error);
    if (!missingColumn || !(missingColumn in currentPayload)) {
      throw result.error;
    }

    console.error(
      `Search queue listing save skipped missing column: ${missingColumn}`,
      result.error,
    );
    const { [missingColumn]: _removed, ...nextPayload } = currentPayload;
    currentPayload = nextPayload;
  }

  throw new Error("Listing kaydı mevcut şemayla uyumlu hale getirilemedi.");
}

async function findExistingListing(
  supabase: SupabaseClient,
  listing: NormalizedListing,
  externalId: string,
) {
  const { data, error } = await supabase
    .from("listings")
    .select("id, price")
    .eq("source", listing.sourceName)
    .eq("external_id", externalId)
    .maybeSingle();

  if (error) throw error;
  return data as { id: number | string; price: number | string } | null;
}

async function insertPriceHistorySafely(
  supabase: SupabaseClient,
  input: {
    productId: number;
    listingId: number;
    source: string;
    price: number;
  },
) {
  const { error } = await supabase.from("price_history").insert({
    product_id: input.productId,
    listing_id: input.listingId,
    source: input.source,
    price: input.price,
  });

  if (error) {
    console.error("Search queue price history insert failed:", error);
  }
}

async function updateQueueSuccess(
  supabase: SupabaseClient,
  job: QueueJob,
  finishedAt: string,
  attempts: number,
  found: number,
  importResult: ImportedListingResult,
  searchResult: SearchAdapterResult,
) {
  const message = `Adapter tamamlandı. Kaynak: ${searchResult.sourceName} (${searchResult.adapterSlug}). Bulunan: ${found}, eklenen: ${importResult.imported}, güncellenen: ${importResult.updated}, atlanan: ${importResult.skipped}.`;

  const finishUpdate = await supabase
    .from("bot_queue")
    .update({
      status: "completed",
      finished_at: finishedAt,
      error_message: message,
    })
    .eq("id", job.id);

  if (finishUpdate.error) throw finishUpdate.error;

  const demandUpdate = await supabase
    .from("search_demands")
    .update({
      status: "completed",
      last_processed_at: finishedAt,
      process_count: attempts,
      error_message: null,
    })
    .eq("id", job.demand_id);

  if (demandUpdate.error) throw demandUpdate.error;
}

async function updateQueueNoResults(
  supabase: SupabaseClient,
  job: QueueJob,
  finishedAt: string,
  attempts: number,
  message: string,
) {
  const finishUpdate = await supabase
    .from("bot_queue")
    .update({
      status: "no_results",
      finished_at: finishedAt,
      error_message: message,
    })
    .eq("id", job.id);

  if (finishUpdate.error) throw finishUpdate.error;

  const demandUpdate = await supabase
    .from("search_demands")
    .update({
      status: "no_results",
      last_processed_at: finishedAt,
      process_count: attempts,
      error_message: message,
    })
    .eq("id", job.demand_id);

  if (demandUpdate.error) throw demandUpdate.error;
}

function formatTriedAdapters(adapters: Array<{ slug: string; found: number }>) {
  if (!adapters.length) return "adapter yok";
  return adapters
    .map((adapter) => `${adapter.slug}: ${adapter.found}`)
    .join(", ");
}

function createNoResultsMessage(
  adapters: Array<{ slug: string; found: number }>,
) {
  return `Gerçek kaynaklarda sonuç bulunamadı. Denenen kaynaklar: ${formatTriedAdapters(adapters)}.`;
}

function normalizeProductName(query: string) {
  return query.trim().replace(/\s+/g, " ") || "Aranan ürün";
}

function ensureExternalId(
  job: QueueJob,
  source: SourceRow,
  listing: NormalizedListing,
) {
  const existing = listing.externalId?.trim();
  if (existing) return existing;

  return [
    "search",
    source.slug || "mock",
    job.normalized_query || normalizeProductName(job.query),
    listing.url || listing.title,
  ]
    .join("-")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

function hasValidSecret(request: NextRequest, secret: string) {
  const headerSecret =
    request.headers.get("x-cron-secret") ||
    request.headers.get("x-vercel-cron-secret");
  const authHeader = request.headers.get("authorization");
  const bearerSecret = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";
  const querySecret = request.nextUrl.searchParams.get("secret");

  return [headerSecret, bearerSecret, querySecret].some(
    (value) => value === secret,
  );
}

function getMissingSchemaColumn(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const record = error as { code?: string; message?: string; details?: string };
  const text = `${record.message ?? ""} ${record.details ?? ""}`;
  if (record.code !== "PGRST204" && !text.includes("schema cache")) {
    return null;
  }

  const match =
    text.match(/'([^']+)' column/) ??
    text.match(/column '([^']+)'/) ??
    text.match(/Could not find the '([^']+)'/);

  return match?.[1] ?? null;
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
  return "Bilinmeyen kuyruk hatası";
}
