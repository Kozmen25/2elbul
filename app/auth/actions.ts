"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  authRateLimitMessage,
  checkAuthRateLimit,
  type AuthRateLimitedAction,
} from "@/lib/auth/auth-rate-limit";
import { safeNextPath } from "@/lib/auth/confirm";
import { validateNewPassword } from "@/lib/auth/password-policy";
import { getRequestOrigin } from "@/lib/auth/origin";
import { NEW_PASSWORD_PATH, isRecoverySession } from "@/lib/auth/recovery";
import { isPresetAvatarId } from "@/lib/preset-avatars";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { recordEvent } from "@/lib/analytics/events";
import { getClientIp } from "@/lib/rate-limit";

export type AuthState = {
  status: "idle" | "error" | "success";
  message: string;
  /**
   * The e-mail that was submitted. React clears uncontrolled fields after a
   * form action finishes, so the form uses this as the field's default value
   * to keep the address after an error.
   */
  email?: string;
};

/** Error message when this attempt is over the brute-force limit, else null. */
async function rateLimitError(action: AuthRateLimitedAction, account: string): Promise<string | null> {
  const ip = getClientIp({ headers: await headers() });
  const decision = checkAuthRateLimit(action, { ip, account });
  return decision.allowed ? null : authRateLimitMessage(decision.retryAfterMinutes);
}

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

  if (!email || !password) {
    return { status: "error", message: "E-posta ve şifrenizi girin.", email };
  }

  const limited = await rateLimitError("login", email);
  if (limited) return { status: "error", message: limited, email };

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error("Supabase login failed:", error);
    return {
      status: "error",
      message: authErrorMessage(error.message),
      email,
    };
  }

  const session = (await supabase.auth.getSession()).data.session;
  void recordEvent(createSupabaseAdminClient(), {
    eventName: "LOGIN",
    userId: session?.user?.id ?? null,
  });

  redirect(next);
}

export async function signUp(
  _previousState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const avatarPreset = String(formData.get("avatarPreset") ?? "").trim();
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return { status: "error", message: "Supabase bağlantısı yapılandırılmamış." };
  }

  if (!email) {
    return { status: "error", message: "Geçerli bir e-posta adresi girin.", email };
  }

  const passwordError = validateNewPassword(password, confirmPassword);
  if (passwordError) {
    return { status: "error", message: passwordError, email };
  }

  // Optional user-chosen avatar id; the DB trigger defaults to a deterministic
  // one when absent. Whitelisted so a client can't inject an arbitrary path.
  const userData: Record<string, string> = {};
  if (avatarPreset) {
    if (!isPresetAvatarId(avatarPreset)) {
      return { status: "error", message: "Geçersiz avatar seçildi.", email };
    }
    userData.avatar = avatarPreset;
  }

  const limited = await rateLimitError("signup", email);
  if (limited) return { status: "error", message: limited, email };

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${await getRequestOrigin()}/auth/callback`,
      data: userData,
    },
  });

  if (error) {
    console.error("Supabase signup failed:", error);
    return {
      status: "error",
      message: authErrorMessage(error.message),
      email,
    };
  }

  void recordEvent(createSupabaseAdminClient(), {
    eventName: "SIGNUP",
    userId: data?.user?.id ?? null,
  });

  return {
    status: "success",
    message: "Kayıt başarılı, e-postanı kontrol et",
  };
}

export async function logout() {
  const supabase = await createSupabaseServerClient();
  const session = supabase
    ? (await supabase.auth.getSession()).data.session
    : null;

  if (supabase) {
    const { error } = await supabase.auth.signOut();
    if (error) console.error("Supabase logout failed:", error);
  }

  void recordEvent(createSupabaseAdminClient(), {
    eventName: "LOGOUT",
    userId: session?.user?.id ?? null,
  });

  redirect("/");
}

/**
 * Sends a password-reset email. Supabase intentionally returns success for
 * unknown addresses too, so this never reveals whether an account exists.
 */
export async function resetPassword(
  _previousState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return { status: "error", message: "Supabase bağlantısı yapılandırılmamış." };
  }

  if (!email) {
    return { status: "error", message: "Geçerli bir e-posta adresi girin.", email };
  }

  const limited = await rateLimitError("password-reset", email);
  if (limited) return { status: "error", message: limited, email };

  // With Supabase's default e-mail template the link returns to
  // /auth/callback?code=… on this same host (where the PKCE verifier cookie was
  // just stored) and `next` sends the user on to the new-password page. Custom
  // templates from supabase/email-templates use /auth/confirm instead.
  const origin = await getRequestOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(NEW_PASSWORD_PATH)}`,
  });

  if (error) {
    console.error("Supabase password reset failed:", error);
    return {
      status: "error",
      message: resetErrorMessage(error.message),
      email,
    };
  }

  return {
    status: "success",
    message: "Şifre sıfırlama bağlantısı e-postana gönderildi.",
  };
}

