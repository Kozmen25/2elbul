"use client";

import { ErrorShell } from "@/components/error-shell";

export default function CategoriesError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <ErrorShell
      title="Kategoriler yüklenemedi"
      message="Kategori listesi yüklenirken bir hata oluştu. Lütfen tekrar deneyin."
      reset={reset}
    />
  );
}
