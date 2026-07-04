import { NextRequest, NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type BotTask = "search_queue" | "sources" | "price_alerts" | "daily";

const TASK_PATHS: Record<BotTask, string> = {
  search_queue: "/api/cron/process-search-queue",
  sources: "/api/cron/run-sources",
  price_alerts: "/api/cron/check-price-alerts",
  daily: "/api/cron/daily",
};

const TASK_LABELS: Record<BotTask, string> = {
  search_queue: "Arama Kuyruğu",
  sources: "Kaynak Senkronizasyonu",
  price_alerts: "Fiyat Alarmları",
  daily: "Günlük Cron",
};

export async function POST(request: NextRequest) {
  const authResult = await verifyAdmin();
  if (authResult) return authResult;

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET tanımlı değil." },
      { status: 500 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    task?: unknown;
  } | null;
  const task = body?.task;

  if (!isBotTask(task)) {
    return NextResponse.json(
      { ok: false, error: "Geçerli bir bot görevi seçin." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminClient();
  const startedAt = new Date().toISOString();
  const runId = supabase
    ? await createBotCenterRun(supabase, task, startedAt)
    : null;

  let response: Response;
  let data: unknown;
  const taskPath = task === "sources"
    ? `${TASK_PATHS[task]}?force=1`
    : TASK_PATHS[task];

  try {
    response = await fetch(`${request.nextUrl.origin}${taskPath}`, {
      headers: {
        "x-cron-secret": secret,
      },
      cache: "no-store",
    });
    data = await readJsonSafely(response);
  } catch (error) {
    response = new Response(null, { status: 500 });
    data = {
      ok: false,
      error: error instanceof Error ? error.message : "Bilinmeyen bot hatası",
    };
  }

  const metrics = extractTaskMetrics(task, data);
  const ok = response.ok && getResponseOk(data);
  const errorMessage = ok ? null : extractErrorMessage(data);
  if (supabase && runId) {
    await finishBotCenterRun(supabase, runId, {
      ok,
      finishedAt: new Date().toISOString(),
      metrics,
      errorMessage,
    });
  }

  return NextResponse.json(
    {
      ok,
      task,
      runId,
      botName: TASK_LABELS[task],
      status: response.status,
      metrics,
      data,
    },
    { status: ok ? 200 : 502 },
  );
}

async function verifyAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = (await supabase?.auth.getUser()) ?? {
    data: { user: null },
    error: null,
  };

  if (error) {
    console.error("Admin bot task auth failed:", error);
  }

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Bu işlem için giriş yapmalısınız." },
      { status: 401 },
    );
  }

  if (!isAdminEmail(user.email)) {
    return NextResponse.json(
      { ok: false, error: "Bu işlem için admin yetkisi gerekli." },
      { status: 403 },
    );
  }

  return null;
}

function isBotTask(value: unknown): value is BotTask {
  return (
    value === "search_queue" ||
    value === "sources" ||
    value === "price_alerts" ||
    value === "daily"
  );
}

async function readJsonSafely(response: Response) {
  try {
    return await response.json();
  } catch {
    return { error: "Bot görevi JSON cevabı döndürmedi." };
  }
}

async function createBotCenterRun(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  task: BotTask,
  startedAt: string,
) {
  const payload = {
    source_id: null,
    status: "running",
    run_type: task,
    started_at: startedAt,
    error_message: `${TASK_LABELS[task]} çalışıyor.`,
  };
  const { data, error } = await supabase
    .from("bot_runs")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    console.error("Bot center run insert failed:", error);
    return null;
  }

  return Number(data.id);
}

async function finishBotCenterRun(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  runId: number,
  input: {
    ok: boolean;
    finishedAt: string;
    metrics: BotTaskMetrics;
    errorMessage: string | null;
  },
) {
  const payload = {
    status: input.ok ? "success" : "failed",
    finished_at: input.finishedAt,
    found_count: input.metrics.found,
    imported_count: input.metrics.imported,
    updated_count: input.metrics.updated,
    matched_product_count: input.metrics.matchedProducts,
    skipped_count: input.metrics.skipped,
    error_count: input.metrics.errorCount,
    error_message: input.errorMessage,
  };
  let result = await supabase.from("bot_runs").update(payload).eq("id", runId);

  if (result.error && isMissingColumn(result.error, ["matched_product_count"])) {
    const { matched_product_count: _matchedProductCount, ...legacyPayload } =
      payload;
    result = await supabase.from("bot_runs").update(legacyPayload).eq("id", runId);
  }

  if (result.error) {
    console.error("Bot center run update failed:", result.error);
  }
}

type BotTaskMetrics = {
  found: number;
  imported: number;
  updated: number;
  matchedProducts: number;
  skipped: number;
  errorCount: number;
};

function extractTaskMetrics(task: BotTask, data: unknown): BotTaskMetrics {
  const record = asRecord(data);
  if (task === "sources") {
    const results = Array.isArray(record.results) ? record.results : [];
    return sumMetrics(results);
  }
  if (task === "daily") {
    const results = Array.isArray(record.results)
      ? record.results.flatMap((item) => {
          const taskData = asRecord(asRecord(item).data);
          return Array.isArray(taskData.results) ? taskData.results : [taskData];
        })
      : [];
    return sumMetrics(results);
  }
  if (task === "price_alerts") {
    return {
      found: numberValue(record.checked),
      imported: numberValue(record.triggered),
      updated: numberValue(record.checked),
      matchedProducts: 0,
      skipped: 0,
      errorCount: numberValue(record.failed),
    };
  }
  return {
    found: numberValue(record.scanned),
    imported: numberValue(record.imported),
    updated: numberValue(record.updated),
    matchedProducts: numberValue(record.matchedProducts),
    skipped: numberValue(record.skipped),
    errorCount: numberValue(record.failed),
  };
}

function sumMetrics(items: unknown[]): BotTaskMetrics {
  const initial: BotTaskMetrics = {
    found: 0,
    imported: 0,
    updated: 0,
    matchedProducts: 0,
    skipped: 0,
    errorCount: 0,
  };

  return items.reduce<BotTaskMetrics>(
    (total, item) => {
      const record = asRecord(item);
      total.found += numberValue(record.found) || numberValue(record.scanned);
      total.imported += numberValue(record.imported);
      total.updated += numberValue(record.updated);
      total.matchedProducts += numberValue(record.matchedProducts);
      total.skipped += numberValue(record.skipped);
      total.errorCount += numberValue(record.errorCount) || numberValue(record.failed);
      return total;
    },
    initial,
  );
}

function getResponseOk(data: unknown) {
  const record = asRecord(data);
  return record.ok !== false;
}

function extractErrorMessage(data: unknown) {
  const record = asRecord(data);
  if (typeof record.error === "string") return record.error;
  if (Array.isArray(record.results)) {
    const messages = record.results
      .map((item) => {
        const result = asRecord(item);
        return typeof result.error === "string"
          ? result.error
          : typeof result.errorMessage === "string"
            ? result.errorMessage
            : "";
      })
      .filter(Boolean);
    if (messages.length) return messages.join(" | ").slice(0, 4000);
  }
  return "Bot görevi başarısız tamamlandı.";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function numberValue(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
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
