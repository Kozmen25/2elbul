"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type DataCleanupDeactivateButtonProps = {
  listingId: string;
  title: string;
};

export function DataCleanupDeactivateButton({
  listingId,
  title,
}: DataCleanupDeactivateButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function handleDeactivate() {
    const confirmed = window.confirm(
      `"${title}" ilanı silinmeyecek, sadece pasife alınacak. Devam edilsin mi?`,
    );
    if (!confirmed) return;

    setMessage(null);
    setIsError(false);

    try {
      const response = await fetch("/api/admin/data-cleanup/deactivate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ listingId }),
      });
      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        error?: string;
      } | null;

      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error ?? "İlan pasife alınamadı.");
      }

      setMessage(data?.message ?? "İlan pasife alındı.");
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "İlan pasife alınırken bilinmeyen bir hata oluştu.",
      );
    }
  }

  return (
    <div className="min-w-[150px]">
      <button
        type="button"
        onClick={handleDeactivate}
        disabled={isPending}
        className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-800 transition hover:border-amber-300 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "İşleniyor..." : "Pasife al"}
      </button>
      {message ? (
        <p
          className={`mt-2 text-xs font-bold ${
            isError ? "text-red-600" : "text-emerald-700"
          }`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
