"use client";

import { useState, useTransition } from "react";

type BotTask = "search_queue" | "sources" | "price_alerts" | "daily";

export type BotMonitor = {
  task: BotTask;
  botName: string;
  status: string;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  foundCount: number;
  importedCount: number;
  updatedCount: number;
  matchedProductCount: number;
  skippedCount: number;
  errorCount: number;
  durationMs: number | null;
};

export type SourceHealthMonitor = {
  sourceId: number;
  sourceName: string;
  sourceSlug: string;
  adapterType: string;
  enabled: boolean;
  healthStatus: "healthy" | "warning" | "failed" | "unknown";
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  foundCount: number;
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  matchedProductCount: number;
  durationMs: number | null;
  successRate24h: number | null;
};

type TaskResult = {
  ok: boolean;
  task?: BotTask;
  botName?: string;
  runId?: number | null;
  status?: number;
  metrics?: {
    found: number;
    imported: number;
    updated: number;
    matchedProducts: number;
    skipped: number;
    errorCount: number;
  };
  data?: unknown;
  error?: string;
};

const TASK_DESCRIPTIONS: Record<BotTask, string> = {
  search_queue: "Az sonuçlu aramalardan oluşan bot_queue kayıtlarını işler.",
  sources: "Aktif kaynakların planlı veri çekimini başlatır.",
  price_alerts: "Aktif fiyat alarmlarını güncel ilan fiyatlarına göre kontrol eder.",
  daily: "Günlük cron içindeki tüm bot görevlerini sırayla tetikler.",
};

