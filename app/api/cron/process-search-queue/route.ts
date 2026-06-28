import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getSourceAdapter,
  type NormalizedListing,
} from "@/lib/source-adapters";
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
      const adapter = getSourceAdapter(source.slug);
      const listings = await adapter.search({
        query: job.query,
        normalizedQuery: job.normalized_query,
        sourceId: source.id,
        sourceName: source.name,
        sourceSlug: source.slug,
        limit: 3,
      });
      const importResult = await importAdapterListings(
        supabase,
        job,
        source,
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
      );

      completed += 1;
      imported += importResult.imported;
      updated += importResult.updated;
      skipped += importResult.skipped;
      results.push({
        id: job.id,
        ok: true,
        status: "completed",
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
    const productId = await ensureProduct(supabase, job.query, listing);
    const existing = await findExistingListing(supabase, listing);
    const previousPrice = existing?.price ? Number(existing.price) : null;

    const payload = {
      product_id: productId,
      source_id: source.id || null,
      external_id: listing.externalId,
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

    const { data, error } = await supabase
      .from("listings")
      .upsert(payload, { onConflict: "source,external_id" })
      .select("id, price")
      .single();

    if (error) throw error;

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
  query: string,
  listing: NormalizedListing,
) {
  const productName = normalizeProductName(query);
  const { data, error } = await supabase
    .from("products")
    .upsert(
      {
        name: productName,
        category: listing.category,
      },
      { onConflict: "name" },
    )
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Ürün oluşturulamadı.");
  }

  return Number(data.id);
}

async function findExistingListing(
  supabase: SupabaseClient,
  listing: NormalizedListing,
) {
  const { data, error } = await supabase
    .from("listings")
    .select("id, price")
    .eq("source", listing.sourceName)
    .eq("external_id", listing.externalId)
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
) {
  const message = `Adapter tamamlandı. Bulunan: ${found}, eklenen: ${importResult.imported}, güncellenen: ${importResult.updated}, atlanan: ${importResult.skipped}.`;

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

function normalizeProductName(query: string) {
  return query.trim().replace(/\s+/g, " ") || "Aranan ürün";
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
