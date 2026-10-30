// Decides where the e-mail-link confirmation route sends the user. Pure so the
// routing rules are unit-tested without a Supabase round trip.

import type { EmailOtpType } from "@supabase/supabase-js";
import { NEW_PASSWORD_PATH } from "@/lib/auth/recovery";

const EMAIL_OTP_TYPES: readonly EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

export function parseEmailOtpType(value: string | null): EmailOtpType | null {
  return EMAIL_OTP_TYPES.find((type) => type === value) ?? null;
}

// URL parsers drop tabs/newlines, so "/\t/evil.com" would become "//evil.com".
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;

/** Only same-site relative paths; blocks open redirects like //evil.com. */
export function safeNextPath(value: string | null | undefined, fallback = "/"): string {
  if (!value) return fallback;
  const isSameSitePath =
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !CONTROL_CHARACTERS.test(value);
  return isSameSitePath ? value : fallback;
}

export function confirmSuccessPath(type: EmailOtpType, next: string | null): string {
  return type === "recovery" ? NEW_PASSWORD_PATH : safeNextPath(next);
}

export function confirmFailurePath(type: EmailOtpType | null): string {
  return type === "recovery" ? "/sifre-sifirla?error=link_expired" : "/giris?error=verification_failed";
}
