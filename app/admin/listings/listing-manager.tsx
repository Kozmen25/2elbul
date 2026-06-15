"use client";

import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ListingImage } from "@/components/listing-image";
import {
  bulkDeleteListings,
  deleteListing,
  setListingStatus,
  updateListing,
} from "./actions";

export type AdminListing = {
  id: number;
  productId: number;
  productName: string;
  title: string;
  price: number;
  city: string;
  source: string;
  condition: string;
  url: string;
  imageUrl: string | null;
  status: string;
  createdAt: string;
};

export function ListingManager({
  listings,
  products,
  statusAvailable,
}: {
  listings: AdminListing[];
  products: { id: number; name: string }[];
  statusAvailable: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<number[]>([]);
  const [pending, startTransition] = useTransition();

  function bulkDelete() {
    if (
      selected.length === 0 ||
      !window.confirm(`${selected.length} ilan kalıcı olarak silinsin mi?`)
    ) {
      return;
    }
    startTransition(async () => {
      await bulkDeleteListings(selected);
      setSelected([]);
      router.refresh();
    });
  }

  return (
    <div className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-black/45">
          {listings.length} ilan gösteriliyor
        </p>
        <button
          type="button"
          disabled={selected.length === 0 || pending}
          onClick={bulkDelete}
          className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
        >
          Seçilenleri sil ({selected.length})
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-black/8 bg-white">
        <table className="w-full min-w-[1180px] text-left text-sm">
          <thead className="bg-[#fafaf8] text-xs uppercase tracking-wide text-black/45">
            <tr>
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={
                    listings.length > 0 && selected.length === listings.length
                  }
                  onChange={(event) =>
                    setSelected(
                      event.target.checked
                        ? listings.map((listing) => listing.id)
                        : [],
                    )
                  }
                  aria-label="Tüm ilanları seç"
                />
              </th>
              <th className="px-4 py-3">İlan</th>
              <th className="px-4 py-3">Ürün</th>
              <th className="px-4 py-3">Fiyat</th>
              <th className="px-4 py-3">Konum / Kaynak</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3">Tarih</th>
              <th className="px-4 py-3 text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {listings.map((listing) => (
              <tr key={listing.id} className="border-t border-black/7 align-top">
                <td className="px-4 py-4">
                  <input
                    type="checkbox"
                    checked={selected.includes(listing.id)}
                    onChange={(event) =>
                      setSelected((current) =>
                        event.target.checked
                          ? [...current, listing.id]
                          : current.filter((id) => id !== listing.id),
                      )
                    }
                    aria-label={`${listing.title} ilanını seç`}
                  />
                </td>
                <td className="w-[290px] px-4 py-4">
                  <div className="grid grid-cols-[90px_1fr] gap-3">
                    <ListingImage
                      imageUrl={listing.imageUrl}
                      productName={listing.productName}
                      alt={listing.title}
                    />
                    <div className="min-w-0">
                      <p className="line-clamp-2 font-black">{listing.title}</p>
                      <p className="mt-1 text-xs text-black/40">#{listing.id}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 font-bold">{listing.productName}</td>
                <td className="px-4 py-4 font-black">
                  {formatPrice(listing.price)}
                </td>
                <td className="px-4 py-4">
                  <p>{listing.city}</p>
                  <p className="mt-1 text-xs text-black/45">{listing.source}</p>
                </td>
                <td className="px-4 py-4">
                  <StatusBadge status={listing.status} />
                  {statusAvailable && (
                    <div className="mt-2 flex gap-1">
                      {["published", "pending", "rejected"].map((status) => (
                        <form key={status} action={setListingStatus}>
                          <input type="hidden" name="id" value={listing.id} />
                          <input type="hidden" name="status" value={status} />
                          <button
                            className="rounded-lg border border-black/10 px-2 py-1 text-[10px] font-bold hover:border-[#ff6b00]"
                            title={statusLabel(status)}
                          >
                            {status === "published"
                              ? "Yayınla"
                              : status === "pending"
                                ? "Beklet"
                                : "Reddet"}
                          </button>
                        </form>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-4 text-xs text-black/55">
                  {formatDate(listing.createdAt)}
                </td>
                <td className="px-4 py-4">
                  <div className="flex justify-end gap-2">
                    <a
                      href={listing.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="grid size-9 place-items-center rounded-lg border border-black/10"
                      aria-label="İlanı aç"
                    >
                      <ExternalLink size={16} />
                    </a>
                    <details className="relative">
                      <summary className="grid size-9 cursor-pointer list-none place-items-center rounded-lg border border-black/10">
                        <Pencil size={16} />
                      </summary>
                      <div className="fixed inset-0 z-40 grid place-items-center bg-black/45 p-4">
                        <form
                          action={updateListing}
                          className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
                        >
                          <div className="flex items-center justify-between">
                            <h2 className="text-xl font-black">İlanı düzenle</h2>
                            <span className="text-xs text-black/40">
                              #{listing.id}
                            </span>
                          </div>
                          <input type="hidden" name="id" value={listing.id} />
                          <div className="mt-5 grid gap-4 sm:grid-cols-2">
                            <Field label="Başlık" wide>
                              <input
                                className="field px-3 py-2.5"
                                name="title"
                                defaultValue={listing.title}
                                required
                              />
                            </Field>
                            <Field label="Ürün">
                              <select
                                className="field px-3 py-2.5"
                                name="product_id"
                                defaultValue={listing.productId}
                              >
                                {products.map((product) => (
                                  <option key={product.id} value={product.id}>
                                    {product.name}
                                  </option>
                                ))}
                              </select>
                            </Field>
                            <Field label="Fiyat">
                              <input
                                className="field px-3 py-2.5"
                                name="price"
                                type="number"
                                min="1"
                                defaultValue={listing.price}
                              />
                            </Field>
                            <Field label="Şehir">
                              <input
                                className="field px-3 py-2.5"
                                name="city"
                                defaultValue={listing.city}
                              />
                            </Field>
                            <Field label="Kaynak">
                              <input
                                className="field px-3 py-2.5"
                                name="source"
                                defaultValue={listing.source}
                              />
                            </Field>
                            <Field label="Ürün durumu">
                              <input
                                className="field px-3 py-2.5"
                                name="condition"
                                defaultValue={listing.condition}
                              />
                            </Field>
                            {statusAvailable && (
                              <Field label="Yayın durumu">
                                <select
                                  className="field px-3 py-2.5"
                                  name="status"
                                  defaultValue={listing.status}
                                >
                                  <option value="published">Yayında</option>
                                  <option value="pending">Beklemede</option>
                                  <option value="rejected">Reddedildi</option>
                                </select>
                              </Field>
                            )}
                            <Field label="İlan linki" wide>
                              <input
                                className="field px-3 py-2.5"
                                name="url"
                                type="url"
                                defaultValue={listing.url}
                              />
                            </Field>
                            <Field label="Görsel linki" wide>
                              <input
                                className="field px-3 py-2.5"
                                name="image_url"
                                type="url"
                                defaultValue={listing.imageUrl ?? ""}
                              />
                            </Field>
                          </div>
                          <div className="mt-5 flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                const details =
                                  event.currentTarget.closest("details");
                                if (details) details.open = false;
                              }}
                              className="rounded-xl border border-black/10 px-4 py-3 font-bold"
                            >
                              Vazgeç
                            </button>
                            <button className="orange-button px-5 py-3">
                              Kaydet
                            </button>
                          </div>
                        </form>
                      </div>
                    </details>
                    <form
                      action={deleteListing}
                      onSubmit={(event) => {
                        if (!window.confirm("Bu ilan kalıcı olarak silinsin mi?")) {
                          event.preventDefault();
                        }
                      }}
                    >
                      <input type="hidden" name="id" value={listing.id} />
                      <button
                        className="grid size-9 place-items-center rounded-lg border border-red-200 text-red-600"
                        aria-label="İlanı sil"
                      >
                        <Trash2 size={16} />
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={wide ? "sm:col-span-2" : ""}>
      <span className="mb-1.5 block text-xs font-black text-black/55">
        {label}
      </span>
      {children}
    </label>
  );
}

function StatusBadge({ status }: { status: string }) {
  const classes =
    status === "published"
      ? "bg-green-100 text-green-700"
      : status === "rejected"
        ? "bg-red-100 text-red-700"
        : "bg-amber-100 text-amber-700";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${classes}`}>
      {statusLabel(status)}
    </span>
  );
}

function statusLabel(status: string) {
  if (status === "published") return "Yayında";
  if (status === "rejected") return "Reddedildi";
  return "Beklemede";
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
