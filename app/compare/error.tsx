"use client";

import { ErrorShell } from "@/components/error-shell";

export default function CompareError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <ErrorShell
      title="Karşılaştırma yüklenemedi"
      message="Ürün karşılaştırma sayfası yüklenirken bir hata oluştu. Lütfen tekrar deneyin."
      reset={reset}
    />
  );
}
