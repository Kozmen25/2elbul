"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deactivatePriceAlert } from "@/app/price-alerts/actions";

export type UserPriceAlert = {
  id: number;
  productName: string;
  targetPrice: number;
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
          className="flex items-center justify-between gap-3 rounded-xl border border-black/8 bg-[#fafaf8] p-4"
        >
          <div className="min-w-0">
            <p className="truncate font-black">{alert.productName}</p>
            <p className="mt-1 text-sm text-black/50">
              Hedef: {formatTry(alert.targetPrice)}
            </p>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await deactivatePriceAlert(alert.id);
                router.refresh();
              })
            }
            className="grid size-10 shrink-0 place-items-center rounded-xl border border-red-200 text-red-600 disabled:opacity-50"
            title="Alarmı kaldır"
            aria-label="Alarmı kaldır"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

function formatTry(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value);
}
