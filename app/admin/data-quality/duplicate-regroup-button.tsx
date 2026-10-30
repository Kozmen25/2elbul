"use client";

import { useState, useTransition } from "react";
import { regroupDuplicatesAction, type RegroupActionResult } from "./actions";

export function DuplicateRegroupButton({
  groupCount,
  groupedListings,
}: {
  groupCount: number;
  groupedListings: number;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<RegroupActionResult | null>(null);

  function run() {
    setResult(null);
    startTransition(async () => setResult(await regroupDuplicatesAction()));
  }

  return (
    <div className="rounded-2xl border border-[#3B66E0]/15 bg-[#EEF3FF] p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-black tracking-[-0.025em]">Duplicate ilan grupları</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-black/55">
            Aynı eşyanın farklı platformlardaki ilanları tek grupta toplanır; sitede bir kez gösterilir ve bir kez
            sayılır. Şu an <strong>{groupCount.toLocaleString("tr-TR")}</strong> grup ve{" "}
            <strong>{groupedListings.toLocaleString("tr-TR")}</strong> gruplanmış ilan var. Kaynak taramaları ve içe
            aktarmalar ilgili ürünleri otomatik günceller; her gün de tüm ürünler yeniden kontrol edilir.
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="orange-button whitespace-nowrap px-5 py-3 disabled:opacity-50"
        >
          {pending ? "Hesaplanıyor..." : "Grupları yeniden hesapla"}
        </button>
      </div>

      {result ? (
        <p
          role="status"
          className={`mt-4 rounded-xl border p-3 text-sm font-bold ${
            result.ok ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {result.ok
            ? `${result.result.products} ürün tarandı: ${result.result.groups} grup, ${result.result.groupedListings} gruplanmış ilan, ${result.result.changed} kayıt güncellendi.`
            : result.message}
        </p>
      ) : null}
    </div>
  );
}
