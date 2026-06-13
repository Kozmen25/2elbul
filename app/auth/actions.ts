"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export type AuthState = {
  status: "idle" | "error" | "success";
  message: string;
};

export async function login(
  _previousState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(
    String(formData.get("next") ?? ""),
    "/",
  );
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return { status: "error", message: "Supabase bağlantısı yapılandırılmamış." };
  }

  if (!email || password.length < 6) {
    return {
      status: "error",
      message: "Geçerli bir e-posta ve en az 6 karakterli şifre girin.",
    };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error("Supabase login failed:", error);
    return {
      status: "error",
      message: authErrorMessage(error.message),
    };
  }

  redirect(next);
}

export async function signUp(
  _previousState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return { status: "error", message: "Supabase bağlantısı yapılandırılmamış." };
  }

  if (!email || password.length < 6) {
    return {
      status: "error",
      message: "Geçerli bir e-posta ve en az 6 karakterli şifre girin.",
    };
  }

  if (password !== confirmPassword) {
    return { status: "error", message: "Şifreler birbiriyle eşleşmiyor." };
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: origin
      ? {
          emailRedirectTo: `${origin.replace(/\/$/, "")}/auth/callback`,
        }
      : undefined,
  });

  if (error) {
    console.error("Supabase signup failed:", error);
    return {
      status: "error",
      message: authErrorMessage(error.message),
    };
  }

  return {
    status: "success",
    message: "Kayıt başarılı, e-postanı kontrol et",
  };
}

export async function logout() {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    const { error } = await supabase.auth.signOut();
    if (error) console.error("Supabase logout failed:", error);
  }
  redirect("/");
}

function safeNextPath(value: string, fallback = "/") {
  return value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

function authErrorMessage(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) {
    return "E-posta veya şifre hatalı.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Giriş yapmadan önce e-posta adresinizi doğrulayın.";
  }
  if (normalized.includes("already registered")) {
    return "Bu e-posta adresiyle daha önce kayıt olunmuş.";
  }
  if (normalized.includes("password")) {
    return "Şifre güvenlik gereksinimlerini karşılamıyor.";
  }
  return "İşlem tamamlanamadı. Lütfen tekrar deneyin.";
}
