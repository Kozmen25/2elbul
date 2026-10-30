"use client";

import { useState, useTransition } from "react";
import { applySuggestionAction, reviewFallbackProductsAction, type ReviewActionResult } from "./actions";

const PERCENT = 100;

type Props = {
  /** Products currently in the fallback category. */
  fallbackCount: number;
  batchSize: number;
};

export function FallbackReview({ fallbackCount, batchSize }: Props) {
  const [review, setReview] = useState<ReviewActionResult | null>(null);
  const [applied, setApplied] = useState<Record<number, string>>({});
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [pending, startTransition] = useTransition();
  const [applyingId, setApplyingId] = useState<number | null>(null);

  function runReview() {
    setReview(null);
    startTransition(async () => setReview(await reviewFallbackProductsAction()));
  }

  function apply(productId: number, slug: string) {
    setApplyingId(productId);
    setErrors((current) => ({ ...current, [productId]: "" }));
    startTransition(async () => {
      const result = await applySuggestionAction(productId, slug);
      if (result.ok) setApplied((current) => ({ ...current, [productId]: result.message }));
      else setErrors((current) => ({ ...current, [productId]: result.message }));
      setApplyingId(null);
    });
  }

  return (
    <section className="rounded-2xl border border-black/7 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black">&quot;Diğer&quot; kategorisini düzenle</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-black/50">
            Kurallarla yerleştirilemeyen {fallbackCount.toLocaleString("tr-TR")} ürün &quot;Diğer&quot; kategorisinde.
            AI her seferinde {batchSize} ürüne en uygun kategoriyi önerir; siz onaylamadan hiçbir ürün taşınmaz.
          </p>
        </div>
        <button type="button" onClick={runReview} disabled={pending || fallbackCount === 0} className="orange-button px-5 py-3 text-sm disabled:opacity-50">
          {pending && applyingId === null ? "AI düşünüyor..." : "Önerileri getir"}
        </button>
      </div>

      {review && !review.ok && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{review.message}</p>
      )}

      {review?.ok && (
        <div className="mt-4">
          {review.stoppedReason && (
            <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
              Çalışma yarıda kesildi: {review.stoppedReason}
            </p>
          )}
          {review.suggestions.length === 0 ? (
            <p className="rounded-xl bg-[#fafaf8] p-4 text-sm text-black/55">
              {review.reviewed} üründen hiçbirine yeterli güvenle kategori önerilemedi.
            </p>
          ) : (
            <ul className="divide-y divide-black/8 rounded-xl border border-black/8">
              {review.suggestions.map((suggestion) => (
                <li key={suggestion.productId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{suggestion.productName}</p>
                    <p className="text-xs text-black/50">
                      → <span className="font-bold text-[#2A4FBF]">{suggestion.categoryLabel}</span> · güven %
                      {Math.round(suggestion.confidence * PERCENT)}
                    </p>
                    {errors[suggestion.productId] && (
                      <p className="mt-1 text-xs font-semibold text-red-600">{errors[suggestion.productId]}</p>
                    )}
                  </div>
                  {applied[suggestion.productId] ? (
                    <span className="text-sm font-bold text-green-700">{applied[suggestion.productId]}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => apply(suggestion.productId, suggestion.categorySlug)}
                      disabled={pending}
                      className="rounded-xl border border-black/12 px-4 py-2 text-sm font-bold transition hover:border-[#3B66E0]/40 disabled:opacity-50"
                    >
                      {applyingId === suggestion.productId ? "Taşınıyor..." : "Uygula"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {review.unplaced.length > 0 && (
            <p className="mt-3 text-xs leading-5 text-black/45">
              Yerleştirilemeyenler (güven düşük): {review.unplaced.join(", ")}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
