import { Bot } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-ui";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  BotCenterClient,
  type SourceHealthMonitor,
} from "./bot-center-client";

type BotTask = "search_queue" | "sources" | "price_alerts" | "daily";

const BOT_TASKS: Array<{ task: BotTask; name: string }> = [
  { task: "search_queue", name: "Arama Kuyruğu" },
  { task: "sources", name: "Kaynak Senkronizasyonu" },
  { task: "price_alerts", name: "Fiyat Alarmları" },
  { task: "daily", name: "Günlük Cron" },
];

export default async function AdminBotCenterPage() {
  const monitors = await loadBotMonitors();
  const sourceHealth = await loadSourceHealth();

  return (
    <>
      <AdminPageHeader
        eyebrow="Bot kontrol paneli"
        title="Bot Merkezi"
        description="Cron URL'si yazmadan arama kuyruğunu, kaynak senkronizasyonunu, fiyat alarmlarını ve günlük cron akışını güvenli şekilde çalıştırın."
        action={
          <span className="grid size-12 place-items-center rounded-2xl bg-[#fff1e7] text-[#ff6b00]">
            <Bot size={24} />
          </span>
        }
      />
      <BotCenterClient
        initialMonitors={monitors}
        initialSourceHealth={sourceHealth}
      />
    </>
  );
}

type BotRunRow = {
  id: unknown;
  source_id?: unknown;
  status: unknown;
  run_type: unknown;
  started_at: unknown;
  finished_at: unknown;
  found_count: unknown;
  imported_count: unknown;
  updated_count: unknown;
  matched_product_count?: unknown;
  skipped_count: unknown;
  error_count: unknown;
  error_message: unknown;
  created_at: unknown;
};

type SourceRow = {
  id: unknown;
  name: unknown;
  slug: unknown;
  is_active?: unknown;
  integration_type?: unknown;
  scrape_url?: unknown;
  api_url?: unknown;
  fetch_limit?: unknown;
  product_limit?: unknown;
};

async function loadBotMonitors() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return BOT_TASKS.map((task) => emptyMonitor(task.task, task.name));
  }

  let runsResult: {
    data: BotRunRow[] | null;
    error: unknown;
  } = await supabase
    .from("bot_runs")
    .select(
      "id, status, run_type, started_at, finished_at, found_count, imported_count, updated_count, matched_product_count, skipped_count, error_count, error_message, created_at",
    )
    .in(
      "run_type",
      BOT_TASKS.map((task) => task.task),
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (runsResult.error && isMissingColumn(runsResult.error, ["matched_product_count"])) {
    runsResult = await supabase
      .from("bot_runs")
      .select(
        "id, status, run_type, started_at, finished_at, found_count, imported_count, updated_count, skipped_count, error_count, error_message, created_at",
      )
      .in(
        "run_type",
        BOT_TASKS.map((task) => task.task),
      )
      .order("created_at", { ascending: false })
      .limit(200);
  }

  if (runsResult.error) {
    console.error("Bot center monitor query failed:", runsResult.error);
    return BOT_TASKS.map((task) => emptyMonitor(task.task, task.name));
  }

  const rows = runsResult.data ?? [];
  return BOT_TASKS.map((task) => {
    const taskRuns = rows.filter((run) => String(run.run_type) === task.task);
    const latest = taskRuns[0];
    const latestSuccess = taskRuns.find((run) =>
      ["success", "completed"].includes(String(run.status)),
    );
    const latestError = taskRuns.find(
      (run) =>
        ["failed", "error"].includes(String(run.status)) || run.error_message,
    );

    return {
      task: task.task,
      botName: task.name,
      status: latest ? String(latest.status) : "idle",
      lastRunAt: latest?.started_at ? String(latest.started_at) : null,
      lastSuccessAt: latestSuccess?.finished_at
        ? String(latestSuccess.finished_at)
        : null,
      lastErrorAt: latestError?.finished_at
        ? String(latestError.finished_at)
        : null,
      lastErrorMessage: latestError?.error_message
        ? String(latestError.error_message)
        : null,
      foundCount: Number(latest?.found_count ?? 0),
      importedCount: Number(latest?.imported_count ?? 0),
      updatedCount: Number(latest?.updated_count ?? 0),
      matchedProductCount: Number(latest?.matched_product_count ?? 0),
      skippedCount: Number(latest?.skipped_count ?? 0),
      errorCount: Number(latest?.error_count ?? 0),
      durationMs:
        latest?.started_at && latest?.finished_at
          ? Math.max(
              0,
              new Date(String(latest.finished_at)).getTime() -
                new Date(String(latest.started_at)).getTime(),
            )
          : null,
    };
  });
}

