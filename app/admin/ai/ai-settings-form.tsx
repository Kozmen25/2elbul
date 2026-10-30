"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";
import { AI_FEATURES, AI_LIMITS, MODEL_OPTIONS } from "@/lib/ai/config";
import type { AiSettingsView } from "@/lib/ai/settings";
import type { AiSettingsErrors } from "@/lib/ai/settings-validation";
import { saveAiSettingsAction, testGeminiAction, type AiActionResult } from "./actions";

const FLASH_KEY = "aiAdminFlash";
const CUSTOM_MODEL = "custom";

const KEY_SOURCE_LABELS = {
  panel: "Panelden kaydedilen anahtar kullanılıyor",
  env: "GEMINI_API_KEY ortam değişkeni kullanılıyor",
  none: "Henüz anahtar tanımlı değil",
} as const;

export function AiSettingsForm({ settings }: { settings: AiSettingsView }) {
  const knownModel = MODEL_OPTIONS.some((option) => option.id === settings.model);

  const [enabled, setEnabled] = useState(settings.enabled);
  const [apiKey, setApiKey] = useState("");
  const [keyLabel, setKeyLabel] = useState(settings.keyLabel);
  const [projectName, setProjectName] = useState(settings.projectName);
  const [projectNumber, setProjectNumber] = useState(settings.projectNumber);
  const [modelChoice, setModelChoice] = useState(knownModel ? settings.model : CUSTOM_MODEL);
  const [customModel, setCustomModel] = useState(knownModel ? "" : settings.model);
  const [features, setFeatures] = useState(settings.features);
  const [minConfidence, setMinConfidence] = useState(String(settings.minConfidence));
  const [dailyLimit, setDailyLimit] = useState(String(settings.dailyRequestLimit));
  const [timeoutSeconds, setTimeoutSeconds] = useState(String(settings.timeoutMs / 1000));
  const [result, setResult] = useState<AiActionResult | null>(null);
  const [errors, setErrors] = useState<AiSettingsErrors>({});
  const [pending, startTransition] = useTransition();

  // Status cards and the log are server-rendered; after an action the page is
  // reloaded (router.refresh() leaves buttons stuck in this admin layout) and
  // the message is carried across the reload.
  useEffect(() => {
    try {
      const flash = window.sessionStorage.getItem(FLASH_KEY);
      if (flash) {
        window.sessionStorage.removeItem(FLASH_KEY);
        setResult(JSON.parse(flash) as AiActionResult);
      }
    } catch {
      // storage unavailable: the message is simply not shown after the reload
    }
  }, []);

  function reloadWithMessage(message: AiActionResult) {
    try {
      window.sessionStorage.setItem(FLASH_KEY, JSON.stringify(message));
    } catch {
      // see above
    }
    window.location.reload();
  }

  function save(event: FormEvent) {
    event.preventDefault();
    setResult(null);
    setErrors({});
    startTransition(async () => {
      const response = await saveAiSettingsAction({
        enabled,
        apiKey,
        keyLabel,
        projectName,
        projectNumber,
        model: modelChoice === CUSTOM_MODEL ? customModel : modelChoice,
        featureSearch: features.search,
        featureClassification: features.classification,
        featureMatching: features.matching,
        minConfidence: Number(minConfidence.replace(",", ".")),
        dailyRequestLimit: Number(dailyLimit),
        timeoutMs: Math.round(Number(timeoutSeconds.replace(",", ".")) * 1000),
      });
      setErrors(response.errors ?? {});
      if (response.errors) {
        setResult(response);
        return;
      }
      reloadWithMessage(response);
    });
  }

  function testConnection() {
    setResult(null);
    startTransition(async () => {
      reloadWithMessage(await testGeminiAction());
    });
  }

  const keyBlocked = !settings.encryptionKeyConfigured;

  return (
    <form onSubmit={save} noValidate className="rounded-2xl border border-black/7 bg-white p-5 sm:p-6">
      <h2 className="text-lg font-black">Gemini ayarları</h2>
      <p className="mt-2 text-sm leading-6 text-black/50">
        Ürün tanıma, kategori belirleme, arama ve eşleştirme için Google Gemini kullanılır. AI kapalıyken ya da
        başarısız olduğunda site mevcut kurallı akışıyla aynen çalışmaya devam eder.
      </p>

      {result && (
        <div
          role="status"
          className={`mt-4 rounded-xl border p-4 text-sm font-bold ${
            result.ok ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          <p>{result.message}</p>
          {result.detail && <p className="mt-1 break-words font-mono text-xs font-normal opacity-80">{result.detail}</p>}
        </div>
      )}

      <label className="mt-5 flex items-center justify-between rounded-xl bg-[#fafaf8] p-4">
        <span className="font-bold">AI&apos;ı etkinleştir</span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
          disabled={pending}
          className="size-5 accent-[#3B66E0]"
        />
      </label>

      <h3 className="mt-6 text-sm font-black uppercase tracking-[0.12em] text-black/40">Bağlantı</h3>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="API anahtarı" error={errors.apiKey}>
            <input
              className="field mt-2 px-3 py-3 font-mono"
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={settings.keyHint ? `${settings.keyHint} (değiştirmek için yeni anahtar yapıştırın)` : "Google AI Studio API anahtarı"}
              autoComplete="off"
              spellCheck={false}
              disabled={pending || keyBlocked}
            />
          </Field>
          <p className="mt-1.5 text-xs text-black/45">
            {KEY_SOURCE_LABELS[settings.keySource]}
            {settings.keyHint ? ` (${settings.keyHint})` : ""}. Anahtar veritabanında şifreli saklanır ve bu ekranda bir
            daha gösterilmez.
          </p>
          {keyBlocked && (
            <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
              <code>EMAIL_SETTINGS_ENCRYPTION_KEY</code> ortam değişkeni tanımlı değil; anahtar panelden kaydedilemez.
              Anahtarı <code>GEMINI_API_KEY</code> ortam değişkeni olarak da verebilirsiniz.
            </p>
          )}
        </div>

        <Field label="Anahtar adı" error={errors.keyLabel}>
          <input className="field mt-2 px-3 py-3" value={keyLabel} onChange={(e) => setKeyLabel(e.target.value)} placeholder="2elbulkey" disabled={pending} />
        </Field>
        <Field label="Proje numarası" error={errors.projectNumber}>
          <input className="field mt-2 px-3 py-3" value={projectNumber} onChange={(e) => setProjectNumber(e.target.value)} inputMode="numeric" placeholder="828979570202" disabled={pending} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Proje adı" error={errors.projectName}>
            <input className="field mt-2 px-3 py-3" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="projects/828979570202" disabled={pending} />
          </Field>
        </div>
      </div>

      <h3 className="mt-6 text-sm font-black uppercase tracking-[0.12em] text-black/40">Model</h3>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <Field label="Gemini modeli" error={errors.model}>
          <select className="field mt-2 px-3 py-3" value={modelChoice} onChange={(e) => setModelChoice(e.target.value)} disabled={pending}>
            {MODEL_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
            <option value={CUSTOM_MODEL}>Başka bir model…</option>
          </select>
        </Field>
        {modelChoice === CUSTOM_MODEL && (
          <Field label="Model adı" error={errors.model}>
            <input className="field mt-2 px-3 py-3 font-mono" value={customModel} onChange={(e) => setCustomModel(e.target.value)} placeholder="gemini-3.5-flash-lite" disabled={pending} />
          </Field>
        )}
      </div>
      <p className="mt-2 text-xs text-black/45">
        Kısa başlık ve sorgularla çalıştığımız için en ekonomik &quot;Flash-Lite&quot; modeli yeterlidir.
      </p>

      <h3 className="mt-6 text-sm font-black uppercase tracking-[0.12em] text-black/40">Özellikler</h3>
      <div className="mt-3 grid gap-2">
        {AI_FEATURES.map((feature) => (
          <label key={feature.id} className="flex items-start justify-between gap-4 rounded-xl border border-black/8 p-4">
            <span>
              <span className="block font-bold">{feature.label}</span>
              <span className="mt-1 block text-xs leading-5 text-black/50">{feature.description}</span>
            </span>
            <input
              type="checkbox"
              checked={features[feature.id]}
              onChange={(event) => setFeatures((current) => ({ ...current, [feature.id]: event.target.checked }))}
              disabled={pending}
              className="mt-1 size-5 shrink-0 accent-[#3B66E0]"
            />
          </label>
        ))}
      </div>

      <h3 className="mt-6 text-sm font-black uppercase tracking-[0.12em] text-black/40">Maliyet ve güvenlik</h3>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <Field label="24 saatte en çok istek" error={errors.dailyRequestLimit}>
          <input className="field mt-2 px-3 py-3" value={dailyLimit} onChange={(e) => setDailyLimit(e.target.value)} inputMode="numeric" disabled={pending} />
        </Field>
        <Field label="Asgari güven (0-1)" error={errors.minConfidence}>
          <input className="field mt-2 px-3 py-3" value={minConfidence} onChange={(e) => setMinConfidence(e.target.value)} inputMode="decimal" disabled={pending} />
        </Field>
        <Field label="Zaman aşımı (sn)" error={errors.timeoutMs}>
          <input className="field mt-2 px-3 py-3" value={timeoutSeconds} onChange={(e) => setTimeoutSeconds(e.target.value)} inputMode="decimal" disabled={pending} />
        </Field>
      </div>
      <p className="mt-2 text-xs leading-5 text-black/45">
        İstek sınırı dolunca AI otomatik durur, site kurallı akışa döner. Güven eşiğinin altındaki öneriler yok
        sayılır ({AI_LIMITS.minConfidence.min}–{AI_LIMITS.minConfidence.max}). Aynı arama cümlesi 24 saat boyunca
        önbellekten yanıtlanır, tekrar istek atılmaz.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="orange-button px-6 py-3 disabled:opacity-50">
          {pending ? "Çalışıyor..." : "Ayarları kaydet"}
        </button>
        <button
          type="button"
          onClick={testConnection}
          disabled={pending}
          className="rounded-xl border border-black/12 px-5 py-3 text-sm font-bold transition hover:border-[#3B66E0]/40 disabled:opacity-50"
        >
          Bağlantıyı test et
        </button>
      </div>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-bold">
      {label}
      {children}
      {error && <span className="mt-1.5 block text-xs font-semibold text-red-600">{error}</span>}
    </label>
  );
}
