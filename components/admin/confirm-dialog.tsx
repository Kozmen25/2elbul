"use client";

import { useState, useTransition } from "react";

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  pendingLabel,
  danger = false,
  run,
}: {
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  danger?: boolean;
  run: () => Promise<{ ok: boolean; message: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await run();
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setOpen(false);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${
          danger
            ? "border border-red-200 bg-white text-red-600 hover:bg-red-50"
            : "border border-black/10 bg-white font-bold hover:bg-[#fafaf8]"
        }`}
      >
        {title}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h2 className="text-xl font-black">{title}</h2>
            <div className="mt-3 text-sm leading-6 text-black/55">
              {description}
            </div>
            {message && (
              <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {message}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-black/10 px-4 py-3 font-bold"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={confirm}
                className={`rounded-xl px-4 py-3 font-bold text-white disabled:opacity-50 ${
                  danger ? "bg-red-600" : "bg-[#ff6b00]"
                }`}
              >
                {pending ? pendingLabel : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
