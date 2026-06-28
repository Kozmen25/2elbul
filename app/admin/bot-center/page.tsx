import { Bot } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-ui";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { BotCenterClient } from "./bot-center-client";

type BotTask = "search_queue" | "sources" | "price_alerts" | "daily";

const BOT_TASKS: Array<{ task: BotTask; name: string }> = [
  { task: "search_queue", name: "Arama Kuyruğu" },
  { task: "sources", name: "Kaynak Senkronizasyonu" },
  { task: "price_alerts", name: "Fiyat Alarmları" },
  { task: "daily", name: "Günlük Cron" },
];

export default async function AdminBotCenterPage() {
  const monitors = await loadBotMonitors();

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
      <BotCenterClient initialMonitors={monitors} />
    </>
  );
}

type BotRunRow = {
  id: unknown;
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