export function BotCenterClient({
  initialMonitors,
  initialSourceHealth,
}: {
  initialMonitors: BotMonitor[];
  initialSourceHealth: SourceHealthMonitor[];
}) {
  const [monitors, setMonitors] = useState(initialMonitors);
  const [sourceHealth, setSourceHealth] = useState(initialSourceHealth);
  const [pendingTask, setPendingTask] = useState<BotTask | null>(null);
  const [pendingSourceId, setPendingSourceId] = useState<number | null>(null);
  const [result, setResult] = useState<TaskResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function runTask(task: BotTask) {
    const startedAt = new Date().toISOString();
    setPendingTask(task);
    setResult(null);
    setMonitors((items) =>
      items.map((item) =>
        item.task === task
          ? {
              ...item,
              status: "running",
              lastRunAt: startedAt,
              lastErrorMessage: null,
              durationMs: null,
            }
          : item,
      ),
    );

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/run-bot-task", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ task }),
        });
        const data = (await response.json().catch(() => null)) as TaskResult | null;
        const fallback: TaskResult = {
          ok: false,
          task,
          error: "Bot görevi JSON cevabı döndürmedi.",
        };
        const nextResult = data ?? fallback;
        setResult(nextResult);
        updateMonitorFromResult(task, startedAt, nextResult);
      } catch (error) {
        const nextResult: TaskResult = {
          ok: false,
          task,
          error: error instanceof Error ? error.message : "Bilinmeyen hata",
        };
        setResult(nextResult);
        updateMonitorFromResult(task, startedAt, nextResult);
      } finally {
        setPendingTask(null);
      }
    });
  }

  function runSourceHealthCheck(sourceId: number) {
    setPendingSourceId(sourceId);
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/source-health/check", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sourceId }),
        });
        const data = (await response.json().catch(() => null)) as {
          ok?: boolean;
          sourceId?: number;
          healthStatus?: SourceHealthMonitor["healthStatus"];
          message?: string | null;
        } | null;

        setSourceHealth((items) =>
          items.map((item) =>
            item.sourceId === sourceId
              ? {
                  ...item,
                  healthStatus:
                    data?.healthStatus ??
                    (response.ok && data?.ok ? "healthy" : "failed"),
                  lastErrorAt:
                    response.ok && data?.ok
                      ? item.lastErrorAt
                      : new Date().toISOString(),
                  lastErrorMessage:
                    response.ok && data?.ok
                      ? null
                      : data?.message ?? "Health check başarısız oldu.",
                }
              : item,
          ),
        );
      } catch (error) {
        setSourceHealth((items) =>
          items.map((item) =>
            item.sourceId === sourceId
              ? {
                  ...item,
                  healthStatus: "failed",
                  lastErrorAt: new Date().toISOString(),
                  lastErrorMessage:
                    error instanceof Error ? error.message : "Bilinmeyen hata",
                }
              : item,
          ),
        );
      } finally {
        setPendingSourceId(null);
      }
    });
  }

  function updateMonitorFromResult(
    task: BotTask,
    startedAt: string,
    taskResult: TaskResult,
  ) {
    const finishedAt = new Date().toISOString();
    setMonitors((items) =>
      items.map((item) => {
        if (item.task !== task) return item;
        const metrics = taskResult.metrics;
        const ok = Boolean(taskResult.ok);
        return {
          ...item,
          botName: taskResult.botName ?? item.botName,
          status: ok ? "success" : "failed",
          lastRunAt: startedAt,
          lastSuccessAt: ok ? finishedAt : item.lastSuccessAt,
          lastErrorAt: ok ? item.lastErrorAt : finishedAt,
          lastErrorMessage: ok ? null : taskResult.error ?? extractError(taskResult.data),
          foundCount: metrics?.found ?? item.foundCount,
          importedCount: metrics?.imported ?? item.importedCount,
          updatedCount: metrics?.updated ?? item.updatedCount,
          matchedProductCount:
            metrics?.matchedProducts ?? item.matchedProductCount,
          skippedCount: metrics?.skipped ?? item.skippedCount,
          errorCount: metrics?.errorCount ?? item.errorCount,
          durationMs: Math.max(
            0,
            new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
          ),
        };
      }),
    );
  }

  return (
    <div className="grid gap-6">
      <section id="manual-tasks" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {monitors.map((monitor) => (
          <article
            key={monitor.task}
            className="rounded-2xl border border-black/8 bg-white p-5 shadow-[0_12px_30px_rgba(0,0,0,0.035)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black tracking-[-0.025em]">
                  {monitor.botName}
                </h2>
                <p className="mt-2 min-h-12 text-sm leading-6 text-black/50">
                  {TASK_DESCRIPTIONS[monitor.task]}
                </p>
              </div>
              <StatusBadge status={monitor.status} />
            </div>
            <button
              type="button"
              onClick={() => runTask(monitor.task)}
              disabled={isPending}
              className="orange-button mt-5 w-full py-3 disabled:opacity-50"
            >
              {pendingTask === monitor.task ? "Çalıştırılıyor..." : "Çalıştır"}
            </button>
          </article>
        ))}
      </section>

      <section id="bot-runs" className="rounded-2xl border border-black/8 bg-white shadow-[0_12px_30px_rgba(0,0,0,0.035)]">
        <div className="border-b border-black/7 p-5">
          <h2 className="text-xl font-black tracking-[-0.03em]">
            Bot canlılık izleme
          </h2>
          <p className="mt-2 text-sm text-black/45">
            Son çalışma durumları, sayaçlar ve hata mesajları bot_runs kayıtlarından
            okunur.
          </p>
        </div>
        <div className="w-full max-w-full overflow-x-auto [-webkit-overflow-scrolling:touch]">
          <table className="w-full min-w-[1320px] text-left text-sm">
            <thead className="bg-[#fafaf8] text-xs uppercase tracking-wide text-black/45">
              <tr>
                <th className="px-4 py-3">Bot adı</th>
                <th className="px-4 py-3">Durum</th>
                <th className="px-4 py-3">Son çalışma</th>
                <th className="px-4 py-3">Son başarı</th>
                <th className="px-4 py-3">Son hata</th>
                <th className="px-4 py-3 text-center">Bulunan</th>
                <th className="px-4 py-3 text-center">Eklenen</th>
                <th className="px-4 py-3 text-center">Güncellenen</th>
                <th className="px-4 py-3 text-center">Eşleşen ürün</th>
                <th className="px-4 py-3 text-center">Süre</th>
                <th className="px-4 py-3">Son hata mesajı</th>
              </tr>
            </thead>
            <tbody>
              {monitors.map((monitor) => (
                <tr key={monitor.task} className="border-t border-black/7 align-top">
                  <td className="px-4 py-4 font-black">{monitor.botName}</td>
                  <td className="px-4 py-4">
                    <StatusBadge status={monitor.status} />
                  </td>
                  <td className="px-4 py-4 text-black/55">
                    {formatDate(monitor.lastRunAt)}
                  </td>
                  <td className="px-4 py-4 text-black/55">
                    {formatDate(monitor.lastSuccessAt)}
                  </td>
                  <td className="px-4 py-4 text-black/55">
                    {formatDate(monitor.lastErrorAt)}
                  </td>
                  <CountCell value={monitor.foundCount} />
                  <CountCell value={monitor.importedCount} accent="green" />
                  <CountCell value={monitor.updatedCount} accent="blue" />
                  <CountCell value={monitor.matchedProductCount} accent="orange" />
                  <td className="px-4 py-4 text-center font-black">
                    {formatDuration(monitor.durationMs)}
                  </td>
                  <td className="max-w-80 break-words px-4 py-4 text-xs leading-5 text-red-700">
                    {monitor.lastErrorMessage ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="source-health" className="rounded-2xl border border-black/8 bg-white shadow-[0_12px_30px_rgba(0,0,0,0.035)]">
        <div className="border-b border-black/7 p-5">
          <h2 className="text-xl font-black tracking-[-0.03em]">
            Kaynak Sağlığı
          </h2>
          <p className="mt-2 text-sm text-black/45">
            Her kaynak için adapter durumu, son bot sonuçları ve son 24 saat
            başarı oranı burada izlenir.
          </p>
        </div>
        <div className="w-full max-w-full overflow-x-auto [-webkit-overflow-scrolling:touch]">
          <table className="w-full min-w-[1420px] text-left text-sm">
            <thead className="bg-[#fafaf8] text-xs uppercase tracking-wide text-black/45">
              <tr>
                <th className="px-4 py-3">Kaynak</th>
                <th className="px-4 py-3">Adapter</th>
                <th className="px-4 py-3">Enabled</th>
                <th className="px-4 py-3">Health</th>
                <th className="px-4 py-3">Son çalışma</th>
                <th className="px-4 py-3">Son başarı</th>
                <th className="px-4 py-3">Son hata</th>
                <th className="px-4 py-3 text-center">Bulunan</th>
                <th className="px-4 py-3 text-center">Eklenen</th>
                <th className="px-4 py-3 text-center">Güncellenen</th>
                <th className="px-4 py-3 text-center">Atlanan</th>
                <th className="px-4 py-3 text-center">Eşleşen ürün</th>
                <th className="px-4 py-3 text-center">Süre</th>
                <th className="px-4 py-3 text-center">24s başarı</th>
                <th className="px-4 py-3">Son hata mesajı</th>
                <th className="px-4 py-3 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {sourceHealth.map((source) => (
                <tr key={source.sourceId} className="border-t border-black/7 align-top">
                  <td className="px-4 py-4">
                    <p className="font-black">{source.sourceName}</p>
                    <p className="mt-1 text-xs font-semibold text-black/35">
                      {source.sourceSlug}
                    </p>
                  </td>
                  <td className="px-4 py-4 font-bold text-black/55">
                    {source.adapterType}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${source.enabled ? "bg-green-100 text-green-700" : "bg-black/7 text-black/45"}`}>
                      {source.enabled ? "Aktif" : "Pasif"}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <HealthBadge status={source.healthStatus} />
                  </td>
                  <td className="px-4 py-4 text-black/55">
                    {formatDate(source.lastRunAt)}
                  </td>
                  <td className="px-4 py-4 text-black/55">
                    {formatDate(source.lastSuccessAt)}
                  </td>
                  <td className="px-4 py-4 text-black/55">
                    {formatDate(source.lastErrorAt)}
                  </td>
                  <CountCell value={source.foundCount} />
                  <CountCell value={source.importedCount} accent="green" />
                  <CountCell value={source.updatedCount} accent="blue" />
                  <CountCell value={source.skippedCount} />
                  <CountCell value={source.matchedProductCount} accent="orange" />
                  <td className="px-4 py-4 text-center font-black">
                    {formatDuration(source.durationMs)}
                  </td>
                  <td className="px-4 py-4 text-center font-black">
                    {source.successRate24h === null ? "-" : `%${source.successRate24h}`}
                  </td>
                  <td className="max-w-80 break-words px-4 py-4 text-xs leading-5 text-red-700">
                    {source.lastErrorMessage ?? "-"}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => runSourceHealthCheck(source.sourceId)}
                      disabled={pendingSourceId === source.sourceId || isPending}
                      className="rounded-xl border border-[#ff6b00]/25 px-3 py-2 text-xs font-black text-[#d95700] disabled:opacity-50"
                    >
                      {pendingSourceId === source.sourceId
                        ? "Kontrol ediliyor"
                        : "Health check çalıştır"}
                    </button>
                  </td>
                </tr>
              ))}
              {!sourceHealth.length && (
                <tr>
                  <td colSpan={16} className="px-4 py-10 text-center text-sm font-semibold text-black/45">
                    Kaynak kaydı bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-black/8 bg-white p-5 shadow-[0_12px_30px_rgba(0,0,0,0.035)]">
        <h2 className="text-lg font-black tracking-[-0.025em]">Sonuç</h2>
        {!result ? (
          <p className="mt-3 text-sm text-black/45">
            Henüz bu oturumda bir bot görevi çalıştırılmadı.
          </p>
        ) : (
          <div
            className={`mt-4 rounded-2xl border p-4 ${
              result.ok
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            <p className="font-black">
              {result.ok
                ? "Bot görevi başarıyla tamamlandı."
                : "Bot görevi hata verdi."}
            </p>
            <pre className="mt-4 max-h-[420px] overflow-auto rounded-xl bg-white/70 p-4 text-xs leading-5 text-black">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </section>
    </div>
  );
}

function HealthBadge({ status }: { status: SourceHealthMonitor["healthStatus"] }) {
  const className =
    status === "healthy"
      ? "bg-green-100 text-green-700"
      : status === "warning"
        ? "bg-amber-100 text-amber-800"
        : status === "failed"
          ? "bg-red-100 text-red-700"
          : "bg-black/7 text-black/45";
  const label =
    status === "healthy"
      ? "healthy"
      : status === "warning"
        ? "warning"
        : status === "failed"
          ? "failed"
          : "unknown";

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${className}`}>
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "success" || status === "completed"
      ? "bg-green-100 text-green-700"
      : status === "failed" || status === "error"
        ? "bg-red-100 text-red-700"
        : status === "running"
          ? "bg-amber-100 text-amber-800"
          : "bg-black/7 text-black/45";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${className}`}>
      {statusLabel(status)}
    </span>
  );
}

function CountCell({
  value,
  accent,
}: {
  value: number;
  accent?: "green" | "blue" | "orange";
}) {
  const className =
    accent === "green"
      ? "text-green-700"
      : accent === "blue"
        ? "text-blue-700"
        : accent === "orange"
          ? "text-[#ff6b00]"
          : "";
  return (
    <td className={`px-4 py-4 text-center text-lg font-black ${className}`}>
      {value.toLocaleString("tr-TR")}
    </td>
  );
}

function statusLabel(status: string) {
  if (status === "success" || status === "completed") return "success";
  if (status === "failed" || status === "error") return "failed";
  if (status === "running") return "running";
  return "idle";
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDuration(value: number | null) {
  if (value === null) return "-";
  if (value < 1000) return `${Math.round(value)} ms`;
  if (value < 60_000) return `${(value / 1000).toFixed(1)} sn`;
  const minutes = Math.floor(value / 60_000);
  const seconds = Math.round((value % 60_000) / 1000);
  return `${minutes} dk ${seconds} sn`;
}

function extractError(data: unknown) {
  if (!data || typeof data !== "object") return "Bot görevi başarısız tamamlandı.";
  const record = data as Record<string, unknown>;
  return typeof record.error === "string"
    ? record.error
    : "Bot görevi başarısız tamamlandı.";
}
