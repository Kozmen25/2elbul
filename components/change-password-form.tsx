"use client";

import { CircleCheck, LockKeyhole, TriangleAlert } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { changePassword, type AuthState } from "@/app/auth/actions";
import { MIN_PASSWORD_LENGTH, PASSWORD_HINT } from "@/lib/auth/password-policy";

const initialState: AuthState = { status: "idle", message: "" };

export function ChangePasswordForm() {
  const [state, formAction] = useActionState(changePassword, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // Don't leave the old and new passwords sitting in the fields after success.
  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="grid max-w-md gap-4">
      {state.message && (
        <div
          role="status"
          className={`flex gap-3 rounded-xl border p-4 text-sm ${
            state.status === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {state.status === "success" ? (
            <CircleCheck size={18} className="mt-0.5 shrink-0" />
          ) : (
            <TriangleAlert size={18} className="mt-0.5 shrink-0" />
          )}
          <p className="font-semibold">{state.message}</p>
        </div>
      )}

      <PasswordField name="currentPassword" label="Mevcut şifre" autoComplete="current-password" />
      <PasswordField
        name="password"
        label="Yeni şifre"
        autoComplete="new-password"
        minLength={MIN_PASSWORD_LENGTH}
        placeholder={PASSWORD_HINT}
      />
      <PasswordField
        name="confirmPassword"
        label="Yeni şifre tekrarı"
        autoComplete="new-password"
        minLength={MIN_PASSWORD_LENGTH}
      />

      <SubmitButton />
    </form>
  );
}

function PasswordField({
  name,
  label,
  autoComplete,
  minLength,
  placeholder,
}: {
  name: string;
  label: string;
  autoComplete: string;
  minLength?: number;
  placeholder?: string;
}) {
  return (
    <label>
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <span className="relative block">
        <LockKeyhole size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-black/35" />
        <input
          type="password"
          name={name}
          autoComplete={autoComplete}
          required
          minLength={minLength}
          placeholder={placeholder}
          className="field h-13 pl-11 pr-4"
        />
      </span>
    </label>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="orange-button w-full py-4 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-8"
    >
      {pending ? "Güncelleniyor..." : "Şifremi değiştir"}
    </button>
  );
}
