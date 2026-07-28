"use client";

import { Bell, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteSavedSearch } from "@/app/saved-searches/actions";

export type SavedSearchItem = {
  id: string;
  query: string;
  frequency: "instant" | "daily" | "weekly";
  lastNotifiedAt: string | null;
  createdAt: string;
};

export function SavedSearchesList({
  searches,
}: {
  searches: SavedSearchItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!searches.length) {
    return (
      <p className="mt-4 text-sm text-black/45">
        Henüz kaydedilmiş aramanız yok. Arama yaparken "Bu Aramayı Kaydet" butonunu kullanabilirsiniz.
      </p>
    );
  }

  return (
    <div className="mt-4 grid gap-3">
      {searches.map((search) => (
        <div
          key={search.id}
          className="grid gap-4 rounded-xl border border-black/8 bg-[#fafaf8] p-4 sm:grid-cols-[1fr_auto]"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Bell size={16} className="shrink-0 text-[#ff6b00]" />
              <p className="truncate font-black">{search.query}</p>
              <span className="rounded-full bg-[#fff1e7] px-2.5 py-1 text-xs font-black text-[#d95700]">
                {frequencyLabel(search.frequency)}
              </span>
            </div>
            <p className="mt-2 text-sm text-black/45">
              {search.lastNotifiedAt
                ? `Son bildirim: ${formatDate(search.lastNotifiedAt)}`
                : "Henüz bildirim gönderilmedi"}
            </p>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await deleteSavedSearch(search.id);
                router.refresh();
              })
            }
            className="flex h-10 items-center justify-center gap-2 rounded-xl border border-red-200 px-3 text-sm font-bold text-red-600 disabled:opacity-50"
            title="Aramayı kaldır"
            aria-label="Aramayı kaldır"
          >
            <Trash2 size={16} />
            Kaldır
          </button>
        </div>
      ))}
    </div>
  );
}

function frequencyLabel(frequency: string) {
  if (frequency === "instant") return "Anında";
  if (frequency === "daily") return "Günlük";
  if (frequency === "weekly") return "Haftalık";
  return frequency;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
