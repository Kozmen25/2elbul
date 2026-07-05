import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getInstantSearchAdapters } from "@/lib/source-adapters";
import {
  findOrCreateMatchedProduct,
  groupListingDuplicates,
  summarizeDuplicateGroups,
  type DuplicateBatchSummary,
} from "@/lib/product-matcher";
import { normalizeSearchDemandQuery } from "@/lib/search-demand";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { normalizeSearchText } from "@/lib/unified-source-engine/helpers";
import { getNestedRecordString } from "@/lib/records";
import type {
  NormalizedListing,
  UnifiedSourceAdapter,
} from "@/lib/unified-source-engine";
import { getGlobalContext } from "@/lib/taxonomy/context";
import type { createCategoryResolver } from "@/lib/taxonomy/integration";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RATE_LIMIT_MS = 60_000;
const recentRuns = new Map<string, number>();

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

type SearchQueueListing = NormalizedListing & {
  model?: string | null;
  category?: string | null;
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    query?: unknown;
  } | null;
  const query = typeof body?.query === "string" ? body.query.trim() : "";
  const normalizedQuery = normalizeSearchDemandQuery(query);

  if (!normalizedQuery) {
    return NextResponse.json(
      { ok: false, error: "Geçerli bir arama sorgusu gönderin." },
      { status: 400 },
    );
  }

  const lastRun = recentRuns.get(normalizedQuery) ?? 0;
  if (Date.now() - lastRun < RATE_LIMIT_MS) {
    return NextResponse.json({
      ok: true,
      rateLimited: true,
      message: "Bu arama için tarama kısa süre önce başlatıldı.",
    });
  }
  recentRuns.set(normalizedQuery, Date.now());

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Supabase service-role bağlantısı yok." },
      { status: 500 },
    );
  }

  const resolver = getGlobalContext().getResolver();

  const { data, error } = await supabase
    .from("bot_queue")
    .select("id, demand_id, query, normalized_query, source_id, attempts, max_attempts")
    .eq("normalized_query", normalizedQuery)
    .eq("status", "pending")
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(5);

  if (error) {
    console.error("Instant bot queue query failed:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  const jobs = (data ?? []) as QueueJob[];
  if (!jobs.length) {
    const noResultsDemand = await supabase
      .from("search_demands")
      .select("error_message")
      .eq("normalized_query", normalizedQuery)
      .eq("status", "no_results")
      .order("last_processed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const noResultsMessage = noResultsDemand.data?.error_message
      ? String(noResultsDemand.data.error_message)
      : "";

    return NextResponse.json({
      ok: true,
      processed: 0,
      imported: 0,
      updated: 0,
      noResults: noResultsMessage ? 1 : 0,
      noResultsMessage: noResultsMessage || null,
      message: "Bu arama için bekleyen kuyruk kaydı bulunamadı.",
    });
  }

  const sourceMap = await loadSources(supabase, jobs);
  const results = [];
  let imported = 0;
  let updated = 0;
  let failed = 0;
  let noResults = 0;
  let matchedProducts = 0;

  for (const job of jobs) {
    const nextAttempts = Number(job.attempts ?? 0) + 1;
    const startedAt = new Date().toISOString();
    await supabase
      .from("bot_queue")
      .update({
        status: "processing",
        attempts: nextAttempts,
        started_at: startedAt,
        error_message: null,
      })
      .eq("id", job.id)
      .eq("status", "pending");

    try {
      const source = getJobSource(job, sourceMap);
      const searchResult = await runInstantSearchAdapters(source, job);
      if (!searchResult.listings.length) {
        const finishedAt = new Date().toISOString();
        const message = createNoResultsMessage(searchResult.triedAdapters);
        await supabase
          .from("bot_queue")
          .update({
            status: "no_results",
            finished_at: finishedAt,
            error_message: message,
          })
          .eq("id", job.id);
        await supabase
          .from("search_demands")
          .update({
            status: "no_results",
            last_processed_at: finishedAt,
            process_count: nextAttempts,
            error_message: message,
          })
          .eq("id", job.demand_id);

        noResults += 1;
        results.push({
          id: job.id,
          ok: true,
          status: "no_results",
          found: 0,
          imported: 0,
          updated: 0,
          duplicateSummary: null,
          triedAdapters: searchResult.triedAdapters,
          message,
        });
        continue;
      }
      const importResult = await importListings(supabase, job, searchResult.listings, resolver);
      const finishedAt = new Date().toISOString();
      const message = `Instant bot tamamlandı. Kaynak: ${searchResult.sourceName} (${searchResult.adapterSlug}). Bulunan: ${searchResult.listings.length}, eklenen: ${importResult.imported}, güncellenen: ${importResult.updated}.`;

      await supabase
        .from("bot_queue")
        .update({
          status: "completed",
          finished_at: finishedAt,
          error_message: message,
        })
        .eq("id", job.id);
      await supabase
        .from("search_demands")
        .update({
          status: "completed",
          last_processed_at: finishedAt,
          process_count: nextAttempts,
          error_message: null,
        })
        .eq("id", job.demand_id);

      imported += importResult.imported;
      updated += importResult.updated;
      matchedProducts += importResult.matchedProducts;
      results.push({
        id: job.id,
        ok: true,
        found: searchResult.listings.length,
        ...importResult,
        adapter: searchResult.adapterSlug,
        sourceName: searchResult.sourceName,
      });
    } catch (jobError) {
      failed += 1;
      const finishedAt = new Date().toISOString();
      const message = getErrorMessage(jobError);
      const shouldRetry = nextAttempts < Number(job.max_attempts ?? 3);
      await supabase
        .from("bot_queue")
        .update({
          status: shouldRetry ? "pending" : "failed",
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
      results.push({
        id: job.id,
        ok: false,
        error: message,
        retry: shouldRetry,
        duplicateSummary: null,
      });
    }
  }

  return NextResponse.json({
    ok: failed === 0,
    processed: jobs.length,
    imported,
    updated,
    failed,
    noResults,
    matchedProducts,
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
    console.error("Instant bot sources query failed:", error);
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
  return { id: job.source_id ?? 0, name: "Instant Search", slug: "instant" };
}

async function runInstantSearchAdapters(source: SourceRow, job: QueueJob) {
  const adapters = getInstantSearchAdapters();
  const triedAdapters: Array<{ slug: string; found: number }> = [];
  for (const adapter of adapters) {
    const listings = await searchAdapter(adapter, source, job);
    triedAdapters.push({ slug: adapter.sourceSlug, found: listings.length });
    if (listings.length > 0) {
      return {
        adapterSlug: adapter.sourceSlug,
        sourceName: listings[0]?.sourceName ?? source.name,
        listings,
        triedAdapters,
      };
    }
  }
  return {
    adapterSlug: adapters[0]?.sourceSlug ?? "none",
    sourceName: source.name,
    listings: [] as SearchQueueListing[],
    triedAdapters,
  };
}

async function searchAdapter(
  adapter: UnifiedSourceAdapter,
  source: SourceRow,
  job: QueueJob,
) {
  try {
    const normalizedQuery = normalizeSearchText(job.query);
    if (!normalizedQuery) return [];

    const rawListings = await adapter.fetch({ limit: 10, query: job.query });
    const listings: SearchQueueListing[] = [];

    for (const raw of rawListings) {
      const normalized = adapter.normalize(raw);
      if (!normalized) continue;

      const haystackText = normalizeSearchText(
        `${normalized.title} ${getNestedRecordString(normalized.rawData, "original", "product_name") ?? ""}`,
      );
      if (!haystackText.includes(normalizedQuery)) continue;

      const validated = adapter.validate(normalized);
      if (validated.ok && validated.value) {
        listings.push(validated.value);
      }

      if (listings.length >= 3) break;
    }

    return listings;
  } catch (error) {
    console.error(`Instant bot adapter failed: ${adapter.sourceSlug}`, error);
    return [];
  }
}

async function importListings(
  supabase: SupabaseClient,
  job: QueueJob,
  listings: SearchQueueListing[],
  resolver: ReturnType<typeof createCategoryResolver>,
) {
  let imported = 0;
  let updated = 0;
  const matchedProductIds = new Set<string>();
  let duplicateSummary: DuplicateBatchSummary | null = null;

  if (listings.length > 1) {
    const duplicateGroups = groupListingDuplicates(
      listings.map((l, idx) => ({
        id: l.externalId || `search-${idx}`,
        title: l.title,
        price: l.price,
        source: l.sourceName,
        condition: "Yenilenmiş",
      })),
      70,
    );

    if (duplicateGroups.matchedCount > 0) {
      console.log(`[Search Pipeline Duplicate Detection] Query: "${job.query}": Found ${duplicateGroups.count} groups, ${duplicateGroups.matchedCount} with duplicates`);
    }
    duplicateSummary = summarizeDuplicateGroups(
      duplicateGroups,
      listings.length,
      70,
    );
  }

  for (const listing of listings) {
    const productId = await ensureProduct(supabase, listing, job.query, resolver);
    matchedProductIds.add(String(productId));
    const externalId = listing.externalId || deterministicExternalId(job, listing);
    const existing = await findExistingListing(supabase, listing.sourceName, externalId);
      const payload: Record<string, unknown> = {
        product_id: productId,
        external_id: externalId,
        title: listing.title,
        price: listing.price,
        city: listing.location ?? "Türkiye",
        source: listing.sourceName,
        url: listing.url,
        condition: "Yenilenmiş",
      image_url: listing.imageUrl || "/products/placeholder.svg",
      status: "published",
    };
    await saveListingWithSchemaFallback(supabase, payload, existing?.id ?? null);
    if (existing) updated += 1;
    else imported += 1;
  }

  return {
    imported,
    updated,
    matchedProducts: matchedProductIds.size,
    duplicateSummary,
  };
}

async function ensureProduct(
  supabase: SupabaseClient,
  listing: SearchQueueListing,
  query: string,
  resolver: ReturnType<typeof createCategoryResolver>,
) {
  const product = await findOrCreateMatchedProduct({
    supabase,
    title: listing.title || query,
    productName:
      listing.model ??
      getNestedRecordString(listing.rawData, "original", "product_name") ??
      query,
    category: listing.category,
    source: listing.sourceName,
    resolver,
  });
  return Number(product.id);
}

async function ensureProductLegacy(supabase: SupabaseClient, query: string) {
  const productName = query.trim().replace(/\s+/g, " ") || "Aranan ürün";
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
  if (error || !data) throw new Error(error?.message ?? "Ürün oluşturulamadı.");
  return Number(data.id);
}

async function findExistingListing(
  supabase: SupabaseClient,
  source: string,
  externalId: string,
) {
  const { data, error } = await supabase
    .from("listings")
    .select("id, price")
    .eq("source", source)
    .eq("external_id", externalId)
    .maybeSingle();
  if (error) throw error;
  return data as { id: string | number; price: number | string } | null;
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
          .select("id")
          .single()
      : await supabase.from("listings").insert(currentPayload).select("id").single();
    if (!result.error) return result.data;
    const missingColumn = getMissingSchemaColumn(result.error);
    if (!missingColumn || !(missingColumn in currentPayload)) throw result.error;
    const { [missingColumn]: _removed, ...nextPayload } = currentPayload;
    currentPayload = nextPayload;
  }
  throw new Error("Listing kaydı mevcut şemayla uyumlu hale getirilemedi.");
}

function deterministicExternalId(job: QueueJob, listing: SearchQueueListing) {
  return [
    "instant",
    job.normalized_query,
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

function getMissingSchemaColumn(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const record = error as { code?: string; message?: string; details?: string };
  const text = `${record.message ?? ""} ${record.details ?? ""}`;
  if (record.code !== "PGRST204" && !text.includes("schema cache")) return null;
  return (
    text.match(/'([^']+)' column/) ??
    text.match(/column '([^']+)'/) ??
    text.match(/Could not find the '([^']+)'/)
  )?.[1] ?? null;
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
  return "Bilinmeyen instant bot hatası";
}
