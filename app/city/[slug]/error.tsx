"use client";

import { ErrorShell } from "@/components/error-shell";

export default function CityError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <ErrorShell
      title="Şehir sayfası yüklenemedi"
      message="Şehre ait ürünler yüklenirken bir hata oluştu. Lütfen tekrar deneyin."
      reset={reset}
    />
  );
}
