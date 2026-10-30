"use client";

import { BellRing, Pause, Play, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setPriceAlertStatus } from "@/app/price-alerts/actions";
import type { PriceAlertStatus } from "@/lib/price-alerts/rules";

export type UserPriceAlert = {
  id: string;
  productName: string;
  productSlug: string | null;
  targetPrice: number;
  currentPrice: number | null;
  status: string;
  createdAt: string;
};

export function PriceAlertsList({ alerts }: { alerts: UserPriceAlert[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function changeStatus(alertId: string, status: PriceAlertStatus) {
    setError(null);
    startTransition(async () => {
      const result = await setPriceAlertStatus(alertId, status);
      if (!result.ok) setError(result.message);
      router.refresh();
    });
  }

  if (!alerts.length) {
    return (
      <p className="mt-4 text-sm text-black/45">Henüz fiyat alarmınız yok.</p>
    );
  }

  return (
    <div className="mt-4 grid gap-3">
      {error && <p className="text-sm font-bold text-red-600">{error}</p>}
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="grid gap-4 rounded-xl border border-black/8 bg-[#fafaf8] p-4 sm:grid-cols-[1fr_auto]"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {alert.productSlug ? (
                <Link href={`/product/${alert.productSlug}`} className="truncate font-black hover:text-[#2A4FBF]">
                  {alert.productName}
                </Link>
              ) : (
                <p className="truncate font-black">{alert.productName}</p>
              )}
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
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {alert.status === "active" ? (
              <AlertButton
                label="Duraklat"
                icon={<Pause size={16} />}
                disabled={pending}
                onClick={() => changeStatus(alert.id, "paused")}
              />
            ) : null}
            {alert.status === "paused" ? (
              <AlertButton
                label="Sürdür"
                icon={<Play size={16} />}
                disabled={pending}
                onClick={() => changeStatus(alert.id, "active")}
              />
            ) : null}
            {alert.status === "triggered" ? (
              <AlertButton
                label="Yeniden kur"
                icon={<BellRing size={16} />}
                disabled={pending}
                onClick={() => changeStatus(alert.id, "active")}
              />
            ) : null}
            <AlertButton
              label="İptal"
              icon={<Trash2 size={16} />}
              disabled={pending}
              danger
              onClick={() => changeStatus(alert.id, "cancelled")}
            />
          </div>
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
  if (status === "triggered") return "bg-[#E4ECFF] text-[#3B66E0]";
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

function AlertButton({
  label,
  icon,
  disabled,
  danger = false,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  disabled: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      className={`flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-bold disabled:opacity-50 ${
        danger ? "border-red-200 text-red-600" : "border-black/10 text-black/65 hover:border-[#3B66E0]/35 hover:text-[#2A4FBF]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
