"use client";

import { ErrorShell } from "@/components/error-shell";

export default function BrandError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <ErrorShell
      title="Marka sayfası yüklenemedi"
      message="Markaya ait ürünler yüklenirken bir hata oluştu. Lütfen tekrar deneyin."
      reset={reset}
    />
  );
}
