"use client";

import { useState, useTransition } from "react";
import { runPlaygroundAction, type PlaygroundResult } from "@/app/admin/ai/actions";

type MatcherSignals = {
  brand: string | null;
  model: string | null;
  storage: string | null;
  ram: string | null;
  color: string | null;
  category: string | null;
  normalizedKey: string;
};

type MatcherResult = {
  inputTitle: string;
  normalizedTitle: string;
  signals: MatcherSignals;
  productKey: string;
  matchedProduct: {
    id: string | number;
    name: string;
  } | null;
  wouldCreate: boolean;
  suggestedName: string;
};

type ApiResult =
  | {
      ok: true;
      result: MatcherResult;
    }
  | {
      ok: false;
      error: string;
    };

const examples = [
  "iPhone 15 Pro Max 256 GB",
  "Apple iPhone 15 Pro Max 256GB",
  "15 Pro Max 256",
  "Samsung S23 Ultra 256 GB",
  "Galaxy S23 Ultra 256GB",
];

export function ProductMatcherClient() {
  const [title, setTitle] = useState(examples[0]);
  const [result, setResult] = useState<MatcherResult | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [aiOpinion, setAiOpinion] = useState<PlaygroundResult | null>(null);
  const [aiPending, startAiTransition] = useTransition();

  // Second opinion from Gemini on the same title (suggestion only; nothing is written).
  function askAi() {
    setAiOpinion(null);
    startAiTransition(async () => setAiOpinion(await runPlaygroundAction("match", result?.inputTitle ?? title)));
  }

  function runTest(value = title) {
    const nextTitle = value.trim();
    setTitle(nextTitle);
    setError("");
    setResult(null);
    setAiOpinion(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/product-matcher-test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: nextTitle }),
        });
        const data = (await response.json().catch(() => null)) as ApiResult | null;
        if (!response.ok || !data?.ok) {
          setError(data && !data.ok ? data.error : "Eşleştirme testi çalışmadı.");
          return;
        }
        setResult(data.result);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Bilinmeyen istek hatası.",
        );
      }
    });
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border border-black/8 bg-white p-5 shadow-[0_12px_30px_rgba(0,0,0,0.035)] sm:p-6">
        <label>
          <span className="mb-2 block text-sm font-black">İlan başlığı gir</span>
          <textarea
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            rows={3}
            className="field min-h-24 px-4 py-3 text-sm font-semibold"
            placeholder="Örn. Apple iPhone 15 Pro Max 256GB"
          />
        </label>
        <button
          type="button"
          onClick={() => runTest()}
          disabled={isPending || !title.trim()}
          className="orange-button mt-4 w-full py-3 disabled:opacity-50 sm:w-auto"
        >
          {isPending ? "Test ediliyor..." : "Test Et"}
        </button>

        <div className="mt-5 flex flex-wrap gap-2">
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => runTest(example)}
              className="rounded-full border border-black/10 bg-[#fafaf8] px-3 py-2 text-xs font-bold text-black/55 hover:border-[#3B66E0]/30 hover:text-[#3B66E0]"
            >
              {example}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      {result && (
        <section className="grid gap-4 lg:grid-cols-2">
          <ResultCard label="Girilen başlık" value={result.inputTitle} />
          <ResultCard label="Normalize başlık" value={result.normalizedTitle} />
          <ResultCard label="Ürün anahtarı" value={result.productKey} />
          <ResultCard
            label="Eşleşme sonucu"
            value={
              result.matchedProduct
                ? `${result.matchedProduct.name} (#${result.matchedProduct.id})`
                : `Yeni ürün oluşturulacak: ${result.suggestedName}`
            }
            accent={!result.matchedProduct}
          />

          <div className="rounded-2xl border border-black/8 bg-white p-5 shadow-[0_12px_30px_rgba(0,0,0,0.035)] lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black tracking-[-0.025em]">AI görüşü</h2>
                <p className="mt-1 text-sm text-black/50">
                  Gemini bu başlığı mevcut ürünlerle karşılaştırır. Yalnızca öneridir, kayıt değiştirmez.
                </p>
              </div>
              <button
                type="button"
                onClick={askAi}
                disabled={aiPending}
                className="rounded-xl border border-black/12 px-5 py-3 text-sm font-bold transition hover:border-[#3B66E0]/40 disabled:opacity-50"
              >
                {aiPending ? "AI düşünüyor..." : "AI görüşü al"}
              </button>
            </div>
            {aiOpinion && !aiOpinion.ok && (
              <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{aiOpinion.message}</p>
            )}
            {aiOpinion?.ok && aiOpinion.kind === "match" && (
              <div className="mt-3 rounded-xl bg-[#fafaf8] p-4 text-sm">
                <p className="font-black">
                  {aiOpinion.matchedName ? `Eşleşme: ${aiOpinion.matchedName}` : "Mevcut ürünlerin hiçbiri uymuyor"}{" "}
                  <span className="font-semibold text-black/45">(güven %{Math.round(aiOpinion.judgement.confidence * 100)})</span>
                </p>
                {aiOpinion.judgement.reason && <p className="mt-1 text-black/60">{aiOpinion.judgement.reason}</p>}
                {result.wouldCreate && aiOpinion.matchedName && (
                  <p className="mt-2 text-xs font-bold text-amber-700">
                    Kural tabanlı eşleştirici yeni ürün oluşturacaktı; AI mevcut bir ürünle eşleşme görüyor. Olası yinelenen ürün.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-black/8 bg-white p-5 shadow-[0_12px_30px_rgba(0,0,0,0.035)] lg:col-span-2">
            <h2 className="text-lg font-black tracking-[-0.025em]">
              Extract Product Signals
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(result.signals).map(([key, value]) => (
                <div key={key} className="rounded-xl bg-[#fafaf8] p-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.12em] text-black/35">
                    {key}
                  </p>
                  <p className="mt-1 break-words text-sm font-bold">
                    {value ?? "-"}
                  </p>
                </div>
              ))}
            </div>
            <pre className="mt-4 max-h-[360px] overflow-auto rounded-xl bg-black p-4 text-xs leading-5 text-white">
              {JSON.stringify(result.signals, null, 2)}
            </pre>
          </div>
        </section>
      )}
    </div>
  );
}

function ResultCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-[0_12px_30px_rgba(0,0,0,0.035)] ${
        accent ? "border-[#3B66E0]/20 bg-[#EEF3FF]" : "border-black/8 bg-white"
      }`}
    >
      <p className="text-xs font-black uppercase tracking-[0.12em] text-black/40">
        {label}
      </p>
      <p className="mt-2 break-words text-lg font-black tracking-[-0.02em]">
        {value}
      </p>
    </div>
  );
}
