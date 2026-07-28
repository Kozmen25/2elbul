"use client";

import Link from "next/link";

export function ErrorShell({
  title = "Bir şeyler yanlış gitti",
  message = "Bu sayfayı yüklerken beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.",
  reset,
}: {
  title?: string;
  message?: string;
  reset?: () => void;
}) {
  return (
    <section className="min-h-[calc(100vh-145px)] bg-[#fafaf8]">
      <div className="container-shell flex flex-col items-center justify-center py-24 text-center">
        <div className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-red-50 text-3xl">
          ⚠️
        </div>
        <h1 className="mb-3 text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mb-8 max-w-md text-sm leading-relaxed text-black/60">
          {message}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {reset && (
            <button
              onClick={reset}
              className="orange-button rounded-xl px-6 py-2.5 text-sm font-semibold"
            >
              Tekrar Dene
            </button>
          )}
          <Link
            href="/"
            className="rounded-xl border border-black/12 bg-white px-6 py-2.5 text-sm font-semibold transition hover:border-black/25"
          >
            Ana Sayfa
          </Link>
        </div>
      </div>
    </section>
  );
}
