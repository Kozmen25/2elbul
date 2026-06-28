import { NextRequest, NextResponse } from "next/server";
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
  let completed = 0;
  let failed = 0;
  let skipped = 0;
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
      // TODO: Bu noktada mevcut kaynak adapter'larına query bazlı arama desteği
      // eklendiğinde gerçek çekim başlatılacak. Şimdilik altyapı testi için
      // iş güvenli biçimde tamamlanmış kabul edilir.
      const finishedAt = new Date().toISOString();
      const finalStatus = job.source_id ? "completed" : "skipped";
      const finalMessage = job.source_id
        ? "Arama kuyruğu işlendi. Gerçek kaynak araması için adapter bağlantısı hazır."
        : "Kaynak bulunmadığı için iş atlandı.";

      const finishUpdate = await supabase
        .from("bot_queue")
        .update({
          status: finalStatus,
          finished_at: finishedAt,
          error_message: finalMessage,
        })
        .eq("id", job.id);

      if (finishUpdate.error) throw finishUpdate.error;

      await supabase
        .from("search_demands")
        .update({
          status: finalStatus === "completed" ? "completed" : "ignored",
          last_processed_at: finishedAt,
          process_count: nextAttempts,
          error_message: finalStatus === "completed" ? null : finalMessage,
        })
        .eq("id", job.demand_id);

      if (finalStatus === "completed") completed += 1;
      else skipped += 1;
      results.push({ id: job.id, ok: true, status: finalStatus });
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
    results,
  });
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
