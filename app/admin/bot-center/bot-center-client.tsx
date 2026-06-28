"use client";

import { useState, useTransition } from "react";

type BotTask = "search_queue" | "sources" | "price_alerts" | "daily";

type TaskResult = {
  ok: boolean;
  task?: string;
  status?: number;
  data?: unknown;
  error?: string;
};

const TASKS: {
  task: BotTask;
  title: string;
  description: string;
}[] = [
  {
    task: "search_queue",
    title: "Arama Kuyruğunu Çalıştır",
    description: "Az sonuçlu aramalardan oluşan bot_queue kayıtlarını işler.",
  },
  {
    task: "sources",
    title: "Kaynak Senkronizasyonunu Çalıştır",
    description: "Aktif kaynakların planlı veri çekimini başlatır.",
  },
  {
    task: "price_alerts",
    title: "Fiyat Alarmlarını Kontrol Et",
    description: "Aktif fiyat alarmlarını güncel ilan fiyatlarına göre kontrol eder.",
  },
  {
    task: "daily",
    title: "Günlük Cron'u Çalıştır",
    description: "Günlük cron içinde tanımlı tüm bot görevlerini sırayla tetikler.",
  },
];

export function BotCenterClient() {
  const [pendingTask, setPendingTask] = useState<BotTask | null>(null);
  const [result, setResult] = useState<TaskResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function runTask(task: BotTask) {
    setPendingTask(task);
    setResult(null);
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
        setResult(
          data ?? {
            ok: false,
            error: "Bot görevi JSON cevabı döndürmedi.",
          },
        );
      } catch (error) {
        setResult({
          ok: false,
          error: error instanceof Error ? error.message : "Bilinmeyen hata",
        });
      } finally {
        setPendingTask(null);
      }
    });
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        {TASKS.map((item) => (
          <div
            key={item.task}
            className="rounded-2xl border border-black/8 bg-white p-5 shadow-[0_12px_30px_rgba(0,0,0,0.035)]"
          >
            <h2 className="text-lg font-black tracking-[-0.025em]">
              {item.title}
            </h2>
            <p className="mt-2 min-h-12 text-sm leading-6 text-black/50">
              {item.description}
            </p>
            <button
              type="button"
              onClick={() => runTask(item.task)}
              disabled={isPending}
              className="orange-button mt-5 w-full py-3 disabled:opacity-50"
            >
              {pendingTask === item.task ? "Çalıştırılıyor..." : "Çalıştır"}
            </button>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-black/8 bg-white p-5 shadow-[0_12px_30px_rgba(0,0,0,0.035)]">
        <h2 className="text-lg font-black tracking-[-0.025em]">Sonuç</h2>
        {!result ? (
          <p className="mt-3 text-sm text-black/45">
            Henüz bir bot görevi çalıştırılmadı.
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
              {result.ok ? "Bot görevi başarıyla tamamlandı." : "Bot görevi hata verdi."}
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
