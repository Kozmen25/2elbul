"use client";

import { useState, useTransition } from "react";
import { saveNotificationSettings, setEmailNotifications } from "@/app/account/actions";
import {
  NOTIFICATION_KINDS,
  NOTIFICATION_KIND_INFO,
  type NotificationChannel,
  type NotificationKind,
} from "@/lib/notifications/preferences";

type Grid = Record<NotificationKind, Record<NotificationChannel, boolean>>;

type Props = {
  initialGrid: Grid;
  /** Account-wide switch for e-mail copies. */
  initialEmailEnabled: boolean;
  /** False while the admin has not switched the e-mail service on. */
  emailServiceReady: boolean;
};

export function NotificationPreferences({ initialGrid, initialEmailEnabled, emailServiceReady }: Props) {
  const [grid, setGrid] = useState(initialGrid);
  const [emailEnabled, setEmailEnabled] = useState(initialEmailEnabled);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function toggleChannel(kind: NotificationKind, channel: NotificationChannel, enabled: boolean) {
    const previous = grid;
    const next = { ...grid, [kind]: { ...grid[kind], [channel]: enabled } };
    setGrid(next);
    setMessage(null);
    startTransition(async () => {
      const result = await saveNotificationSettings(next);
      if (!result.ok) setGrid(previous);
      setMessage({ ok: result.ok, text: result.message });
    });
  }

  function toggleEmailMaster(enabled: boolean) {
    const previous = emailEnabled;
    setEmailEnabled(enabled);
    setMessage(null);
    startTransition(async () => {
      const result = await setEmailNotifications(enabled);
      if (!result.ok) setEmailEnabled(previous);
      setMessage({ ok: result.ok, text: result.message });
    });
  }

  return (
    <div>
      <label className="flex items-center justify-between gap-4 rounded-xl border border-black/8 bg-white p-4">
        <span>
          <span className="block font-bold">Bildirimleri e-postayla da gönder</span>
          <span className="block text-xs font-normal text-black/45">
            Kapalıyken hiçbir bildirim e-posta olarak gönderilmez. Şifre sıfırlama gibi hesap e-postaları her zaman
            gönderilir.
          </span>
        </span>
        <input
          type="checkbox"
          checked={emailEnabled}
          disabled={pending}
          onChange={(event) => toggleEmailMaster(event.target.checked)}
          className="size-5 shrink-0 accent-[#3B66E0]"
        />
      </label>

      {!emailServiceReady ? (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
          E-posta servisi şu an etkin değil; tercihlerin kaydedilir ama e-postalar servis açılınca gönderilmeye başlar.
          Site içi bildirimler çalışmaya devam eder.
        </p>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-xl border border-black/8 bg-white">
        <div className="hidden grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] gap-2 border-b border-black/8 bg-[#fafaf8] px-4 py-2.5 text-xs font-black uppercase tracking-wide text-black/45 sm:grid">
          <span>Bildirim</span>
          <span className="text-center">Site içi</span>
          <span className="text-center">E-posta</span>
        </div>
        <ul>
          {NOTIFICATION_KINDS.map((kind) => (
            <li
              key={kind}
              className="grid grid-cols-2 gap-x-2 gap-y-3 border-b border-black/6 px-4 py-3.5 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] sm:items-center"
            >
              <div className="col-span-2 min-w-0 sm:col-span-1">
                <p className="text-sm font-bold">{NOTIFICATION_KIND_INFO[kind].label}</p>
                <p className="mt-0.5 text-xs text-black/45">{NOTIFICATION_KIND_INFO[kind].description}</p>
              </div>
              <ChannelCheckbox
                label="Site içi"
                checked={grid[kind].in_app}
                disabled={pending}
                onChange={(enabled) => toggleChannel(kind, "in_app", enabled)}
              />
              <ChannelCheckbox
                label="E-posta"
                checked={grid[kind].email && emailEnabled}
                disabled={pending || !emailEnabled}
                onChange={(enabled) => toggleChannel(kind, "email", enabled)}
              />
            </li>
          ))}
        </ul>
      </div>

      {message ? (
        <p role="status" className={`mt-3 text-sm font-bold ${message.ok ? "text-green-700" : "text-red-600"}`}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}

function ChannelCheckbox({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm font-semibold sm:justify-center">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="size-5 accent-[#3B66E0]"
      />
      <span className="sm:sr-only">{label}</span>
    </label>
  );
}
