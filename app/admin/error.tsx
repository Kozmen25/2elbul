"use client";

import { ErrorShell } from "@/components/error-shell";

export default function AdminError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <ErrorShell
      title="Admin paneli yüklenemedi"
      message="Yönetim paneli yüklenirken bir hata oluştu. Lütfen tekrar deneyin."
      reset={reset}
    />
  );
}
