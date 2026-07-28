"use client";

import { ErrorShell } from "@/components/error-shell";

export default function CategoryError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <ErrorShell
      title="Kategori sayfası yüklenemedi"
      message="Kategoriye ait ürünler yüklenirken bir hata oluştu. Lütfen tekrar deneyin."
      reset={reset}
    />
  );
}
