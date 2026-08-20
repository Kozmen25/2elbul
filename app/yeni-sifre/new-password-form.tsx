"use client";

import Link from "next/link";
import { LockKeyhole, TriangleAlert } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updatePassword } from "@/app/auth/actions";

export function NewPasswordForm() {
  const initialState: Awaited<ReturnType<typeof updatePassword>> = {
    status: "idle",
    message: "",
  };
  const [state, formAction] = useActionState(updatePassword, initialState);

  return (
    <form
      action={formAction}
      className="mt-7 rounded-3xl border border-black/8 bg-white p-5 sm:p-8"
    >
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

      <div className="grid gap-5">
        <label>
          <span className="mb-2 block text-sm font-bold">Yeni şifre</span>
          <span className="relative block">
            <LockKeyhole
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-black/35"
            />
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              required
              minLength={6}
              className="field h-13 pl-11 pr-4"
              placeholder="En az 6 karakter"
            />
          </span>
        </label>

        <label>
          <span className="mb-2 block text-sm font-bold">Şifre tekrarı</span>
          <span className="relative block">
            <LockKeyhole
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-black/35"
            />
            <input
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              required
              minLength={6}
              className="field h-13 pl-11 pr-4"
              placeholder="Şifrenizi tekrar girin"
            />
          </span>
        </label>
      </div>

      <SubmitButton />

      <p className="mt-5 text-center text-sm text-black/50">
        Hesabını beklenmedik şekilde hatırladın mı?{" "}
        <Link
          href="/giris"
          className="font-bold text-[#ff6b00] hover:underline"
        >
          Giriş yap
        </Link>
      </p>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="orange-button mt-6 w-full py-4 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Kaydediliyor..." : "Şifremi güncelle"}
    </button>
  );
}
