"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";
import type { EmailSettingsView } from "@/lib/email/settings";
import { SMTP_PRESETS, type EmailSettingsErrors } from "@/lib/email/settings-validation";
import {
  saveEmailSettingsAction,
  sendTestEmailAction,
  verifySmtpAction,
  type EmailActionResult,
} from "./actions";

type Props = {
  settings: EmailSettingsView;
  /** Prefills the test e-mail recipient. */
  adminEmail: string;
};

const CUSTOM_PRESET = "custom";
const FLASH_KEY = "emailAdminFlash";

export function EmailSettingsForm({ settings, adminEmail }: Props) {
  const [enabled, setEnabled] = useState(settings.enabled);
  const [preset, setPreset] = useState(CUSTOM_PRESET);
  const [host, setHost] = useState(settings.host);
  const [port, setPort] = useState(settings.port ? String(settings.port) : "587");
  const [secure, setSecure] = useState(settings.secure);
  const [username, setUsername] = useState(settings.username);
  const [password, setPassword] = useState("");
  const [fromEmail, setFromEmail] = useState(settings.fromEmail);
  const [fromName, setFromName] = useState(settings.fromName || "2ElBul");
  const [replyTo, setReplyTo] = useState(settings.replyTo);
  const [testTo, setTestTo] = useState(adminEmail);
  const [result, setResult] = useState<EmailActionResult | null>(null);
  const [errors, setErrors] = useState<EmailSettingsErrors>({});
  const [pending, startTransition] = useTransition();

  // The status cards and the log table are rendered on the server. After an
  // action the page is reloaded to refresh them, and the action's message is
  // carried across the reload. (router.refresh() is avoided on purpose: in this
  // admin layout it leaves the buttons stuck in their pending state.)
  useEffect(() => {
    try {
      const flash = window.sessionStorage.getItem(FLASH_KEY);
      if (flash) {
        window.sessionStorage.removeItem(FLASH_KEY);
        setResult(JSON.parse(flash) as EmailActionResult);
      }
    } catch {
      // storage unavailable: the message is simply not shown after the reload
    }
  }, []);

  function reloadWithMessage(message: EmailActionResult) {
    try {
      window.sessionStorage.setItem(FLASH_KEY, JSON.stringify(message));
    } catch {
      // see above
    }
    window.location.reload();
  }

  const activePreset = SMTP_PRESETS.find((item) => item.id === preset) ?? null;

  function applyPreset(id: string) {
    setPreset(id);
    const selected = SMTP_PRESETS.find((item) => item.id === id);
    if (!selected) return;
    setHost(selected.host);
    setPort(String(selected.port));
    setSecure(selected.secure);
    if (selected.username) setUsername(selected.username);
  }

  function changeSecure(value: boolean) {
    setSecure(value);
    // Keep the conventional port in step with the TLS choice unless the admin
    // typed something unusual.
    if (value && (port === "587" || port === "25")) setPort("465");
    if (!value && port === "465") setPort("587");
  }

  function save(event: FormEvent) {
    event.preventDefault();
    setResult(null);
    setErrors({});
    startTransition(async () => {
      const response = await saveEmailSettingsAction({
        enabled,
        host,
        port,
        secure,
        username,
        password,
        fromEmail,
        fromName,
        replyTo,
      });
      setErrors(response.errors ?? {});
      // Field errors mean nothing was saved: stay on the form.
      if (response.errors) {
        setResult(response);
        return;
      }
      reloadWithMessage(response);
    });
  }

  function run(action: () => Promise<EmailActionResult>) {
    setResult(null);
    startTransition(async () => {
      reloadWithMessage(await action());
    });
  }

  return (
    <form onSubmit={save} noValidate className="rounded-2xl border border-black/7 bg-white p-5 sm:p-6">
      <h2 className="text-lg font-black">SMTP ayarları</h2>
      <p className="mt-2 text-sm leading-6 text-black/50">
        E-posta servisinizin (Resend, Brevo, Gmail vb.) SMTP bilgilerini girin. Kayıt onayı, şifre sıfırlama ve fiyat
        alarmı e-postaları bu ayarlarla gönderilir.
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

      {!settings.encryptionKeyConfigured && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          <code>EMAIL_SETTINGS_ENCRYPTION_KEY</code> ortam değişkeni tanımlı değil; SMTP şifresi bu olmadan
          kaydedilemez. Sayfanın altındaki kurulum adımlarına bakın.
        </div>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold sm:col-span-2">
          Hazır ayar
          <select
            className="field mt-2 px-3 py-3"
            value={preset}
            onChange={(event) => applyPreset(event.target.value)}
            disabled={pending}
          >
            <option value={CUSTOM_PRESET}>Özel (elle gireceğim)</option>
            {SMTP_PRESETS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <Field label="SMTP sunucusu" error={errors.host}>
          <input
            className="field mt-2 px-3 py-3"
            value={host}
            onChange={(event) => setHost(event.target.value)}
            placeholder="smtp.resend.com"
            autoComplete="off"
            disabled={pending}
          />
        </Field>

        <Field label="Port" error={errors.port}>
          <input
            className="field mt-2 px-3 py-3"
            value={port}
            onChange={(event) => setPort(event.target.value)}
            inputMode="numeric"
            placeholder="587"
            disabled={pending}
          />
        </Field>

        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-bold">Güvenli bağlantı</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <RadioCard
              checked={secure}
              onChange={() => changeSecure(true)}
              title="TLS (SSL)"
              description="Bağlantı baştan şifreli. Genellikle port 465."
              disabled={pending}
            />
            <RadioCard
              checked={!secure}
              onChange={() => changeSecure(false)}
              title="STARTTLS"
              description="Bağlantı sonradan şifrelenir. Genellikle port 587."
              disabled={pending}
            />
          </div>
        </fieldset>

        <Field label="Kullanıcı adı" error={errors.username}>
          <input
            className="field mt-2 px-3 py-3"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="off"
            disabled={pending}
          />
        </Field>

        <Field label="Şifre / API anahtarı" error={errors.password}>
          <input
            type="password"
            className="field mt-2 px-3 py-3"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            placeholder={settings.passwordSet ? "•••••••• kayıtlı — değiştirmek için yazın" : (activePreset?.passwordHint ?? "")}
            disabled={pending}
          />
          {activePreset && <span className="mt-1 block text-xs font-normal text-black/45">{activePreset.passwordHint}</span>}
        </Field>

        <Field label="Gönderen e-posta adresi" error={errors.fromEmail}>
          <input
            type="email"
            className="field mt-2 px-3 py-3"
            value={fromEmail}
            onChange={(event) => setFromEmail(event.target.value)}
            placeholder="bildirim@2elbul.com"
            disabled={pending}
          />
          <span className="mt-1 block text-xs font-normal text-black/45">
            Alan adının e-posta servisinizde doğrulanmış olması gerekir.
          </span>
        </Field>

        <Field label="Gönderen adı" error={errors.fromName}>
          <input
            className="field mt-2 px-3 py-3"
            value={fromName}
            onChange={(event) => setFromName(event.target.value)}
            disabled={pending}
          />
        </Field>

        <Field label="Yanıt adresi (isteğe bağlı)" error={errors.replyTo}>
          <input
            type="email"
            className="field mt-2 px-3 py-3"
            value={replyTo}
            onChange={(event) => setReplyTo(event.target.value)}
            placeholder="destek@2elbul.com"
            disabled={pending}
          />
        </Field>
      </div>

      <label className="mt-5 flex items-center justify-between rounded-xl bg-[#fafaf8] p-4">
        <span>
          <span className="block font-bold">E-posta servisini etkinleştir</span>
          <span className="block text-xs font-normal text-black/45">
            Kapalıyken kayıt ve şifre sıfırlama e-postaları gönderilmez.
          </span>
        </span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
          disabled={pending}
          className="size-5 accent-[#3B66E0]"
        />
      </label>

      <button type="submit" disabled={pending} className="orange-button mt-5 w-full py-3 disabled:opacity-50">
        {pending ? "İşleniyor..." : "Ayarları kaydet"}
      </button>

      <div className="mt-6 border-t border-black/7 pt-5">
        <h3 className="font-black">Bağlantıyı dene</h3>
        <p className="mt-1 text-sm text-black/50">Önce ayarları kaydedin; deneme kayıtlı ayarlarla yapılır.</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="email"
            className="field px-3 py-3 sm:flex-1"
            value={testTo}
            onChange={(event) => setTestTo(event.target.value)}
            placeholder="test@ornek.com"
            aria-label="Test e-postası alıcısı"
            disabled={pending}
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => sendTestEmailAction(testTo))}
            className="rounded-xl bg-[#3B66E0] px-4 py-3 text-sm font-bold text-white hover:bg-[#2C4FB8] disabled:opacity-50"
          >
            Test e-postası gönder
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(verifySmtpAction)}
            className="rounded-xl border border-black/10 px-4 py-3 text-sm font-bold text-black/70 hover:bg-[#fafaf8] disabled:opacity-50"
          >
            Sadece bağlantıyı doğrula
          </button>
        </div>
      </div>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-bold">
      {label}
      {children}
      {error && <span className="mt-1 block text-xs font-bold text-red-600">{error}</span>}
    </label>
  );
}

function RadioCard({
  checked,
  onChange,
  title,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  title: string;
  description: string;
  disabled: boolean;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${
        checked ? "border-[#3B66E0] bg-[#EEF3FF]" : "border-black/10"
      }`}
    >
      <input type="radio" checked={checked} onChange={onChange} disabled={disabled} className="mt-1 accent-[#3B66E0]" />
      <span>
        <span className="block text-sm font-bold">{title}</span>
        <span className="block text-xs font-normal text-black/50">{description}</span>
      </span>
    </label>
  );
}
