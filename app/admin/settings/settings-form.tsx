"use client";

import { FormEvent, useState, useTransition } from "react";
import {
  saveMaintenanceSettings,
  saveSiteGeneralSettings,
  type SettingsActionResult,
} from "./actions";

export function SettingsForm({
  general,
  maintenance,
  settingsAvailable,
}: {
  general: { siteName: string; siteDescription: string };
  maintenance: { enabled: boolean; message: string };
  settingsAvailable: boolean;
}) {
  const [siteName, setSiteName] = useState(general.siteName);
  const [siteDescription, setSiteDescription] = useState(
    general.siteDescription,
  );
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(
    maintenance.enabled,
  );
  const [maintenanceMessage, setMaintenanceMessage] = useState(
    maintenance.message,
  );
  const [message, setMessage] = useState<SettingsActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function saveGeneral(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await saveSiteGeneralSettings({ siteName, siteDescription });
      setMessage(result);
    });
  }

  function saveMaintenance(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await saveMaintenanceSettings({
        enabled: maintenanceEnabled,
        message: maintenanceMessage,
      });
      setMessage(result);
    });
  }

  return (
    <>
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

      {!settingsAvailable && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          Ayarları kaydetmek için `supabase/site-settings.sql` migration
          dosyasını çalıştırın.
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <form
          onSubmit={saveGeneral}
          className="rounded-2xl border border-black/7 bg-white p-5 sm:p-6"
        >
          <h2 className="text-lg font-black">Site bilgileri</h2>
          <div className="mt-5 grid gap-4">
            <label className="text-sm font-bold">
              Site adı
              <input
                className="field mt-2 px-3 py-3"
                value={siteName}
                onChange={(event) => setSiteName(event.target.value)}
                disabled={!settingsAvailable || pending}
                required
              />
            </label>
            <label className="text-sm font-bold">
              Site açıklaması
              <textarea
                className="field mt-2 min-h-28 resize-y px-3 py-3"
                value={siteDescription}
                onChange={(event) => setSiteDescription(event.target.value)}
                disabled={!settingsAvailable || pending}
                required
              />
            </label>
            <button
              type="submit"
              disabled={!settingsAvailable || pending}
              className="orange-button py-3 disabled:opacity-50"
            >
              {pending ? "Kaydediliyor..." : "Site bilgilerini kaydet"}
            </button>
          </div>
        </form>

        <div className="grid gap-5">
          <form
            onSubmit={saveMaintenance}
            className="rounded-2xl border border-black/7 bg-white p-5 sm:p-6"
          >
            <h2 className="text-lg font-black">Bakım modu</h2>
            <p className="mt-2 text-sm leading-6 text-black/50">
              Etkinleştirildiğinde ziyaretçilere bakım ekranı gösterilir. Admin
              paneli erişilebilir kalır.
            </p>
            <label className="mt-5 flex items-center justify-between rounded-xl bg-[#fafaf8] p-4">
              <span className="font-bold">Bakım modunu etkinleştir</span>
              <input
                type="checkbox"
                checked={maintenanceEnabled}
                onChange={(event) => setMaintenanceEnabled(event.target.checked)}
                disabled={!settingsAvailable || pending}
                className="size-5 accent-[#ff6b00]"
              />
            </label>
            <label className="mt-4 block text-sm font-bold">
              Bakım mesajı
              <textarea
                className="field mt-2 min-h-24 resize-y px-3 py-3"
                value={maintenanceMessage}
                onChange={(event) => setMaintenanceMessage(event.target.value)}
                disabled={!settingsAvailable || pending}
              />
            </label>
            <button
              type="submit"
              disabled={!settingsAvailable || pending}
              className="orange-button mt-4 w-full py-3 disabled:opacity-50"
            >
              {pending ? "Kaydediliyor..." : "Bakım ayarlarını kaydet"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
