"use client";

import { Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { PRESET_AVATARS, presetAvatarUrl } from "@/lib/preset-avatars";

type AvatarPickerProps = {
  currentPresetId?: string | null;
  /**
   * Persisting mode (account profile): selection is bubbled to the parent,
   * which calls a server action and returns the result.
   */
  onSelect?: (presetId: string) => Promise<{ ok: boolean; message?: string }>;
  /**
   * Local mode (signup): selection only updates internal state and reports the
   * chosen id synchronously so a parent can mirror it into a hidden form input.
   * When set, `onSelect` is ignored.
   */
  onChange?: (presetId: string) => void;
};

/**
 * Grid of the 20 preset avatars. Two modes:
 *  - Signup: `onChange` reports the bare selection into a hidden form field.
 *  - Account profile: `onSelect` persists the choice via a server action.
 * `currentPresetId` marks which one (if any) is active.
 */
export function AvatarPicker({ currentPresetId, onSelect, onChange }: AvatarPickerProps) {
  const [selected, setSelected] = useState<string | null>(currentPresetId ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  function handleSelect(id: string) {
    if (busy) return;
    setSelected(id);
    setError("");
    if (onChange) {
      onChange(id);
      return;
    }
    if (!onSelect) return;
    setBusy(id);
    void onSelect(id).then((result) => {
      if (!result.ok) {
        setError(result.message ?? "Avatar ayarlanamadı.");
      }
      setBusy(null);
    });
  }

  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Avatar seç"
        className="grid grid-cols-5 gap-2.5 sm:grid-cols-10"
      >
        {PRESET_AVATARS.map((avatar) => {
          const active = selected === avatar.id;
          const isBusy = busy === avatar.id;
          return (
            <button
              key={avatar.id}
              type="button"
              role="radio"
              aria-checked={active}
              title={avatar.label}
              onClick={() => handleSelect(avatar.id)}
              className={`relative aspect-square rounded-xl transition disabled:cursor-not-allowed disabled:opacity-60 ${
                active
                  ? "ring-2 ring-[#ff6b00] ring-offset-2"
                  : "ring-1 ring-black/10 hover:ring-[#ff6b00]/40"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={presetAvatarUrl(avatar.id)}
                alt={`${avatar.label} avatarı`}
                className="size-full rounded-xl object-cover"
                loading="lazy"
              />
              {active ? (
                <span className="absolute inset-0 grid place-items-center rounded-xl bg-[#ff6b00]/25">
                  <span className="grid size-6 place-items-center rounded-full bg-[#ff6b00] text-white">
                    {isBusy ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Check size={14} strokeWidth={3} />
                    )}
                  </span>
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {error ? <p className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}
    </div>
  );
}
