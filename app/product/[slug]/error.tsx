"use client";

import { ErrorShell } from "@/components/error-shell";

export default function ProductError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <ErrorShell
      title="Ürün detayı yüklenemedi"
      message="Ürün bilgileri alınırken bir hata oluştu. Lütfen tekrar deneyin."
      reset={reset}
    />
  );
}
