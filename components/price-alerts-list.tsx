"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deactivatePriceAlert } from "@/app/price-alerts/actions";

export type UserPriceAlert = {
  id: string;
  productName: string;
  targetPrice: number;
  currentPrice: number | null;
  status: string;
  createdAt: string;
};

export function PriceAlertsList({ alerts }: { alerts: UserPriceAlert[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!alerts.length) {
    return (
      <p className="mt-4 text-sm text-black/45">Henüz fiyat alarmınız yok.</p>
    );
  }

  return (
    <div className="mt-4 grid gap-3">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="grid gap-4 rounded-xl border border-black/8 bg-[#fafaf8] p-4 sm:grid-cols-[1fr_auto]"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-black">{alert.productName}</p>
              <span className={`rounded-full px-2.5 py-1 text-xs font-black ${statusClass(alert.status)}`}>
                {statusLabel(alert.status)}
              </span>
            </div>
            <div className="mt-3 grid gap-2 text-sm text-black/55 sm:grid-cols-3">
              <p>
                <span className="font-bold text-black/45">Hedef:</span>{" "}
                {formatTry(alert.targetPrice)}
              </p>
              <p>
                <span className="font-bold text-black/45">Mevcut:</span>{" "}
                {alert.currentPrice ? formatTry(alert.currentPrice) : "Henüz yok"}
              </p>
              <p>
                <span className="font-bold text-black/45">Oluşturma:</span>{" "}
                {formatDate(alert.createdAt)}
              </p>
            </div>
          </div>
          {alert.status !== "cancelled" ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await deactivatePriceAlert(alert.id);
                  router.refresh();
                })
              }
              className="flex h-10 items-center justify-center gap-2 rounded-xl border border-red-200 px-3 text-sm font-bold text-red-600 disabled:opacity-50"
              title="Alarmı iptal et"
              aria-label="Alarmı iptal et"
            >
              <Trash2 size={16} />
              İptal
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function statusLabel(status: string) {
  if (status === "active") return "Aktif";
  if (status === "triggered") return "Tetiklendi";
  if (status === "paused") return "Duraklatıldı";
  if (status === "cancelled") return "İptal edildi";
  return status;
}

function statusClass(status: string) {
  if (status === "active") return "bg-green-100 text-green-700";
  if (status === "triggered") return "bg-[#fff1e7] text-[#ff6b00]";
  if (status === "paused") return "bg-amber-100 text-amber-700";
  return "bg-black/7 text-black/45";
}

function formatTry(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
