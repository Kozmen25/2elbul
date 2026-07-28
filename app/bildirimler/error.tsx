"use client";

import { ErrorShell } from "@/components/error-shell";

export default function NotifError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <ErrorShell
      title="Bildirimler yüklenemedi"
      message="Bildirimleriniz yüklenirken bir hata oluştu. Lütfen tekrar deneyin."
      reset={reset}
    />
  );
}
