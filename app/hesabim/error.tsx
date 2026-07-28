"use client";

import { ErrorShell } from "@/components/error-shell";

export default function AccountError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <ErrorShell
      title="Hesap sayfası yüklenemedi"
      message="Hesap bilgileriniz yüklenirken bir hata oluştu. Lütfen tekrar deneyin."
      reset={reset}
    />
  );
}
