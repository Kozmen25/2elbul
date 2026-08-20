"use client";

import Link from "next/link";
import { Mail, TriangleAlert } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { resetPassword } from "@/app/auth/actions";

export function ResetRequestForm() {
  const initialState: Awaited<ReturnType<typeof resetPassword>> = {
    status: "idle",
    message: "",
  };
  const [state, formAction] = useActionState(resetPassword, initialState);

  return (
    <form action={formAction} className="mt-7 rounded-3xl border border-black/8 bg-white p-5 sm:p-8">
      {state.message && (
        <div
          className={`mb-5 flex gap-3 rounded-xl border p-4 text-sm ${
            state.status === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          <TriangleAlert size={18} className="mt-0.5 shrink-0" />
          <p className="font-semibold">{state.message}</p>
        </div>
      )}

      {state.status === "success" ? (
        <div className="py-6 text-center">
          <p className="font-bold">Bağlantı gönderildi</p>
          <p className="mt-2 text-sm text-black/50">
            E-postanı kontrol et. Resmî bir talep olmasa bile güvenlik gereği bu
            mesajı gösteriyoruz.
          </p>
          <Link href="/giris" className="orange-button mt-6 inline-block py-3">
            Giriş sayfasına dön
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-5">
            <label>
              <span className="mb-2 block text-sm font-bold">E-posta</span>
              <span className="relative block">
                <Mail
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-black/35"
                />
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  className="field h-13 pl-11 pr-4"
                  placeholder="ornek@email.com"
                />
              </span>
            </label>
          </div>
          <ResetSubmitButton />
        </>
      )}
    </form>
  );
}

function ResetSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="orange-button mt-6 w-full py-4 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Gönderiliyor..." : "Sıfırlama bağlantısı gönder"}
    </button>
  );
}
