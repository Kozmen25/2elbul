"use client";

import { ArrowRight, Check, Scale, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCompare } from "@/components/compare-context";

export function CompareBar() {
  const router = useRouter();
  const { selection, hasSelection, isFull, compareUrl, removeFromSelection, clearSelection } =
    useCompare();

  if (!hasSelection) return null;

  function handleCompare() {
    if (!compareUrl) return;
    router.push(compareUrl);
  }

  return (
    <div className="sticky bottom-0 z-40 border-t border-black/10 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="container-shell min-w-0 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#fff1e7] text-[#ff6b00]">
              <Scale size={18} />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.08em] text-black/45">
                Karşılaştırma
              </p>
              <p className="truncate text-sm font-black leading-5">
                {selection.length}/2 ilan seçildi
              </p>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {selection.map((entry, index) => (
              <div
                key={entry.listingId}
                className="flex min-w-0 items-center gap-2 rounded-full border border-black/10 bg-[#fafaf8] px-3 py-1.5 text-xs font-bold text-black/70"
              >
                <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[#ff6b00] text-white">
                  <Check size={12} />
                </span>
                <span className="max-w-[12rem] truncate" title={entry.productName}>
                  {index + 1}. {entry.productName}
                </span>
                <button
                  type="button"
                  onClick={() => removeFromSelection(entry.listingId)}
                  aria-label={`${entry.productName} seçimini kaldır`}
                  className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-black/40 transition hover:bg-black/5 hover:text-black/70"
                >
                  <X size={13} />
                </button>
              </div>
            ))}

            {selection.length < 2
              ? Array.from({ length: 2 - selection.length }, (_, index) => (
                  <span
                    key={`empty-${index}`}
                    className="inline-flex items-center gap-2 rounded-full border border-dashed border-black/15 bg-transparent px-3 py-1.5 text-xs font-semibold text-black/35"
                  >
                    <Scale size={13} /> {selection.length + index + 1}. ilan
                  </span>
                ))
              : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={clearSelection}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-bold text-black/60 transition hover:border-black/20 hover:text-black/80"
            >
              Temizle
            </button>
            <button
              type="button"
              onClick={handleCompare}
              disabled={!isFull}
              className="orange-button justify-center px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              Karşılaştır
              <ArrowRight size={16} />
            </button>
          </div>
        </div>

        {!isFull ? (
          <p className="mt-2 text-xs font-semibold text-black/45">
            Karşılaştırmak için bir ilan daha seç. Üçüncü ilan eklersen en eski
            seçim otomatik kalkar.
          </p>
        ) : null}
      </div>
    </div>
  );
}
