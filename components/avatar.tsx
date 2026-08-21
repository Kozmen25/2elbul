"use client";

import Image from "next/image";
import { useRef, useState } from "react";

type Props = {
  src?: string | null;
  name?: string | null;
  email?: string | null;
  onChanged?: () => void;
  uploadAction: (formData: FormData) => Promise<{ ok: boolean; message: string }>;
  deleteAction: () => Promise<{ ok: boolean; message: string }>;
};

function initialsOf(name?: string | null, email?: string | null) {
  const base = (name ?? email ?? "?").trim();
  const words = base.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].charAt(0).toLocaleUpperCase("tr");
  return (
    words[0].charAt(0) + words[words.length - 1].charAt(0)
  ).toLocaleUpperCase("tr");
}

export function AvatarImage({
  src,
  name,
  email,
  className = "",
}: {
  src?: string | null;
  name?: string | null;
  email?: string | null;
  className?: string;
}) {
  if (src) {
    return (
      <Image
        src={src}
        alt={name || email || "Avatar"}
        fill
        unoptimized
        sizes="(max-width: 768px) 96px, 96px"
        className={`object-cover ${className}`}
        draggable={false}
      />
    );
  }
  return (
    <span
      className={`relative grid place-items-center bg-[#fff1e7] font-black uppercase text-[#ff6b00] ${className}`}
    >
      {initialsOf(name, email)}
    </span>
  );
}

/**
 * Avatar control with a built-in default ring. Used by the profile card on
 * /hesabim; header initials fallback lives in header-client.
 */
export function AvatarControl({
  src,
  name,
  email,
  onChanged,
  uploadAction,
  deleteAction,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "delete" | null>(null);
  const [status, setStatus] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  async function handleUpload(formData: FormData) {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    formData.delete("file");
    formData.set("file", file);
    setBusy("upload");
    setStatus(null);
    const result = await uploadAction(formData);
    setBusy(null);
    setStatus(result);
    if (fileRef.current) fileRef.current.value = "";
    if (result.ok) onChanged?.();
  }

  async function handleDelete() {
    setBusy("delete");
    setStatus(null);
    const result = await deleteAction();
    setBusy(null);
    setStatus(result);
    if (result.ok) onChanged?.();
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative size-24 overflow-hidden rounded-3xl border border-black/8 bg-[#f4f1ea] shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
        <AvatarImage
          src={src}
          name={name}
          email={email}
          className="flex size-full items-center justify-center text-3xl"
        />
      </div>
        <AvatarImage
          src={src}
          name={name}
          email={email}
          className="flex size-full items-center justify-center text-3xl"
        />
      </div>

      {status ? (
        <p
          className={`text-center text-xs font-semibold ${
            status.ok ? "text-green-600" : "text-red-600"
          }`}
        >
          {status.message}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          id="avatar-file-input"
          onChange={(e) => {
            if (e.target.files?.[0]) {
              void handleUpload(new FormData());
            }
          }}
        />
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => fileRef.current?.click()}
          className="orange-button px-4 py-2.5 text-sm disabled:opacity-60"
        >
          {busy === "upload" ? "Yükleniyor…" : "Fotoğraf yükle"}
        </button>
        {src ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void handleDelete()}
            className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
          >
            {busy === "delete" ? "Kaldırılıyor…" : "Kaldır"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
