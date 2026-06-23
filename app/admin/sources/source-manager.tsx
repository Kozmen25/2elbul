"use client";

import {
  Bot,
  ExternalLink,
  Globe2,
  Pencil,
  Plus,
  Power,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import {
  createSource,
  deleteSource,
  runDemoBot,
  runRealBot,
  toggleSource,
  updateSource,
  type SourceActionResult,
  type SourceInput,
} from "./actions";

export type AdminSource = {
  id: number;
  name: string;
  slug: string;
  baseUrl: string | null;
  type: string;
  integrationType: "manual" | "scrape" | "api";
  botListingStatus: "pending" | "published";
  apiUrl: string | null;
  scrapeUrl: string | null;
  cronEnabled: boolean;
  cronSchedule: string;
  productLimit: number;
  lastSuccess: string | null;
  isActive: boolean;
  lastRunAt: string | null;
  totalImported: number;
  createdAt: string;
};

const emptySource: SourceInput = {
  name: "",
  slug: "",
  baseUrl: "",
  type: "marketplace",
  integrationType: "manual",
  botListingStatus: "pending",
  apiUrl: "",
  scrapeUrl: "",
  cronEnabled: false,
  cronSchedule: "0 */6 * * *",
  productLimit: 100,
};

export function SourceManager({
  sources,
  publishModeAvailable,
  integrationSettingsAvailable,
}: {
  sources: AdminSource[];
  publishModeAvailable: boolean;
  integrationSettingsAvailable: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<SourceInput | null>(null);
  const [message, setMessage] = useState<SourceActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function openCreate() {
    setMessage(null);
    setEditing({ ...emptySource });
  }

  function openEdit(source: AdminSource) {
    setMessage(null);
    setEditing({
      id: source.id,
      name: source.name,
      slug: source.slug,
      baseUrl: source.baseUrl ?? "",
      type: source.type,
      integrationType: source.integrationType,
      botListingStatus: source.botListingStatus,
      apiUrl: source.apiUrl ?? "",
      scrapeUrl: source.scrapeUrl ?? "",
      cronEnabled: source.cronEnabled,
      cronSchedule: source.cronSchedule,
      productLimit: source.productLimit,
    });
  }

  function runAction(action: () => Promise<SourceActionResult>) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      setMessage(result);
      if (result.ok) {
        setEditing(null);
        router.refresh();
      }
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    runAction(() =>
      editing.id ? updateSource(editing) : createSource(editing),
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <p className="text-sm font-bold text-black/45">
          {sources.length} kaynak tanımlı
        </p>
        <button
          type="button"
          onClick={openCreate}
          className="orange-button px-4 py-3"
        >
          <Plus size={18} />
          Yeni kaynak
        </button>
      </div>

      {message && (
        <div
          className={`mb-4 rounded-xl border p-4 text-sm font-bold ${
            message.ok
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.message}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-black/8 bg-white">
        <table className="w-full min-w-[1580px] text-left text-sm">
          <thead className="bg-[#fafaf8] text-xs uppercase tracking-wide text-black/45">
            <tr>
              <th className="px-4 py-3">Kaynak</th>
              <th className="px-4 py-3">Tip</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3">Bot ilan modu</th>
              <th className="px-4 py-3">Entegrasyon</th>
              <th className="px-4 py-3">Çekim planı</th>
              <th className="px-4 py-3">Son çalışma</th>
              <th className="px-4 py-3">Toplam aktarılan</th>
              <th className="px-4 py-3">Kaynak linki</th>
              <th className="px-4 py-3 text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr key={source.id} className="border-t border-black/7">
                <td className="px-4 py-4">
                  <p className="font-black">{source.name}</p>
                  <p className="mt-1 font-mono text-xs text-black/40">
                    {source.slug}
                  </p>
                </td>
                <td className="px-4 py-4">
                  <span className="rounded-full bg-[#fff1e7] px-2.5 py-1 text-xs font-black text-[#d95700]">
                    {typeLabel(source.type)}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-black ${
                      source.isActive
                        ? "bg-green-100 text-green-700"
                        : "bg-black/7 text-black/45"
                    }`}
                  >
                    {source.isActive ? "Aktif" : "Pasif"}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-black ${
                      source.botListingStatus === "published"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {source.botListingStatus === "published"
                      ? "Direkt yayınla"
                      : "Pending olarak ekle"}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-1.5">
                    {source.apiUrl && (
                      <span className="rounded-full bg-blue-100 px-2 py-1 text-[10px] font-black text-blue-700">
                        API
                      </span>
                    )}
                    {source.scrapeUrl && (
                      <span className="rounded-full bg-purple-100 px-2 py-1 text-[10px] font-black text-purple-700">
                        SCRAPE
                      </span>
                    )}
                    {!source.apiUrl &&
                      !source.scrapeUrl &&
                      source.integrationType === "manual" && (
                      <span className="text-xs text-black/35">Yapılandırılmadı</span>
                    )}
                    {source.integrationType !== "manual" && (
                      <span className="rounded-full bg-black/7 px-2 py-1 text-[10px] font-black text-black/55">
                        {source.integrationType.toUpperCase()}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <p className="text-xs font-bold">
                    {source.cronEnabled
                      ? cronScheduleLabel(source.cronSchedule)
                      : "Kapalı"}
                  </p>
                  <p className="mt-1 text-[11px] text-black/40">
                    Limit: {source.productLimit}
                  </p>
                </td>
                <td className="px-4 py-4 text-black/55">
                  {source.lastRunAt
                    ? formatDate(source.lastRunAt)
                    : "Henüz çalışmadı"}
                  {source.lastSuccess && (
                    <p className="mt-1 text-[11px] font-semibold text-green-700">
                      Son başarı: {formatDate(source.lastSuccess)}
                    </p>
                  )}
                </td>
                <td className="px-4 py-4 text-lg font-black">
                  {source.totalImported.toLocaleString("tr-TR")}
                </td>
                <td className="px-4 py-4">
                  {source.baseUrl ? (
                    <a
                      href={source.baseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-bold text-[#ff6b00] hover:underline"
                    >
                      Siteyi aç <ExternalLink size={15} />
                    </a>
                  ) : (
                    <span className="text-black/35">Tanımlı değil</span>
                  )}
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      disabled={pending || !publishModeAvailable}
                      onClick={() => {
                        if (
                          window.confirm(
                            `${source.name} için 10 adet demo ilan üretilsin mi?`,
                          )
                        ) {
                          runAction(() => runDemoBot(source.id));
                        }
                      }}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#ff6b00]/25 bg-[#fff7f1] px-3 text-xs font-black text-[#d95700] disabled:opacity-50"
                    >
                      <Bot size={15} />
                      Demo test çekimi
                    </button>
                    <button
                      type="button"
                      disabled={
                        pending ||
                        !publishModeAvailable ||
                        !["easycep", "getmobil"].includes(source.slug)
                      }
                      onClick={() => {
                        if (
                          window.confirm(
                            `${source.name} kategori sayfasından en fazla 10 gerçek ürün çekilsin mi?`,
                          )
                        ) {
                          runAction(() => runRealBot(source.id));
                        }
                      }}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 text-xs font-black text-purple-700 disabled:cursor-not-allowed disabled:opacity-45"
                      title={
                        ["easycep", "getmobil"].includes(source.slug)
                          ? "Tek sayfalık sınırlı gerçek test çekimi"
                          : "Bu kaynak adaptörü hazırlanıyor"
                      }
                    >
                      <Globe2 size={15} />
                      {["easycep", "getmobil"].includes(source.slug)
                        ? "Gerçek test çekimi"
                        : "Hazırlanıyor"}
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        runAction(() =>
                          toggleSource(source.id, !source.isActive),
                        )
                      }
                      className={`grid size-9 place-items-center rounded-lg border ${
                        source.isActive
                          ? "border-amber-200 text-amber-700"
                          : "border-green-200 text-green-700"
                      }`}
                      aria-label={
                        source.isActive
                          ? "Kaynağı pasifleştir"
                          : "Kaynağı aktifleştir"
                      }
                    >
                      <Power size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(source)}
                      className="grid size-9 place-items-center rounded-lg border border-black/10"
                      aria-label="Kaynağı düzenle"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `${source.name} kaynağı ve tüm bot çalışma kayıtları silinsin mi?`,
                          )
                        ) {
                          runAction(() => deleteSource(source.id));
                        }
                      }}
                      className="grid size-9 place-items-center rounded-lg border border-red-200 text-red-600"
                      aria-label="Kaynağı sil"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/50 p-4">
          <form
            onSubmit={handleSubmit}
            className="my-6 w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.15em] text-[#ff6b00]">
                  Kaynak yönetimi
                </p>
                <h2 className="mt-1 text-2xl font-black">
                  {editing.id ? "Kaynağı düzenle" : "Yeni kaynak ekle"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="grid size-10 place-items-center rounded-xl border border-black/10"
                aria-label="Pencereyi kapat"
              >
                <X size={19} />
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <SourceField label="Kaynak adı" wide>
                <input
                  required
                  value={editing.name}
                  onChange={(event) =>
                    setEditing((current) =>
                      current
                        ? {
                            ...current,
                            name: event.target.value,
                            slug:
                              current.id || current.slug
                                ? current.slug
                                : createSlug(event.target.value),
                          }
                        : current,
                    )
                  }
                  className="field px-3 py-3"
                  placeholder="Örn. EasyCep"
                />
              </SourceField>
              <SourceField label="Slug">
                <input
                  required
                  value={editing.slug}
                  onChange={(event) =>
                    setEditing({ ...editing, slug: event.target.value })
                  }
                  className="field px-3 py-3"
                  placeholder="easycep"
                />
              </SourceField>
              <SourceField label="Kaynak tipi">
                <select
                  value={editing.type}
                  onChange={(event) =>
                    setEditing({ ...editing, type: event.target.value })
                  }
                  className="field px-3 py-3"
                >
                  <option value="marketplace">Pazar yeri</option>
                  <option value="refurbished">Yenilenmiş cihaz</option>
                  <option value="retailer">Perakendeci</option>
                  <option value="other">Diğer</option>
                </select>
              </SourceField>
              <SourceField label="Bot ilan ayarı">
                <select
                  disabled={!publishModeAvailable}
                  value={editing.botListingStatus}
                  onChange={(event) =>
                    setEditing({
                      ...editing,
                      botListingStatus: event.target.value as
                        | "pending"
                        | "published",
                    })
                  }
                  className="field px-3 py-3"
                >
                  <option value="pending">Pending olarak ekle</option>
                  <option value="published">Direkt yayınla</option>
                </select>
                {!publishModeAvailable && (
                  <span className="mt-2 block text-xs font-semibold text-amber-700">
                    Önce yayın modu migration dosyasını çalıştırın.
                  </span>
                )}
              </SourceField>
              <SourceField label="Entegrasyon tipi">
                <select
                  disabled={!integrationSettingsAvailable}
                  value={editing.integrationType}
                  onChange={(event) =>
                    setEditing({
                      ...editing,
                      integrationType: event.target.value as
                        | "manual"
                        | "scrape"
                        | "api",
                    })
                  }
                  className="field px-3 py-3 disabled:bg-black/3"
                >
                  <option value="manual">Manuel</option>
                  <option value="scrape">Scrape</option>
                  <option value="api">API</option>
                </select>
              </SourceField>
              <SourceField label="Kaynak linki" wide>
                <input
                  type="url"
                  value={editing.baseUrl}
                  onChange={(event) =>
                    setEditing({ ...editing, baseUrl: event.target.value })
                  }
                  className="field px-3 py-3"
                  placeholder="https://..."
                />
              </SourceField>
              <SourceField label="API adresi" wide>
                <input
                  type="url"
                  disabled={!integrationSettingsAvailable}
                  value={editing.apiUrl}
                  onChange={(event) =>
                    setEditing({ ...editing, apiUrl: event.target.value })
                  }
                  className="field px-3 py-3 disabled:bg-black/3"
                  placeholder="https://api.example.com/listings"
                />
              </SourceField>
              <SourceField label="Tarama adresi" wide>
                <input
                  type="url"
                  disabled={!integrationSettingsAvailable}
                  value={editing.scrapeUrl}
                  onChange={(event) =>
                    setEditing({ ...editing, scrapeUrl: event.target.value })
                  }
                  className="field px-3 py-3 disabled:bg-black/3"
                  placeholder="https://example.com/ikinci-el"
                />
              </SourceField>
              <SourceField label="Çekim sıklığı">
                <select
                  disabled={!integrationSettingsAvailable}
                  value={editing.cronSchedule}
                  onChange={(event) =>
                    setEditing({
                      ...editing,
                      cronSchedule: event.target.value,
                    })
                  }
                  className="field px-3 py-3 disabled:bg-black/3"
                >
                  <option value="0 * * * *">Her saat</option>
                  <option value="0 */3 * * *">3 saatte bir</option>
                  <option value="0 */6 * * *">6 saatte bir</option>
                  <option value="0 */12 * * *">12 saatte bir</option>
                  <option value="0 3 * * *">Günde bir</option>
                </select>
              </SourceField>
              <SourceField label="Ürün limiti">
                <input
                  type="number"
                  min="1"
                  max="1000"
                  disabled={!integrationSettingsAvailable}
                  value={editing.productLimit}
                  onChange={(event) =>
                    setEditing({
                      ...editing,
                      productLimit: Number(event.target.value),
                    })
                  }
                  className="field px-3 py-3 disabled:bg-black/3"
                />
              </SourceField>
              <SourceField label="Zamanlanmış çekim" wide>
                <label className="flex items-center justify-between rounded-xl border border-black/8 bg-[#fafaf8] p-4">
                  <span>
                    <span className="block text-sm font-black">
                      Cron çalışmasını etkinleştir
                    </span>
                    <span className="mt-1 block text-xs text-black/45">
                      Harici scheduler bu ayarı okuyarak çalıştırabilir.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    disabled={!integrationSettingsAvailable}
                    checked={editing.cronEnabled}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        cronEnabled: event.target.checked,
                      })
                    }
                    className="size-5 accent-[#ff6b00]"
                  />
                </label>
              </SourceField>
              {!integrationSettingsAvailable && (
                <p className="rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-700 sm:col-span-2">
                  Entegrasyon alanlarını kullanmak için
                  `supabase/source-integration-settings.sql` dosyasını
                  çalıştırın.
                </p>
              )}
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-xl border border-black/10 px-5 py-3 font-bold"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={pending}
                className="orange-button px-5 py-3 disabled:opacity-50"
              >
                {pending ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function SourceField({
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
      <span className="mb-2 block text-sm font-bold">{label}</span>
      {children}
    </label>
  );
}

function typeLabel(type: string) {
  if (type === "marketplace") return "Pazar yeri";
  if (type === "refurbished") return "Yenilenmiş";
  if (type === "retailer") return "Perakendeci";
  return type || "Diğer";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function cronScheduleLabel(value: string) {
  const labels: Record<string, string> = {
    "0 * * * *": "Her saat",
    "0 */3 * * *": "3 saatte bir",
    "0 */6 * * *": "6 saatte bir",
    "0 */12 * * *": "12 saatte bir",
    "0 3 * * *": "Günde bir",
  };
  return labels[value] ?? value;
}

function createSlug(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
