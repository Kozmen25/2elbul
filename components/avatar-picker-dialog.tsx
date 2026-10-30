"use client";

import { X } from "lucide-react";
import { useRef, useState } from "react";
import { AvatarPicker } from "@/components/avatar-picker";
import { PRESET_AVATARS, presetAvatarUrl } from "@/lib/preset-avatars";

/**
 * Compact avatar field for forms: one row with the current choice and an
 * "Avatar seç" button that opens the collection in a modal. The choice is
 * written to a hidden input named `name`. Avatar images load only when the
 * modal is opened.
 */
export function AvatarPickerDialog({ name }: { name: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState("");
  const [draft, setDraft] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const selectedAvatar = PRESET_AVATARS.find((avatar) => avatar.id === selected);

  function open() {
    setDraft(selected);
    setIsOpen(true);
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  function confirm() {
    setSelected(draft);
    close();
  }

  return (
    <div>
      <input type="hidden" name={name} value={selected} />

      <div className="flex items-center gap-3 rounded-xl border border-black/10 bg-[#fafaf8] px-3 py-2.5">
        {selectedAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={presetAvatarUrl(selectedAvatar.id)}
            alt=""
            className="size-10 shrink-0 rounded-full object-cover ring-1 ring-black/10"
            draggable={false}
          />
        ) : (
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-[#E4ECFF] text-sm font-black text-[#2A4FBF]"
          >
            ?
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">
            {selectedAvatar ? selectedAvatar.label : "Profil avatarı"}
          </span>
          <span className="block text-xs text-black/60">
            {selectedAvatar ? "Seçildi" : "İsteğe bağlı, seçmezsen otomatik atanır"}
          </span>
        </span>
        <button
          type="button"
          onClick={open}
          aria-haspopup="dialog"
          className="shrink-0 rounded-lg border border-black/15 bg-white px-3 py-2 transition hover:border-[#3B66E0]/50 hover:text-[#2A4FBF]"
        >
          {/* globals.css resets button fonts, so the text styles sit on the span. */}
          <span className="text-sm font-bold">{selectedAvatar ? "Değiştir" : "Avatar seç"}</span>
        </button>
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby="avatar-dialog-title"
        onClose={() => setIsOpen(false)}
        onClick={(event) => {
          // A click on the backdrop lands on the dialog element itself.
          if (event.target === event.currentTarget) close();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-0 shadow-[0_24px_80px_rgba(0,0,0,0.25)] backdrop:bg-[#0B1530]/55"
      >
        <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
          <h2 id="avatar-dialog-title" className="text-base font-black">
            Avatar seç
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Kapat"
            className="grid size-8 place-items-center rounded-lg text-black/60 transition hover:bg-black/5 hover:text-black"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4">
          {isOpen ? (
            <AvatarPicker
              key={selected}
              currentPresetId={selected || null}
              onChange={setDraft}
              gridClassName="grid-cols-5"
            />
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-black/10 px-5 py-4">
          <button
            type="button"
            onClick={close}
            className="rounded-lg px-4 py-2.5 text-black/70 transition hover:bg-black/5"
          >
            <span className="text-sm font-bold">Vazgeç</span>
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!draft}
            className="rounded-lg bg-[#3B66E0] px-4 py-2.5 text-white transition hover:bg-[#2C4FB8] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="text-sm font-bold">Seç</span>
          </button>
        </div>
      </dialog>
    </div>
  );
}