async function loadSourceHealth(): Promise<SourceHealthMonitor[]> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return [];

  let sourcesResult: {
    data: SourceRow[] | null;
    error: unknown;
  } = await supabase
    .from("sources")
    .select(
      "id, name, slug, is_active, integration_type, scrape_url, api_url, fetch_limit, product_limit",
    )
    .order("name", { ascending: true });

  if (sourcesResult.error && isMissingColumn(sourcesResult.error, ["api_url"])) {
    sourcesResult = await supabase
      .from("sources")
      .select(
        "id, name, slug, is_active, integration_type, scrape_url, fetch_limit, product_limit",
      )
      .order("name", { ascending: true });
  }

  if (sourcesResult.error) {
    console.error("Source health sources query failed:", sourcesResult.error);
    return [];
  }

  const sourceRows = sourcesResult.data ?? [];
  const sourceIds = sourceRows.map((source) => Number(source.id)).filter(Boolean);
  if (!sourceIds.length) return [];

  let runsResult: {
    data: BotRunRow[] | null;
    error: unknown;
  } = await supabase
    .from("bot_runs")
    .select(
      "id, source_id, status, run_type, started_at, finished_at, found_count, imported_count, updated_count, matched_product_count, skipped_count, error_count, error_message, created_at",
    )
    .in("source_id", sourceIds)
    .order("created_at", { ascending: false })
    .limit(500);

  if (runsResult.error && isMissingColumn(runsResult.error, ["matched_product_count"])) {
    runsResult = await supabase
      .from("bot_runs")
      .select(
        "id, source_id, status, run_type, started_at, finished_at, found_count, imported_count, updated_count, skipped_count, error_count, error_message, created_at",
      )
      .in("source_id", sourceIds)
      .order("created_at", { ascending: false })
      .limit(500);
  }

  if (runsResult.error) {
    console.error("Source health bot_runs query failed:", runsResult.error);
  }

  const runs = runsResult.data ?? [];
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;

  return sourceRows.map((source) => {
    const id = Number(source.id);
    const sourceRuns = runs.filter((run) => Number((run as { source_id?: unknown }).source_id) === id);
    const latest = sourceRuns[0];
    const latestSuccess = sourceRuns.find((run) =>
      ["success", "completed"].includes(String(run.status)),
    );
    const latestError = sourceRuns.find(
      (run) =>
        ["failed", "error"].includes(String(run.status)) || run.error_message,
    );
    const last24Runs = sourceRuns.filter((run) => {
      const createdAt = new Date(String(run.created_at ?? run.started_at ?? "")).getTime();
      return Number.isFinite(createdAt) && createdAt >= dayAgo;
    });
    const success24 = last24Runs.filter((run) =>
      ["success", "completed"].includes(String(run.status)),
    ).length;
    const successRate24h = last24Runs.length
      ? Math.round((success24 / last24Runs.length) * 100)
      : null;
    const healthStatus = getSourceHealthStatus({
      isActive: Boolean(source.is_active ?? true),
      latest,
      successRate24h,
    });

    return {
      sourceId: id,
      sourceName: String(source.name ?? "Kaynak"),
      sourceSlug: String(source.slug ?? ""),
      adapterType: String(source.integration_type ?? "scrape"),
      enabled: Boolean(source.is_active ?? true),
      healthStatus,
      lastRunAt: latest?.started_at ? String(latest.started_at) : null,
      lastSuccessAt: latestSuccess?.finished_at
        ? String(latestSuccess.finished_at)
        : null,
      lastErrorAt: latestError?.finished_at
        ? String(latestError.finished_at)
        : null,
      lastErrorMessage: latestError?.error_message
        ? String(latestError.error_message)
        : null,
      foundCount: Number(latest?.found_count ?? 0),
      importedCount: Number(latest?.imported_count ?? 0),
      updatedCount: Number(latest?.updated_count ?? 0),
      skippedCount: Number(latest?.skipped_count ?? 0),
      matchedProductCount: Number(latest?.matched_product_count ?? 0),
      durationMs:
        latest?.started_at && latest?.finished_at
          ? Math.max(
              0,
              new Date(String(latest.finished_at)).getTime() -
                new Date(String(latest.started_at)).getTime(),
            )
          : null,
      successRate24h,
    };
  });
}

function getSourceHealthStatus({
  isActive,
  latest,
  successRate24h,
}: {
  isActive: boolean;
  latest: BotRunRow | undefined;
  successRate24h: number | null;
}): SourceHealthMonitor["healthStatus"] {
  if (!isActive) return "unknown";
  if (!latest) return "unknown";
  if (["failed", "error"].includes(String(latest.status))) return "failed";
  if (successRate24h !== null && successRate24h < 70) return "warning";
  if (["success", "completed"].includes(String(latest.status))) return "healthy";
  if (String(latest.status) === "running") return "warning";
  return "unknown";
}

function emptyMonitor(task: BotTask, botName: string) {
  return {
    task,
    botName,
    status: "idle",
    lastRunAt: null,
    lastSuccessAt: null,
    lastErrorAt: null,
    lastErrorMessage: null,
    foundCount: 0,
    importedCount: 0,
    updatedCount: 0,
    matchedProductCount: 0,
    skippedCount: 0,
    errorCount: 0,
    durationMs: null,
  };
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
