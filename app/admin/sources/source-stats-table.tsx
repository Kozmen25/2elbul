import { formatDateTR } from "@/lib/formatters";
import type { SourceStatsResult, SourceStatsRow } from "@/lib/source-stats";

const number = (value: number) => value.toLocaleString("tr-TR");

const formatRunTime = (value: string) =>
  formatDateTR(value, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function RunBadge({ row }: { row: SourceStatsRow }) {
  if (!row.lastRun) return <span className="text-xs font-semibold text-black/35">Hiç çalışmadı</span>;
  const failed = row.lastRun.status === "failed" || row.lastRun.status === "error";
  return (
    <div>
      <span
        className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-black ${
          failed ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"
        }`}
      >
        {failed ? "Hatalı" : "Başarılı"}
      </span>
      <p className="mt-1 text-[11px] font-semibold text-black/45">{formatRunTime(row.lastRun.at)}</p>
    </div>
  );
}

/** Which source brought how many listings, and how its scrape runs went. */
export function SourceStatsTable({ stats }: { stats: SourceStatsResult }) {
  const total = stats.rows.reduce((sum, row) => sum + row.liveListings, 0);

  return (
    <section className="mb-6 rounded-2xl border border-black/8 bg-white p-5 shadow-[0_12px_30px_rgba(0,0,0,0.035)] sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#3B66E0]">Kaynak performansı</p>
          <h2 className="mt-1 text-2xl font-black tracking-[-0.035em]">Hangi kaynaktan kaç ilan geliyor</h2>
        </div>
        <p className="text-sm font-bold text-black/50">Yayındaki toplam: {number(total)} ilan</p>
      </div>

      {stats.partial ? (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
          Sayılar son {number(stats.scannedListings)} ilana göre; ilan sayısı bu sınırı aştığı için kısmi olabilir.
        </p>
      ) : null}

      <div className="mt-5 overflow-x-auto rounded-xl border border-black/8">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-[#fafaf8] text-xs uppercase tracking-wide text-black/45">
            <tr>
              <th className="px-4 py-3">Kaynak</th>
              <th className="px-4 py-3 text-right">Yayında</th>
              <th className="px-4 py-3 text-right">Bekleyen</th>
              <th className="px-4 py-3 text-right">Pasif</th>
              <th className="px-4 py-3 text-right">Son 24 saat</th>
              <th className="px-4 py-3 text-right">Son 7 gün</th>
              <th className="px-4 py-3">Son tarama</th>
              <th className="px-4 py-3 text-right">7 günde (bulunan / alınan / hata)</th>
            </tr>
          </thead>
          <tbody>
            {stats.rows.map((row) => (
              <tr key={row.source} className="border-t border-black/7">
                <td className="px-4 py-3">
                  <p className="font-black">{row.source}</p>
                  <p className="text-[11px] font-semibold text-black/40">
                    {row.sourceId === null ? "Kayıtlı kaynak değil" : row.isActive ? "Aktif" : "Kapalı"}
                  </p>
                </td>
                <td className="px-4 py-3 text-right font-black text-[#3B66E0]">{number(row.liveListings)}</td>
                <td className="px-4 py-3 text-right">{number(row.pendingListings)}</td>
                <td className="px-4 py-3 text-right">{number(row.inactiveListings)}</td>
                <td className="px-4 py-3 text-right">{number(row.addedLast24h)}</td>
                <td className="px-4 py-3 text-right">{number(row.addedLast7d)}</td>
                <td className="px-4 py-3">
                  <RunBadge row={row} />
                </td>
                <td className="px-4 py-3 text-right font-semibold text-black/60">
                  {row.runs7d.runs === 0
                    ? "—"
                    : `${number(row.runs7d.found)} / ${number(row.runs7d.imported)} / ${number(row.runs7d.errors)}`}
                  {row.runs7d.failedRuns > 0 ? (
                    <span className="ml-2 text-[11px] font-black text-red-600">{row.runs7d.failedRuns} hatalı çalışma</span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