/**
 * Sets a new password after a password-reset e-mail link. Only a session that
 * was created by such a link within the last few minutes may do this without
 * the old password (see lib/auth/recovery.ts). On success every session of the
 * user is ended so the new password has to be used to log in again.
 */
export async function updatePassword(
  _previousState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return { status: "error", message: "Supabase bağlantısı yapılandırılmamış." };
  }

  if (!(await isRecoverySession(supabase))) {
    return {
      status: "error",
      message: "Şifre sıfırlama bağlantınızın süresi dolmuş. Lütfen yeni bir bağlantı isteyin.",
    };
  }

  const passwordError = validateNewPassword(password, confirmPassword);
  if (passwordError) {
    return { status: "error", message: passwordError };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    console.error("Supabase password update failed:", error);
    return { status: "error", message: authErrorMessage(error.message) };
  }

  await supabase.auth.signOut({ scope: "global" });
  redirect("/giris?reset=success");
}

/**
 * Turns the tokens from an implicit-flow reset link (read from the URL
 * fragment by /auth/recovery) into a session. Only a session that was created
 * by a reset link is kept; anything else is discarded.
 */
export async function startRecoverySession(accessToken: string, refreshToken: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  if (!supabase || !accessToken || !refreshToken) return false;

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) {
    console.error("Supabase recovery session failed:", error.message);
    return false;
  }

  if (!(await isRecoverySession(supabase))) {
    await supabase.auth.signOut();
    return false;
  }
  return true;
}

/**
 * Changes the password of a logged-in user. The current password is verified
 * first so a hijacked or unattended session cannot silently take over the
 * account.
 */
export async function changePassword(
  _previousState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return { status: "error", message: "Supabase bağlantısı yapılandırılmamış." };
  }

  const { data: userData } = await supabase.auth.getUser();
  const email = userData.user?.email;
  if (!userData.user || !email) {
    return { status: "error", message: "Bu işlem için giriş yapmalısınız." };
  }

  if (!currentPassword) {
    return { status: "error", message: "Mevcut şifrenizi girin." };
  }

  const passwordError = validateNewPassword(password, confirmPassword);
  if (passwordError) {
    return { status: "error", message: passwordError };
  }

  if (password === currentPassword) {
    return { status: "error", message: "Yeni şifre mevcut şifrenizden farklı olmalıdır." };
  }

  const limited = await rateLimitError("password-change", userData.user.id);
  if (limited) return { status: "error", message: limited };

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (verifyError) {
    return { status: "error", message: "Mevcut şifre hatalı." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error("Supabase password change failed:", error);
    return { status: "error", message: authErrorMessage(error.message) };
  }

  // Sign out every other device; this session stays logged in.
  await supabase.auth.signOut({ scope: "others" });

  return { status: "success", message: "Şifren güncellendi. Diğer cihazlardaki oturumların kapatıldı." };
}

function resetErrorMessage(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("rate limit")) {
    return "Çok fazla istek gönderildi. Lütfen biraz sonra tekrar deneyin.";
  }
  if (normalized.includes("valid email")) {
    return "Geçerli bir e-posta adresi girin.";
  }
  return "Şifre sıfırlama bağlantısı gönderilemedi. Lütfen tekrar deneyin.";
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
  if (normalized.includes("different from the old password")) {
    return "Yeni şifre eskisinden farklı olmalıdır.";
  }
  if (normalized.includes("password")) {
    return "Şifre güvenlik gereksinimlerini karşılamıyor.";
  }
  return "İşlem tamamlanamadı. Lütfen tekrar deneyin.";
}
