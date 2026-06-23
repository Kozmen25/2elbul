"use client";

import {
  CheckCircle2,
  Clock3,
  ExternalLink,
  Pencil,
  ShieldX,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ListingImage } from "@/components/listing-image";
import {
  bulkListingAction,
  type BulkListingAction,
  type BulkListingResult,
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
  const [notification, setNotification] =
    useState<BulkListingResult | null>(null);
  const [pending, startTransition] = useTransition();

  function runBulkAction(action: BulkListingAction) {
    if (selected.length === 0) return;
    if (
      action === "delete" &&
      !window.confirm(`${selected.length} ilan kalıcı olarak silinsin mi?`)
    ) {
      return;
    }

    setNotification(null);
    startTransition(async () => {
      const result = await bulkListingAction(selected, action);
      setNotification(result);
      if (result.ok) {
        setSelected([]);
        router.refresh();
      }
    });
  }

  return (
    <div className="min-w-0">
      <div className="mb-3 rounded-2xl border border-black/8 bg-white p-3 shadow-[0_10px_30px_rgba(0,0,0,0.035)] sm:p-4">
        <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
          <div>
            <p className="font-black">Toplu işlemler</p>
            <p className="mt-1 text-xs font-semibold text-black/45">
              {selected.length
                ? `${selected.length} ilan seçildi`
                : `${listings.length} ilan gösteriliyor. İşlem için ilan seçin.`}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {statusAvailable && (
              <>
                <BulkButton
                  label="Yayınla"
                  icon={CheckCircle2}
                  disabled={selected.length === 0 || pending}
                  onClick={() => runBulkAction("publish")}
                  className="border-green-200 bg-green-50 text-green-700"
                />
                <BulkButton
                  label="Beklemeye al"
                  icon={Clock3}
                  disabled={selected.length === 0 || pending}
                  onClick={() => runBulkAction("pending")}
                  className="border-amber-200 bg-amber-50 text-amber-700"
                />
                <BulkButton
                  label="Reddet"
                  icon={ShieldX}
                  disabled={selected.length === 0 || pending}
                  onClick={() => runBulkAction("reject")}
                  className="border-red-200 bg-red-50 text-red-700"
                />
              </>
            )}
            <BulkButton
              label="Sil"
              icon={Trash2}
              disabled={selected.length === 0 || pending}
              onClick={() => runBulkAction("delete")}
              className="border-red-600 bg-red-600 text-white"
            />
          </div>
        </div>
      </div>

      {notification && (
        <div
          role={notification.ok ? "status" : "alert"}
          className={`mb-3 flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-bold ${
            notification.ok
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          <span className="flex items-center gap-2">
            {notification.ok ? (
              <CheckCircle2 size={18} className="shrink-0" />
            ) : (
              <ShieldX size={18} className="shrink-0" />
            )}
            {notification.message}
          </span>
          <button
            type="button"
            onClick={() => setNotification(null)}
            aria-label="Bildirimi kapat"
            className="shrink-0"
          >
            <X size={17} />
          </button>
        </div>
      )}

      <div className="w-full max-w-full min-w-0 overflow-x-auto rounded-2xl border border-black/8 bg-white [-webkit-overflow-scrolling:touch]">
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
              <th className="sticky right-0 z-10 bg-[#fafaf8] px-4 py-3 text-right shadow-[-12px_0_20px_rgba(0,0,0,0.04)]">İşlemler</th>
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
                <td className="sticky right-0 z-10 bg-white px-4 py-4 shadow-[-12px_0_20px_rgba(0,0,0,0.04)]">
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

function BulkButton({
  label,
  icon: Icon,
  disabled,
  onClick,
  className,
}: {
  label: string;
  icon: typeof CheckCircle2;
  disabled: boolean;
  onClick: () => void;
  className: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-35 sm:text-sm ${className}`}
    >
      <Icon size={16} />
      {label}
    </button>
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
