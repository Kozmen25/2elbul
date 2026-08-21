"use client";

import { Check, ChevronDown, Loader2 } from "lucide-react";
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
  /**
   * Collapse the collection behind a toggle button (default `false`). When
   * true the grid is hidden until the button is pressed, and the currently
   * selected character stays visible in the button itself.
   */
  disclosure?: boolean;
};

/**
 * Grid of the 20 preset avatars. Two modes:
 *  - Signup: `onChange` reports the bare selection into a hidden form field.
 *  - Account profile: `onSelect` persists the choice via a server action.
 * `currentPresetId` marks which one (if any) is active.
 */
export function AvatarPicker({
  currentPresetId,
  onSelect,
  onChange,
  disclosure = false,
}: AvatarPickerProps) {
  const [selected, setSelected] = useState<string | null>(currentPresetId ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(!disclosure);

  const selectedAvatar = PRESET_AVATARS.find((a) => a.id === selected);

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

  const selectedLabel = selectedAvatar ? selectedAvatar.label : null;

  function handleToggle() {
    setError("");
    setOpen((o) => !o);
  }

  return (
    <div>
      {disclosure ? (
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={open}
          aria-controls="avatar-collection"
          className="flex w-full items-center gap-3 rounded-xl border border-black/10 bg-white px-3 py-2.5 text-left transition hover:border-[#ff6b00]/40"
        >
          {selectedAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={presetAvatarUrl(selectedAvatar.id)}
              alt=""
              className="size-9 shrink-0 rounded-lg object-cover ring-1 ring-black/10"
            />
          ) : (
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#fff1e7] text-xs font-black text-[#ff6b00]">
              ?
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1 text-xs font-bold text-black/45">
              Avatar koleksiyonu
              <span className="rounded-full bg-[#fff1e7] px-1.5 py-0.5 text-[10px] font-bold text-[#d95700]">
                {PRESET_AVATARS.length}
              </span>
            </span>
            <span className="mt-0.5 block text-sm font-bold">
              {selectedLabel
                ? selectedLabel
                : open
                  ? "Bir karakter seç"
                  : "Karakter seç"}
            </span>
          </span>
          <ChevronDown
            size={16}
            className={`shrink-0 text-black/40 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      ) : null}

      {open ? (
        <div className={disclosure ? "mt-3" : undefined}>
          {!disclosure ? (
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold text-black/45">
                {PRESET_AVATARS.length} özgün karakter
              </p>
              {selectedLabel ? (
                <p className="text-sm font-bold text-[#ff6b00]">{selectedLabel}</p>
              ) : null}
            </div>
          ) : null}
          <div
            id="avatar-collection"
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
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}
    </div>
  );
}
