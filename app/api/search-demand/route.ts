import { NextResponse } from "next/server";
import { normalizeSearchDemandQuery } from "@/lib/search-demand";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RATE_LIMIT_ANON = { limit: 10, windowMs: 60 * 60 * 1000 };
const RATE_LIMIT_AUTH = { limit: 100, windowMs: 60 * 60 * 1000 };

type SearchDemandBody = {
  query?: unknown;
  resultCount?: unknown;
  category?: unknown;
};

export async function POST(request: Request) {
  let body: SearchDemandBody;
  try {
    body = (await request.json()) as SearchDemandBody;
  } catch {
    return NextResponse.json(
      { queued: false, error: "Geçerli bir JSON gövdesi gönderin." },
      { status: 400 },
    );
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  const resultCount = Number(body.resultCount ?? 0);
  const category = typeof body.category === "string" ? body.category.trim() : null;

  const ip = getClientIp(request);
  const serverSupabase = await createSupabaseServerClient();
  const { data: authData } = (await serverSupabase?.auth.getUser()) ?? {
    data: { user: null },
  };
  const userId = authData.user?.id ?? null;
  const isAuthenticated = !!userId;
  const rl = isAuthenticated ? RATE_LIMIT_AUTH : RATE_LIMIT_ANON;
  const rlKey = isAuthenticated ? `search-demand:${userId}` : `search-demand:${ip}`;
  const rateCheck = checkRateLimit(rlKey, rl.limit, rl.windowMs);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { queued: false, error: "Çok fazla istek gönderdiniz. Lütfen bekleyin." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rateCheck.resetMs / 1000)) } },
    );
  }

  if (!query) {
    return NextResponse.json(
      { queued: false, error: "Arama sorgusu boş olamaz." },
      { status: 400 },
    );
  }
  if (!Number.isFinite(resultCount) || resultCount < 0) {
    return NextResponse.json(
      { queued: false, error: "Sonuç sayısı geçerli olmalıdır." },
      { status: 400 },
    );
  }
  if (resultCount >= 3) {
    return NextResponse.json({
      queued: false,
      reason: "enough_results",
    });
  }

  const normalizedQuery = normalizeSearchDemandQuery(query);
  if (!normalizedQuery) {
    return NextResponse.json(
      { queued: false, error: "Arama sorgusu geçerli değil." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { queued: false, error: "Supabase service-role bağlantısı yok." },
      { status: 500 },
    );
  }

  const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

  const existingResult = await supabase
    .from("search_demands")
    .select("id")
    .eq("normalized_query", normalizedQuery)
    .in("status", ["pending", "queued", "processing"])
    .gte("requested_at", cutoff)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingResult.error && !isMissingSearchQueueTable(existingResult.error)) {
    console.error("Search demand lookup failed:", existingResult.error);
    return NextResponse.json(
      { queued: false, error: existingResult.error.message },
      { status: 500 },
    );
  }
  if (existingResult.error && isMissingSearchQueueTable(existingResult.error)) {
    return NextResponse.json(
      {
        queued: false,
        error: "Arama kuyruğu tablosu kurulu değil.",
        migration: "supabase/search-demand-queue.sql",
      },
      { status: 500 },
    );
  }

  let demandId = existingResult.data?.id ? String(existingResult.data.id) : "";
  if (demandId) {
    const { error } = await supabase
      .from("search_demands")
      .update({
        query,
        result_count: Math.trunc(resultCount),
        requested_at: new Date().toISOString(),
        status: "queued",
        error_message: null,
        ...(userId ? { user_id: userId } : {}),
        ...(category ? { category } : {}),
      })
      .eq("id", demandId);
    if (error) {
      console.error("Search demand update failed:", error);
      return NextResponse.json(
        { queued: false, error: error.message },
        { status: 500 },
      );
    }
  } else {
    const { data, error } = await supabase
      .from("search_demands")
      .insert({
        query,
        normalized_query: normalizedQuery,
        result_count: Math.trunc(resultCount),
        user_id: userId,
        status: "queued",
        ...(category ? { category } : {}),
      })
      .select("id")
      .single();
    if (error || !data) {
      console.error("Search demand insert failed:", error);
      return NextResponse.json(
        { queued: false, error: error?.message ?? "Arama talebi oluşturulamadı." },
        { status: 500 },
      );
    }
    demandId = String(data.id);
  }

  const { data: sources, error: sourceError } = await supabase
    .from("sources")
    .select("id")
    .eq("is_active", true);

  if (sourceError) {
    console.error("Search demand sources query failed:", sourceError);
    return NextResponse.json(
      { queued: false, error: sourceError.message },
      { status: 500 },
    );
  }

  const sourceIds = (sources ?? []).map((source) => Number(source.id));
  if (sourceIds.length) {
    const existingJobsResult = await supabase
      .from("bot_queue")
      .select("source_id")
      .eq("demand_id", demandId)
      .in("status", ["pending", "processing"]);

    if (existingJobsResult.error) {
      console.error("Search demand queue lookup failed:", existingJobsResult.error);
      return NextResponse.json(
        { queued: false, error: existingJobsResult.error.message },
        { status: 500 },
      );
    }

    const existingSourceIds = new Set(
      (existingJobsResult.data ?? []).map((job) => Number(job.source_id)),
    );
    const queueRows = sourceIds
      .filter((sourceId) => !existingSourceIds.has(sourceId))
      .map((sourceId) => ({
        demand_id: demandId,
        query,
        normalized_query: normalizedQuery,
        source_id: sourceId,
        status: "pending",
        priority: resultCount === 0 ? 3 : 5,
        ...(category ? { category } : {}),
      }));

    if (queueRows.length) {
      const { error } = await supabase.from("bot_queue").insert(queueRows);
      if (error) {
        console.error("Search demand queue insert failed:", error);
        return NextResponse.json(
          { queued: false, error: error.message },
          { status: 500 },
        );
      }
    }
  }

  return NextResponse.json({
    queued: true,
    message: "Bu ürün için piyasayı tarıyoruz.",
  });
}

function isMissingSearchQueueTable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: string; message?: string; details?: string };
  const text = `${record.message ?? ""} ${record.details ?? ""}`.toLowerCase();
  return (
    record.code === "42P01" ||
    record.code === "PGRST205" ||
    text.includes("search_demands") ||
    text.includes("bot_queue")
  );
}
