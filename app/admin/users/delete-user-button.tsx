"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteUser } from "./actions";

export function DeleteUserButton({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function confirmDelete() {
    startTransition(async () => {
      const result = await deleteUser(userId);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="grid size-9 place-items-center rounded-lg border border-red-200 text-red-600"
        aria-label="Kullanıcıyı sil"
      >
        <Trash2 size={16} />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h2 className="text-xl font-black">Kullanıcıyı sil</h2>
            <p className="mt-3 text-sm leading-6 text-black/55">
              <strong>{email}</strong> hesabı kalıcı olarak silinecek. Bu işlem
              geri alınamaz.
            </p>
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
                onClick={confirmDelete}
                className="rounded-xl bg-red-600 px-4 py-3 font-bold text-white disabled:opacity-50"
              >
                {pending ? "Siliniyor..." : "Kalıcı olarak sil"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
