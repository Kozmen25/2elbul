import { CircleCheckBig, Timer, TriangleAlert } from "lucide-react";
import { AdminEmpty, AdminPageHeader } from "@/components/admin-ui";
import { formatDateTR } from "@/lib/formatters";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type BotRun = {
  id: number;
  sourceName: string;
  status: string;
  runType: string;
  startedAt: string | null;
  finishedAt: string | null;
  foundCount: number;
  importedCount: number;
  updatedCount: number;
  inactiveCount: number;
  reactivatedCount: number;
  skippedCount: number;
  errorCount: number;
  errorMessage: string | null;
  createdAt: string;
};

export default async function AdminBotRunsPage() {
  const supabase = createSupabaseAdminClient();
  const [sourcesResult, runsResult] = supabase
    ? await Promise.all([
        supabase.from("sources").select("id, name"),
        supabase
          .from("bot_runs")
          .select(
            "id, source_id, status, run_type, started_at, finished_at, found_count, imported_count, updated_count, inactive_count, reactivated_count, skipped_count, error_count, error_message, created_at",
          )
          .order("created_at", { ascending: false })
          .limit(250),
      ])
    : [null, null];

  if (sourcesResult?.error) {
    console.error("Admin bot run sources query failed:", sourcesResult.error);
  }
  if (runsResult?.error) {
    console.error("Admin bot runs query failed:", runsResult.error);
  }

  const sourceNames = new Map(
    (sourcesResult?.data ?? []).map((source) => [
      String(source.id),
      String(source.name),
    ]),
  );
  const runs: BotRun[] = (runsResult?.data ?? []).map((run) => ({
    id: Number(run.id),
    sourceName:
      sourceNames.get(String(run.source_id)) ?? `Kaynak #${run.source_id}`,
    status: String(run.status),
    runType: String(run.run_type),
    startedAt: run.started_at ? String(run.started_at) : null,
    finishedAt: run.finished_at ? String(run.finished_at) : null,
    foundCount: Number(run.found_count),
    importedCount: Number(run.imported_count),
    updatedCount: Number(run.updated_count ?? 0),
    inactiveCount: Number(run.inactive_count ?? 0),
    reactivatedCount: Number(run.reactivated_count ?? 0),
    skippedCount: Number(run.skipped_count),
    errorCount: Number(run.error_count),
    errorMessage: run.error_message ? String(run.error_message) : null,
    createdAt: String(run.created_at),
  }));
  const finishedRuns = runs.filter((run) =>
    ["success", "completed", "failed", "error"].includes(run.status),
  );
  const successfulRuns = finishedRuns.filter((run) =>
    ["success", "completed"].includes(run.status),
  ).length;
  const successRate = finishedRuns.length
    ? Math.round((successfulRuns / finishedRuns.length) * 100)
    : 0;
  const durations = runs
    .filter((run) => run.startedAt && run.finishedAt)
    .map(
      (run) =>
        new Date(run.finishedAt!).getTime() -
        new Date(run.startedAt!).getTime(),
    )
    .filter((duration) => duration >= 0);
  const averageDuration = durations.length
    ? durations.reduce((total, duration) => total + duration, 0) /
      durations.length
    : 0;
  const latestError = runs.find(
    (run) => run.errorMessage || ["failed", "error"].includes(run.status),
  );

  return (
    <>
      <AdminPageHeader
        eyebrow="Otomasyon geçmişi"
        title="Bot Çalışmaları"
        description="Kaynak botlarının son çalışma durumlarını, aktarım sayılarını ve hata detaylarını takip edin."
      />

      {!supabase || runsResult?.error ? (
        <AdminEmpty>
          Bot çalışma kayıtları okunamadı. Önce
          `supabase/sources-and-bots.sql` migration dosyasını çalıştırın.
        </AdminEmpty>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <BotMetricCard
              icon={CircleCheckBig}
              label="Başarı oranı"
              value={finishedRuns.length ? `%${successRate}` : "—"}
              note={`${successfulRuns}/${finishedRuns.length} başarılı çalışma`}
              tone="green"
            />
            <BotMetricCard
              icon={Timer}
              label="Ortalama çalışma süresi"
              value={durations.length ? formatDuration(averageDuration) : "—"}
              note={`${durations.length} tamamlanmış çalışma`}
              tone="orange"
            />
            <BotMetricCard
              icon={TriangleAlert}
              label="Son hata"
              value={latestError?.sourceName ?? "Hata yok"}
              note={latestError?.errorMessage ?? "Kayıtlı bot hatası bulunmuyor."}
              tone={latestError ? "red" : "green"}
            />
          </div>

          {runs.length ? (
            <>
          <p className="mb-4 text-sm font-bold text-black/45">
            Son {runs.length} çalışma kaydı
          </p>
          <div className="w-full max-w-full min-w-0 overflow-x-auto rounded-2xl border border-black/8 bg-white [-webkit-overflow-scrolling:touch]">
            <table className="w-full min-w-[1450px] text-left text-sm">
              <thead className="bg-[#fafaf8] text-xs uppercase tracking-wide text-black/45">
                <tr>
                  <th className="px-4 py-3">Kaynak</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3">Çalışma tipi</th>
                  <th className="px-4 py-3">Başlangıç</th>
                  <th className="px-4 py-3">Bitiş</th>
                  <th className="px-4 py-3 text-center">Toplam bulunan</th>
                  <th className="px-4 py-3 text-center">Yeni eklenen</th>
                  <th className="px-4 py-3 text-center">Güncellenen</th>
                  <th className="px-4 py-3 text-center">Pasif yapılan</th>
                  <th className="px-4 py-3 text-center">Tekrar aktif</th>
                  <th className="px-4 py-3 text-center">Atlanan</th>
                  <th className="px-4 py-3 text-center">Hatalı</th>
                  <th className="px-4 py-3">Hata mesajı</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-t border-black/7 align-top">
                    <td className="px-4 py-4">
                      <p className="font-black">{run.sourceName}</p>
                      <p className="mt-1 text-xs text-black/35">#{run.id}</p>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="px-4 py-4 font-bold">
                      {runTypeLabel(run.runType)}
                    </td>
                    <td className="px-4 py-4 text-black/55">
                      {run.startedAt ? formatDate(run.startedAt) : "Başlamadı"}
                    </td>
                    <td className="px-4 py-4 text-black/55">
                      {run.finishedAt ? formatDate(run.finishedAt) : "—"}
                    </td>
                    <CountCell value={run.foundCount} />
                    <CountCell value={run.importedCount} accent="green" />
                    <CountCell value={run.updatedCount} accent="blue" />
                    <CountCell value={run.inactiveCount} accent="amber" />
                    <CountCell value={run.reactivatedCount} accent="green" />
                    <CountCell value={run.skippedCount} accent="amber" />
                    <CountCell value={run.errorCount} accent="red" />
                    <td className="max-w-72 break-words px-4 py-4 text-xs leading-5 text-red-700">
                      {run.errorMessage ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
            </>
          ) : (
            <AdminEmpty>
              Henüz bot çalışma kaydı yok. Bot entegrasyonları çalıştıkça
              sonuçlar burada görünecek.
            </AdminEmpty>
          )}
        </>
      )}
    </>
  );
}

function BotMetricCard({
  icon: Icon,
  label,
  value,
  note,
  tone,
}: {
  icon: typeof Timer;
  label: string;
  value: string;
  note: string;
  tone: "green" | "orange" | "red";
}) {
  const tones = {
    green: "bg-green-100 text-green-700",
    orange: "bg-[#fff1e7] text-[#ff6b00]",
    red: "bg-red-100 text-red-700",
  };
  return (
    <section className="min-w-0 rounded-2xl border border-black/7 bg-white p-5 shadow-[0_12px_30px_rgba(0,0,0,0.035)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-bold text-black/45">{label}</p>
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-xl ${tones[tone]}`}
        >
          <Icon size={20} />
        </span>
      </div>
      <p className="mt-4 truncate text-2xl font-black tracking-[-0.035em]">
        {value}
      </p>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-black/45" title={note}>
        {note}
      </p>
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "completed" || status === "success"
      ? "bg-green-100 text-green-700"
      : status === "failed" || status === "error"
        ? "bg-red-100 text-red-700"
        : status === "running"
          ? "bg-blue-100 text-blue-700"
          : "bg-amber-100 text-amber-700";
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
  accent?: "green" | "blue" | "amber" | "red";
}) {
  const className =
    accent === "green"
      ? "text-green-700"
      : accent === "blue"
        ? "text-blue-700"
      : accent === "amber"
        ? "text-amber-700"
        : accent === "red"
          ? "text-red-700"
          : "";
  return (
    <td className={`px-4 py-4 text-center text-lg font-black ${className}`}>
      {value.toLocaleString("tr-TR")}
    </td>
  );
}

function statusLabel(status: string) {
  if (status === "completed" || status === "success") return "Tamamlandı";
  if (status === "failed" || status === "error") return "Başarısız";
  if (status === "running") return "Çalışıyor";
  if (status === "pending") return "Bekliyor";
  return status;
}

function runTypeLabel(runType: string) {
  if (runType === "test") return "Test çekimi";
  if (runType === "real_test") return "Gerçek test çekimi";
  if (runType === "manual") return "Manuel";
  if (runType === "scheduled") return "Zamanlanmış";
  if (runType === "webhook") return "Webhook";
  return runType;
}

function formatDate(value: string) {
  return formatDateTR(value, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDuration(milliseconds: number) {
  if (milliseconds < 1000) return `${Math.round(milliseconds)} ms`;
  if (milliseconds < 60_000) return `${(milliseconds / 1000).toFixed(1)} sn`;
  const minutes = Math.floor(milliseconds / 60_000);
  const seconds = Math.round((milliseconds % 60_000) / 1000);
  return `${minutes} dk ${seconds} sn`;
}
