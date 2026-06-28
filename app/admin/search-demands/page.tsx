import { Search } from "lucide-react";
import { AdminEmpty, AdminPageHeader } from "@/components/admin-ui";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type SearchDemand = {
  id: string;
  query: string;
  normalizedQuery: string;
  resultCount: number;
  status: string;
  requestedAt: string;
  lastProcessedAt: string | null;
  processCount: number;
  errorMessage: string | null;
};

type QueueSummary = {
  status: string;
  count: number;
};

export default async function AdminSearchDemandsPage() {
  const supabase = createSupabaseAdminClient();
  const [demandsResult, queueResult] = supabase
    ? await Promise.all([
        supabase
          .from("search_demands")
          .select(
            "id, query, normalized_query, result_count, status, requested_at, last_processed_at, process_count, error_message",
          )
          .order("requested_at", { ascending: false })
          .limit(200),
        supabase.from("bot_queue").select("status"),
      ])
    : [null, null];

  if (demandsResult?.error) {
    console.error("Admin search demands query failed:", demandsResult.error);
  }
  if (queueResult?.error) {
    console.error("Admin bot queue summary query failed:", queueResult.error);
  }

  const demands: SearchDemand[] = (demandsResult?.data ?? []).map((demand) => ({
    id: String(demand.id),
    query: String(demand.query),
    normalizedQuery: String(demand.normalized_query),
    resultCount: Number(demand.result_count ?? 0),
    status: String(demand.status),
    requestedAt: String(demand.requested_at),
    lastProcessedAt: demand.last_processed_at
      ? String(demand.last_processed_at)
      : null,
    processCount: Number(demand.process_count ?? 0),
    errorMessage: demand.error_message ? String(demand.error_message) : null,
  }));

  const queueSummary = summarizeQueue(
    (queueResult?.data ?? []).map((item) => String(item.status)),
  );

  return (
    <>
      <AdminPageHeader
        eyebrow="Arama tetiklemeli bot"
        title="Arama Talepleri"
        description="Sitede az sonuç dönen kullanıcı aramalarını ve bu aramalardan oluşan bot kuyruğunu takip edin."
        action={
          <span className="grid size-12 place-items-center rounded-2xl bg-[#fff1e7] text-[#ff6b00]">
            <Search size={24} />
          </span>
        }
      />

      {!supabase || demandsResult?.error ? (
        <AdminEmpty>
          Arama talebi tablosu okunamadı. Önce
          `supabase/search-demand-queue.sql` dosyasını çalıştırın.
        </AdminEmpty>
      ) : (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {queueSummary.map((item) => (
              <div
                key={item.status}
                className="rounded-2xl border border-black/7 bg-white p-4 shadow-[0_12px_30px_rgba(0,0,0,0.035)]"
              >
                <p className="text-xs font-black uppercase tracking-[0.12em] text-black/40">
                  {statusLabel(item.status)}
                </p>
                <p className="mt-2 text-3xl font-black">{item.count}</p>
              </div>
            ))}
          </div>

          {demands.length ? (
            <div className="w-full max-w-full min-w-0 overflow-x-auto rounded-2xl border border-black/8 bg-white [-webkit-overflow-scrolling:touch]">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="bg-[#fafaf8] text-xs uppercase tracking-wide text-black/45">
                  <tr>
                    <th className="px-4 py-3">Arama</th>
                    <th className="px-4 py-3">Normalize</th>
                    <th className="px-4 py-3">Sonuç</th>
                    <th className="px-4 py-3">Durum</th>
                    <th className="px-4 py-3">İşlenme</th>
                    <th className="px-4 py-3">Talep zamanı</th>
                    <th className="px-4 py-3">Son işlem</th>
                    <th className="px-4 py-3">Hata</th>
                  </tr>
                </thead>
                <tbody>
                  {demands.map((demand) => (
                    <tr key={demand.id} className="border-t border-black/7 align-top">
                      <td className="px-4 py-4 font-black">{demand.query}</td>
                      <td className="px-4 py-4 text-black/55">
                        {demand.normalizedQuery}
                      </td>
                      <td className="px-4 py-4 font-black">
                        {demand.resultCount}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={demand.status} />
                      </td>
                      <td className="px-4 py-4">{demand.processCount}</td>
                      <td className="px-4 py-4 text-black/55">
                        {formatDate(demand.requestedAt)}
                      </td>
                      <td className="px-4 py-4 text-black/55">
                        {demand.lastProcessedAt
                          ? formatDate(demand.lastProcessedAt)
                          : "Henüz işlenmedi"}
                      </td>
                      <td className="max-w-72 break-words px-4 py-4 text-xs text-red-700">
                        {demand.errorMessage ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <AdminEmpty>Henüz arama talebi oluşmadı.</AdminEmpty>
          )}
        </>
      )}
    </>
  );
}

function summarizeQueue(statuses: string[]): QueueSummary[] {
  const wanted = ["pending", "processing", "completed", "failed", "skipped"];
  return wanted.map((status) => ({
    status,
    count: statuses.filter((item) => item === status).length,
  }));
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "completed"
      ? "bg-green-100 text-green-700"
      : status === "failed"
        ? "bg-red-100 text-red-700"
        : status === "processing"
          ? "bg-blue-100 text-blue-700"
          : status === "ignored"
            ? "bg-black/7 text-black/45"
            : "bg-amber-100 text-amber-700";

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${className}`}>
      {statusLabel(status)}
    </span>
  );
}

function statusLabel(status: string) {
  if (status === "pending") return "Bekliyor";
  if (status === "queued") return "Kuyrukta";
  if (status === "processing") return "İşleniyor";
  if (status === "completed") return "Tamamlandı";
  if (status === "failed") return "Hatalı";
  if (status === "ignored") return "Yok sayıldı";
  if (status === "skipped") return "Atlandı";
  return status;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
