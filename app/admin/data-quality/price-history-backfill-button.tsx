"use client";

import { useState, useTransition } from "react";

type BackfillResponse = {
  ok?: boolean;
  limit?: number;
  scanned?: number;
  inserted?: number;
  skipped?: number;
  errors?: number;
  error?: string;
  errorMessages?: string[];
};

export function PriceHistoryBackfillButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<BackfillResponse | null>(null);

  function runBackfill() {
    setResult(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/price-history/backfill", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ limit: 100 }),
        });
        const data = (await response.json().catch(() => null)) as
          | BackfillResponse
          | null;
        setResult(
          data ?? {
            ok: false,
            error: "Backfill JSON cevabi dondurmedi.",
          },
        );
      } catch (error) {
        setResult({
          ok: false,
          error: error instanceof Error ? error.message : "Bilinmeyen hata",
        });
      }
    });
  }

  return (
    <div className="rounded-2xl border border-[#ff6b00]/15 bg-[#fff7ef] p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-black tracking-[-0.025em]">
            Price History Backfill
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-black/55">
            Published/active ilanlardan ilk fiyat gecmisi kaydini guvenli sekilde
            olusturur. Ayni listing, ayni gun ve ayni fiyat tekrar yazilmaz.
          </p>
        </div>
        <button
          type="button"
          onClick={runBackfill}
          disabled={isPending}
          className="orange-button whitespace-nowrap px-5 py-3 disabled:opacity-50"
        >
          {isPending ? "Calistiriliyor..." : "Price History Backfill Calistir"}
        </button>
      </div>

      {result && (
        <div
          className={`mt-4 rounded-xl border p-4 text-sm ${
            result.ok
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          <p className="font-black">
            {result.ok
              ? "Backfill tamamlandi."
              : "Backfill tamamlanamadi."}
          </p>
          <dl className="mt-3 grid gap-2 sm:grid-cols-4">
            <BackfillMetric label="Taranan" value={result.scanned} />
            <BackfillMetric label="Yazilan" value={result.inserted} />
            <BackfillMetric label="Atlanan" value={result.skipped} />
            <BackfillMetric label="Hata" value={result.errors} />
          </dl>
          {(result.error || result.errorMessages?.length) && (
            <pre className="mt-3 max-h-44 overflow-auto rounded-lg bg-white/70 p-3 text-xs leading-5 text-black">
              {JSON.stringify(
                {
                  error: result.error,
                  errorMessages: result.errorMessages,
                },
                null,
                2,
              )}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function BackfillMetric({
  label,
  value,
}: {
  label: string;
  value: number | undefined;
}) {
  return (
    <div>
      <dt className="text-xs font-bold opacity-70">{label}</dt>
      <dd className="text-xl font-black">{Number(value ?? 0).toLocaleString("tr-TR")}</dd>
    </div>
  );
}
