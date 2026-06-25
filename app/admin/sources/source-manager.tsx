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

      <div className="grid w-full max-w-full min-w-0 gap-3 lg:hidden">
        {sources.map((source) => (
          <SourceCard
            key={source.id}
            source={source}
            pending={pending}
            publishModeAvailable={publishModeAvailable}
            runAction={runAction}
            openEdit={openEdit}
          />
        ))}
      </div>

      <div className="hidden w-full max-w-full min-w-0 overflow-x-auto rounded-2xl border border-black/8 bg-white [-webkit-overflow-scrolling:touch] lg:block">
        <table className="w-full min-w-[1000px] table-auto text-left text-sm">
          <thead className="bg-[#fafaf8] text-xs uppercase tracking-wide text-black/45">
            <tr>
              <th className="w-[150px] px-2.5 py-3">Kaynak</th>
              <th className="w-[90px] px-2.5 py-3">Tip</th>
              <th className="w-[75px] px-2.5 py-3">Durum</th>
              <th className="w-[80px] px-2.5 py-3">Mod</th>
              <th className="w-[105px] px-2.5 py-3">Entegrasyon</th>
              <th className="w-[95px] px-2.5 py-3">Plan</th>
              <th className="w-[115px] px-2.5 py-3">Son çalışma</th>
              <th className="w-[80px] px-2.5 py-3">Aktarılan</th>
              <th className="w-[55px] px-2.5 py-3 text-center">Link</th>
              <th className="sticky right-0 z-10 w-[155px] bg-[#fafaf8] px-2.5 py-3 text-right shadow-[-12px_0_20px_rgba(0,0,0,0.04)]">
                İşlemler
              </th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr key={source.id} className="border-t border-black/7">
                <td className="px-2.5 py-4">
                  <p className="font-black">{source.name}</p>
                  <p className="mt-1 font-mono text-xs text-black/40">
                    {source.slug}
                  </p>
                </td>
                <td className="px-2.5 py-4">
                  <span className="rounded-full bg-[#fff1e7] px-2.5 py-1 text-xs font-black text-[#d95700]">
                    {typeLabel(source.type)}
                  </span>
                </td>
                <td className="px-2.5 py-4">
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
                <td className="px-2.5 py-4">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-black ${
                      source.botListingStatus === "published"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {source.botListingStatus === "published"
                      ? "Direkt"
                      : "Pending"}
                  </span>
                </td>
                <td className="px-2.5 py-4">
                  <div className="flex flex-wrap gap-1">
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
                <td className="px-2.5 py-4">
                  <p className="text-xs font-bold">
                    {source.cronEnabled
                      ? cronScheduleLabel(source.cronSchedule)
                      : "Kapalı"}
                  </p>
                  <p className="mt-1 text-[11px] text-black/40">
                    Limit: {source.productLimit}
                  </p>
                </td>
                <td className="px-2.5 py-4 text-black/55">
                  {source.lastRunAt
                    ? formatDate(source.lastRunAt)
                    : "Henüz çalışmadı"}
                  {source.lastSuccess && (
                    <p className="mt-1 text-[11px] font-semibold text-green-700">
                      Son başarı: {formatDate(source.lastSuccess)}
                    </p>
                  )}
                </td>
                <td className="px-2.5 py-4 text-lg font-black">
                  {source.totalImported.toLocaleString("tr-TR")}
                </td>
                <td className="px-2.5 py-4 text-center">
                  {source.baseUrl ? (
                    <a
                      href={source.baseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-grid size-9 place-items-center rounded-lg border border-[#ff6b00]/20 bg-[#fff7f1] text-[#ff6b00]"
                      aria-label={`${source.name} sitesini aç`}
                    >
                      <ExternalLink size={16} />
                    </a>
                  ) : (
                    <span className="text-black/35">-</span>
                  )}
                </td>
                <td className="sticky right-0 z-10 bg-white px-2.5 py-4 shadow-[-12px_0_20px_rgba(0,0,0,0.04)]">
                  <div className="flex flex-wrap justify-end gap-1">
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
                      className="grid size-9 place-items-center rounded-lg border border-[#ff6b00]/25 bg-[#fff7f1] text-[#d95700] disabled:opacity-50"
                      title="Demo test çekimi"
                      aria-label={`${source.name} için demo test çekimi yap`}
                    >
                      <Bot size={15} />
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
                      className="grid size-9 place-items-center rounded-lg border border-purple-200 bg-purple-50 text-purple-700 disabled:cursor-not-allowed disabled:opacity-45"
                      title={
                        ["easycep", "getmobil"].includes(source.slug)
                          ? "Tek sayfalık sınırlı gerçek test çekimi"
                          : "Bu kaynak adaptörü hazırlanıyor"
                      }
                    >
                      <Globe2 size={15} />
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

function SourceCard({
  source,
  pending,
  publishModeAvailable,
  runAction,
  openEdit,
}: {
  source: AdminSource;
  pending: boolean;
  publishModeAvailable: boolean;
  runAction: (action: () => Promise<SourceActionResult>) => void;
  openEdit: (source: AdminSource) => void;
}) {
  const realBotReady = ["easycep", "getmobil"].includes(source.slug);

  return (
    <article className="min-w-0 rounded-2xl border border-black/8 bg-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.035)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-black">{source.name}</h3>
          <p className="mt-1 font-mono text-xs text-black/40">{source.slug}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${
            source.isActive
              ? "bg-green-100 text-green-700"
              : "bg-black/7 text-black/45"
          }`}
        >
          {source.isActive ? "Aktif" : "Pasif"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <InfoItem label="Tip" value={typeLabel(source.type)} />
        <InfoItem
          label="Bot modu"
          value={source.botListingStatus === "published" ? "Direkt" : "Pending"}
        />
        <InfoItem
          label="Plan"
          value={source.cronEnabled ? cronScheduleLabel(source.cronSchedule) : "Kapalı"}
        />
        <InfoItem
          label="Aktarılan"
          value={source.totalImported.toLocaleString("tr-TR")}
        />
        <InfoItem
          label="Limit"
          value={source.productLimit.toLocaleString("tr-TR")}
        />
        <InfoItem
          label="Son çalışma"
          value={source.lastRunAt ? formatDate(source.lastRunAt) : "Yok"}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-1">
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
        {source.integrationType !== "manual" && (
          <span className="rounded-full bg-black/7 px-2 py-1 text-[10px] font-black text-black/55">
            {source.integrationType.toUpperCase()}
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 min-[420px]:grid-cols-6">
        <ActionIconButton
          disabled={pending || !publishModeAvailable}
          title="Demo test çekimi"
          className="border-[#ff6b00]/25 bg-[#fff7f1] text-[#d95700]"
          onClick={() => {
            if (
              window.confirm(`${source.name} için 10 adet demo ilan üretilsin mi?`)
            ) {
              runAction(() => runDemoBot(source.id));
            }
          }}
        >
          <Bot size={16} />
        </ActionIconButton>
        <ActionIconButton
          disabled={pending || !publishModeAvailable || !realBotReady}
          title={realBotReady ? "Gerçek test çekimi" : "Hazırlanıyor"}
          className="border-purple-200 bg-purple-50 text-purple-700"
          onClick={() => {
            if (
              window.confirm(
                `${source.name} kategori sayfasından en fazla 10 gerçek ürün çekilsin mi?`,
              )
            ) {
              runAction(() => runRealBot(source.id));
            }
          }}
        >
          <Globe2 size={16} />
        </ActionIconButton>
        <ActionIconButton
          disabled={pending}
          title={source.isActive ? "Pasifleştir" : "Aktifleştir"}
          className={
            source.isActive
              ? "border-amber-200 text-amber-700"
              : "border-green-200 text-green-700"
          }
          onClick={() =>
            runAction(() => toggleSource(source.id, !source.isActive))
          }
        >
          <Power size={16} />
        </ActionIconButton>
        <ActionIconButton
          title="Düzenle"
          className="border-black/10"
          onClick={() => openEdit(source)}
        >
          <Pencil size={16} />
        </ActionIconButton>
        <ActionIconButton
          disabled={pending}
          title="Sil"
          className="border-red-200 text-red-600"
          onClick={() => {
            if (
              window.confirm(
                `${source.name} kaynağı ve tüm bot çalışma kayıtları silinsin mi?`,
              )
            ) {
              runAction(() => deleteSource(source.id));
            }
          }}
        >
          <Trash2 size={16} />
        </ActionIconButton>
        {source.baseUrl ? (
          <a
            href={source.baseUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Kaynak sitesini aç"
            className="grid h-10 place-items-center rounded-xl border border-[#ff6b00]/20 bg-[#fff7f1] text-[#ff6b00]"
          >
            <ExternalLink size={16} />
          </a>
        ) : (
          <span className="grid h-10 place-items-center rounded-xl border border-black/8 text-black/25">
            <ExternalLink size={16} />
          </span>
        )}
      </div>
    </article>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-[#fafaf8] p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.08em] text-black/35">
        {label}
      </p>
      <p className="mt-1 truncate text-xs font-black">{value}</p>
    </div>
  );
}

function ActionIconButton({
  children,
  className,
  disabled,
  title,
  onClick,
}: {
  children: React.ReactNode;
  className: string;
  disabled?: boolean;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`grid h-10 place-items-center rounded-xl border disabled:cursor-not-allowed disabled:opacity-45 ${className}`}
    >
      {children}
    </button>
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
