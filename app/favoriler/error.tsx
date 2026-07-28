"use client";

import { ErrorShell } from "@/components/error-shell";

export default function FavoritesError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <ErrorShell
      title="Favoriler yüklenemedi"
      message="Favori ürünleriniz yüklenirken bir hata oluştu. Lütfen tekrar deneyin."
      reset={reset}
    />
  );
}
