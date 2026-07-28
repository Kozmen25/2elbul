"use client";

import { ErrorShell } from "@/components/error-shell";

export default function SearchError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <ErrorShell
      title="Arama sonuçları yüklenemedi"
      message="Arama sonuçlarını getirirken bir hata oluştu. Lütfen tekrar deneyin."
      reset={reset}
    />
  );
}
