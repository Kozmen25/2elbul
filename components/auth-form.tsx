"use client";

import { MIN_PASSWORD_LENGTH, PASSWORD_HINT } from "@/lib/auth/password-policy";
import Link from "next/link";
import { Eye, EyeOff, LockKeyhole, Mail, TriangleAlert } from "lucide-react";
import { useActionState, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { AuthState } from "@/app/auth/actions";
import { AvatarPickerDialog } from "@/components/avatar-picker-dialog";

type AuthFormProps = {
  mode: "login" | "signup";
  action: (
    state: AuthState,
    formData: FormData,
  ) => Promise<AuthState>;
  next?: string;
  initialError?: string;
};

export function AuthForm({
  mode,
  action,
  next = "/",
  initialError = "",
}: AuthFormProps) {
  const formInitialState: AuthState = {
    status: initialError ? "error" : "idle",
    message: initialError,
  };
  const [state, formAction] = useActionState(action, formInitialState);
  const isLogin = mode === "login";

  return (
    <form action={formAction}>
      <input type="hidden" name="next" value={next} />

      {state.message && (
        <div
          role={state.status === "error" ? "alert" : "status"}
          className={`mb-5 flex gap-3 rounded-xl border p-3.5 text-sm ${
            state.status === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          <TriangleAlert size={18} className="mt-0.5 shrink-0" />
          <p className="font-semibold">{state.message}</p>
        </div>
      )}

      <div className="grid gap-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold">E-posta</span>
          <span className="relative block">
            <Mail
              size={18}
              aria-hidden="true"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-black/45"
            />
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              defaultValue={state.email ?? ""}
              className="field h-12 pl-11 pr-4"
              placeholder="ornek@email.com"
            />
          </span>
        </label>

        <PasswordField
          name="password"
          label="Şifre"
          autoComplete={isLogin ? "current-password" : "new-password"}
          minLength={isLogin ? undefined : MIN_PASSWORD_LENGTH}
          placeholder={isLogin ? "Şifreniz" : PASSWORD_HINT}
          trailingLink={
            isLogin ? (
              <Link
                href="/sifre-sifirla"
                className="text-sm font-semibold text-[#2A4FBF] hover:underline"
              >
                Şifremi unuttum
              </Link>
            ) : null
          }
        />

        {!isLogin && (
          <PasswordField
            name="confirmPassword"
            label="Şifre tekrarı"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            placeholder="Şifrenizi tekrar girin"
          />
        )}

        {!isLogin && <AvatarPickerDialog name="avatarPreset" />}
      </div>

      <SubmitButton label={isLogin ? "Giriş yap" : "Hesap oluştur"} />

      <p className="mt-5 text-center text-sm text-black/60">
        {isLogin ? "Henüz hesabınız yok mu?" : "Zaten hesabınız var mı?"}{" "}
        <Link
          href={isLogin ? "/kayit" : "/giris"}
          className="font-bold text-[#2A4FBF] hover:underline"
        >
          {isLogin ? "Kayıt ol" : "Giriş yap"}
        </Link>
      </p>
    </form>
  );
}

function PasswordField({
  name,
  label,
  autoComplete,
  minLength,
  placeholder,
  trailingLink = null,
}: {
  name: string;
  label: string;
  autoComplete: string;
  minLength?: number;
  placeholder: string;
  trailingLink?: ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  const inputId = `auth-${name}`;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <label htmlFor={inputId} className="text-sm font-bold">
          {label}
        </label>
        {trailingLink}
      </div>
      <span className="relative block">
        <LockKeyhole
          size={18}
          aria-hidden="true"
          className="absolute left-4 top-1/2 -translate-y-1/2 text-black/45"
        />
        <input
          id={inputId}
          type={visible ? "text" : "password"}
          name={name}
          autoComplete={autoComplete}
          required
          minLength={minLength}
          className="field h-12 pl-11 pr-12"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? "Şifreyi gizle" : "Şifreyi göster"}
          aria-pressed={visible}
          aria-controls={inputId}
          className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-black/55 transition hover:bg-black/5 hover:text-black"
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
    </div>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="orange-button mt-6 w-full py-3.5 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "İşleniyor..." : label}
    </button>
  );
}
