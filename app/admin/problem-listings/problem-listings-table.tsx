"use client";

import { Ban, ExternalLink, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { showAdminToast } from "@/components/admin-toast";
import { bulkListingAction, type BulkListingAction } from "@/app/admin/listings/actions";
import { LISTING_PROBLEM_LABELS, type ProblemListing } from "@/lib/listing-problems";
import { formatCurrencyTRY } from "@/lib/formatters";

/** Listings with problems: select some, take them off the site or delete them. */
export function ProblemListingsTable({ listings }: { listings: ProblemListing[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<number[]>([]);
  const [pending, startTransition] = useTransition();

  const allSelected = listings.length > 0 && selected.length === listings.length;

  function toggle(id: number) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function run(ids: number[], action: BulkListingAction) {
    if (ids.length === 0) return;
    if (action === "delete" && !window.confirm(`${ids.length} ilan kalıcı olarak silinsin mi?`)) return;

    startTransition(async () => {
      const result = await bulkListingAction(ids, action);
      showAdminToast(result);
      if (result.ok) {
        setSelected([]);
        router.refresh();
      }
    });
  }

  if (listings.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-black/15 bg-white px-6 py-14 text-center text-sm font-semibold text-black/45">
        Bu filtrede hatalı ilan yok.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-black/8 bg-white p-3">
        <label className="flex items-center gap-2 px-2 text-sm font-bold">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() => setSelected(allSelected ? [] : listings.map((listing) => listing.id))}
            className="size-4 accent-[#3B66E0]"
          />
          {selected.length ? `${selected.length} seçili` : "Tümünü seç"}
        </label>
        <button
          type="button"
          disabled={selected.length === 0 || pending}
          onClick={() => run(selected, "deactivate")}
          className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-800 disabled:opacity-40"
        >
          <Ban size={14} /> Pasife al
        </button>
        <button
          type="button"
          disabled={selected.length === 0 || pending}
          onClick={() => run(selected, "delete")}
          className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 disabled:opacity-40"
        >
          <Trash2 size={14} /> Sil
        </button>
      </div>

      <ul className="grid gap-2">
        {listings.map((listing) => (
          <li key={listing.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-black/8 bg-white p-3 sm:p-4">
            <input
              type="checkbox"
              aria-label={`${listing.title} ilanını seç`}
              checked={selected.includes(listing.id)}
              onChange={() => toggle(listing.id)}
              className="size-4 shrink-0 accent-[#3B66E0]"
            />
            <div className="min-w-0 flex-1 basis-56">
              <p className="truncate font-black">{listing.title}</p>
              <p className="mt-0.5 text-xs font-semibold text-black/45">
                #{listing.id} · {listing.source} · {listing.price > 0 ? formatCurrencyTRY(listing.price) : "fiyat yok"} ·{" "}
                {listing.status}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {listing.problems.map((kind) => (
                  <span
                    key={kind}
                    title={LISTING_PROBLEM_LABELS[kind].description}
                    className="rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[11px] font-black text-red-700"
                  >
                    {LISTING_PROBLEM_LABELS[kind].label}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {listing.url ? (
                <a
                  href={listing.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="grid size-9 place-items-center rounded-lg border border-black/10"
                  aria-label="Kaynak ilanı aç"
                >
                  <ExternalLink size={16} />
                </a>
              ) : null}
              <Link
                href={`/admin/listings?q=${listing.id}`}
                className="grid size-9 place-items-center rounded-lg border border-black/10"
                aria-label="İlanı düzenle"
              >
                <Pencil size={16} />
              </Link>
              <button
                type="button"
                disabled={pending}
                onClick={() => run([listing.id], "deactivate")}
                className="grid size-9 place-items-center rounded-lg border border-amber-200 text-amber-700 disabled:opacity-40"
                aria-label="İlanı pasife al"
              >
                <Ban size={16} />
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => run([listing.id], "delete")}
                className="grid size-9 place-items-center rounded-lg border border-red-200 text-red-600 disabled:opacity-40"
                aria-label="İlanı sil"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
