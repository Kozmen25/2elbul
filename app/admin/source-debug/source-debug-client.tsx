"use client";

import { useState, useTransition } from "react";

type SourceDebugRow = {
  id: number;
  name: string;
  slug: string;
  isActive: boolean;
  integrationType: string;
  cronEnabled: boolean;
  lastRunAt: string | null;
  lastSuccess: string | null;
  totalImported: number;
  latestStatus: string | null;
  latestFound: number;
  latestImported: number;
  latestUpdated: number;
  latestSkipped: number;
  latestErrors: number;
  latestErrorMessage: string | null;
};

type RunResult = {
  ok?: boolean;
  error?: string;
  results?: Array<{
    sourceId: number;
    sourceName: string;
    status: string;
    found: number;
    imported: number;
    updated: number;
    inactive: number;
    reactivated: number;
    skipped: number;
    matchedProducts: number;
    errorCount: number;
    errorMessage: string | null;
    durationMs: number;
  }>;
  diagnostics?: Array<{
    sourceId: number;
    sourceName: string;
    status: string;
    title: string;
    action: string;
  }>;
};

export function SourceDebugClient({ sources }: { sources: SourceDebugRow[] }) {
  const [pendingSourceId, setPendingSourceId] = useState<number | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function runDebug(sourceId: number) {
    setPendingSourceId(sourceId);
    setResult(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/source-debug/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceId, limit: 10 }),
        });
        setResult((await response.json().catch(() => null)) ?? {
          ok: false,
          error: "JSON cevabı alınamadı.",
        });
      } catch (error) {
        setResult({
          ok: false,
          error: error instanceof Error ? error.message : "Bilinmeyen hata",
        });
      } finally {
        setPendingSourceId(null);
      }
    });
  }

  return (
    <div className="grid gap-5">
      {result && (
        <div className={`rounded-2xl border p-4 text-sm font-bold ${result.ok ? "border-green-200 bg-green-50 text-green-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
          {result.error ? result.error : result.results?.map((item) => `${item.sourceName}: ${item.found} bulundu, ${item.imported} yeni, ${item.updated} güncellendi, ${item.errorCount} hata`).join(" | ")}
          {result.diagnostics?.map((item) => (
            <p key={item.sourceId} className="mt-2 font-semibold">
              Tanı: {item.title} — {item.action}
            </p>
          ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-black/8 bg-white">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="bg-[#fafaf8] text-xs uppercase tracking-wide text-black/45">
            <tr>
              <th className="px-4 py-3">Kaynak</th>
              <th className="px-4 py-3">Tip</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Son Akış</th>
              <th className="px-4 py-3">Bulunan</th>
              <th className="px-4 py-3">Yeni</th>
              <th className="px-4 py-3">Güncel</th>
              <th className="px-4 py-3">Hata</th>
              <th className="px-4 py-3">Son Hata</th>
              <th className="px-4 py-3 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr key={source.id} className="border-t border-black/7">
                <td className="px-4 py-4">
                  <p className="font-black">{source.name}</p>
                  <p className="font-mono text-xs text-black/40">{source.slug}</p>
                </td>
                <td className="px-4 py-4">{source.integrationType}</td>
                <td className="px-4 py-4">{source.cronEnabled ? "Açık" : "Kapalı"}</td>
                <td className="px-4 py-4">{source.latestStatus ?? "Yok"}</td>
                <td className="px-4 py-4 font-black">{source.latestFound}</td>
                <td className="px-4 py-4 font-black text-green-700">{source.latestImported}</td>
                <td className="px-4 py-4 font-black text-blue-700">{source.latestUpdated}</td>
                <td className="px-4 py-4 font-black text-red-700">{source.latestErrors}</td>
                <td className="max-w-[260px] px-4 py-4 text-xs text-black/55">
                  {source.latestErrorMessage ? source.latestErrorMessage.slice(0, 180) : "-"}
                </td>
                <td className="px-4 py-4 text-right">
                  <button
                    type="button"
                    disabled={isPending || pendingSourceId === source.id || !source.isActive}
                    onClick={() => runDebug(source.id)}
                    className="rounded-xl bg-[#ff6b00] px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                  >
                    {pendingSourceId === source.id ? "Çalışıyor" : "Test çek"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
