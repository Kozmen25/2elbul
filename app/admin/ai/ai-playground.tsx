"use client";

import { useState, useTransition } from "react";
import { runPlaygroundAction, type PlaygroundKind, type PlaygroundResult } from "./actions";

const TABS: { id: PlaygroundKind; label: string; placeholder: string }[] = [
  { id: "classify", label: "Ürün tanıma", placeholder: "Sıfır ayarında iPhone 13 128GB mavi kutulu" },
  { id: "search", label: "Arama yorumu", placeholder: "oyun oynamak için 30 bin altı güçlü bir laptop" },
  { id: "match", label: "Ürün eşleştirme", placeholder: "Apple iPhone 13 128 GB Mavi" },
];

const PERCENT = 100;
const percent = (value: number) => `%${Math.round(value * PERCENT)}`;

export function AiPlayground() {
  const [kind, setKind] = useState<PlaygroundKind>("classify");
  const [text, setText] = useState(TABS[0].placeholder);
  const [result, setResult] = useState<PlaygroundResult | null>(null);
  const [pending, startTransition] = useTransition();

  function selectTab(next: PlaygroundKind) {
    setKind(next);
    setText(TABS.find((tab) => tab.id === next)?.placeholder ?? "");
    setResult(null);
  }

  function run() {
    setResult(null);
    startTransition(async () => setResult(await runPlaygroundAction(kind, text)));
  }

  return (
    <section className="rounded-2xl border border-black/7 bg-white p-5 sm:p-6">
      <h2 className="text-lg font-black">Deneme alanı</h2>
      <p className="mt-2 text-sm leading-6 text-black/50">
        Her özelliği örnek bir metinle deneyin. Her deneme bir istek sayılır ve kayıtlara düşer.
      </p>

      <div role="tablist" className="mt-4 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={kind === tab.id}
            onClick={() => selectTab(tab.id)}
            className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${
              kind === tab.id ? "border-[#3B66E0] bg-[#EEF3FF] text-[#2A4FBF]" : "border-black/10 hover:border-black/30"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          className="field min-w-0 flex-1 px-3 py-3"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !pending) run();
          }}
          maxLength={300}
          disabled={pending}
        />
        <button type="button" onClick={run} disabled={pending || !text.trim()} className="orange-button px-6 py-3 disabled:opacity-50">
          {pending ? "Soruluyor..." : "Çalıştır"}
        </button>
      </div>

      {result && (
        <div
          className={`mt-4 rounded-xl border p-4 text-sm ${
            result.ok ? "border-black/10 bg-[#fafaf8]" : "border-red-200 bg-red-50 font-bold text-red-700"
          }`}
        >
          {!result.ok && <p>{result.message}</p>}
          {result.ok && result.kind === "classify" && (
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              <Row label="Kategori" value={result.categoryLabel ?? "Uygun kategori yok"} />
              <Row label="Güven" value={percent(result.classification.confidence)} />
              <Row label="Marka" value={result.classification.brand ?? "—"} />
              <Row label="Model" value={result.classification.model ?? "—"} />
              <Row label="Ürün türü" value={result.classification.kind} />
              <Row label="Standart ad" value={result.classification.canonicalName ?? "—"} />
            </dl>
          )}
          {result.ok && result.kind === "search" && (
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              <Row label="Ürün araması mı" value={result.interpretation.isShoppingQuery ? "Evet" : "Hayır"} />
              <Row label="Güven" value={percent(result.interpretation.confidence)} />
              <Row label="En düşük fiyat" value={result.interpretation.priceMin?.toLocaleString("tr-TR") ?? "—"} />
              <Row label="En yüksek fiyat" value={result.interpretation.priceMax?.toLocaleString("tr-TR") ?? "—"} />
              <Row label="Sıralama" value={result.interpretation.sort ?? "—"} />
              <Row label="Hariç tutulan" value={result.interpretation.exclusions.join(", ") || "—"} />
              <Row label="Anahtar kelimeler" value={result.interpretation.keywords.join(", ") || "—"} />
            </dl>
          )}
          {result.ok && result.kind === "match" && (
            <div className="grid gap-2">
              <Row label="Eşleşen ürün" value={result.matchedName ?? "Hiçbiri uymuyor"} />
              <Row label="Güven" value={percent(result.judgement.confidence)} />
              <Row label="Gerekçe" value={result.judgement.reason || "—"} />
              <Row label="Karşılaştırılan adaylar" value={result.candidates.join(" · ") || "Aday bulunamadı"} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-bold uppercase tracking-wide text-black/40">{label}</dt>
      <dd className="mt-0.5 break-words font-semibold">{value}</dd>
    </div>
  );
}
