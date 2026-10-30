// Pure helpers for scripts/db/email-hook.ts (no I/O).

import { randomBytes } from "node:crypto";
import { parseHookSecret } from "../../lib/email/auth-hook";

export const HOOK_PATH = "/api/auth/email-hook";

/** A new signing secret in the format Supabase expects ("v1,whsec_<base64>"). */
export function generateHookSecret(): string {
  return `v1,whsec_${randomBytes(32).toString("base64")}`;
}

/**
 * Supabase only calls hooks over HTTPS, and a hook on a host that cannot be
 * reached would make every sign-up fail, so the address is checked before it
 * is ever sent to the project.
 */
export function validateHookUrl(value: string | undefined): { ok: true; url: string } | { ok: false; reason: string } {
  if (!value) return { ok: false, reason: "--url gerekli (ör. https://www.2elbul.com/api/auth/email-hook)." };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, reason: "--url geçerli bir adres değil." };
  }
  if (url.protocol !== "https:") return { ok: false, reason: "Supabase hook'ları yalnızca https adreslerini çağırır." };
  if (["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
    return { ok: false, reason: "localhost Supabase tarafından erişilemez; yayındaki site adresini girin." };
  }
  if (url.pathname !== HOOK_PATH) return { ok: false, reason: `Adres ${HOOK_PATH} ile bitmeli.` };
  return { ok: true, url: url.toString() };
}

export function buildEnablePatch(url: string, secret: string | undefined): Record<string, string | boolean> {
  if (!parseHookSecret(secret)) {
    throw new Error("SEND_EMAIL_HOOK_SECRET tanımlı değil ya da geçersiz. Önce `npm run email:keys` çalıştırın, değeri .env.local ve Vercel'e ekleyin.");
  }
  return {
    hook_send_email_enabled: true,
    hook_send_email_uri: url,
    hook_send_email_secrets: secret as string,
  };
}

export const DISABLE_PATCH = { hook_send_email_enabled: false } as const;
