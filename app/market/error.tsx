"use client";

import { ErrorShell } from "@/components/error-shell";

export default function MarketError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <ErrorShell
      title="Pazar verileri yüklenemedi"
      message="Pazar istihbaratı verilerini alırken bir hata oluştu. Lütfen tekrar deneyin."
      reset={reset}
    />
  );
}
