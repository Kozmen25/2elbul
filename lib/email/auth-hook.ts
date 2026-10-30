// Supabase "Send Email" auth hook: instead of Supabase mailing sign-up / reset
// links itself (free plan: 2 e-mails per hour, fixed templates), it POSTs each
// message to /api/auth/email-hook and the app sends it through the SMTP
// settings saved in the admin panel.
//
// Requests are signed with the Standard Webhooks scheme (HMAC-SHA256); the
// shared secret is SEND_EMAIL_HOOK_SECRET ("v1,whsec_<base64>").

import { createHmac, timingSafeEqual } from "node:crypto";
import { safeNextPath } from "@/lib/auth/confirm";
import type { EmailKind, EmailTemplateData } from "@/lib/email/templates";

/** Standard Webhooks default: reject anything older/newer than 5 minutes. */
export const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

export function parseHookSecret(raw: string | undefined | null): Buffer | null {
  const value = raw?.trim();
  if (!value) return null;
  const encoded = value.replace(/^v1,/, "").replace(/^whsec_/, "");
  const key = Buffer.from(encoded, "base64");
  return key.length >= 16 ? key : null;
}

export type SignedRequest = {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  body: string;
};

export function verifyHookSignature(secret: Buffer, request: SignedRequest, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  const { id, timestamp, signature, body } = request;
  if (!id || !timestamp || !signature) return false;

  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt) || Math.abs(nowSeconds - sentAt) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const expected = createHmac("sha256", secret).update(`${id}.${timestamp}.${body}`).digest();

  // The header may hold several space-separated signatures ("v1,<base64> v1,<base64>").
  return signature.split(" ").some((candidate) => {
    const [version, value] = candidate.split(",");
    if (version !== "v1" || !value) return false;
    const received = Buffer.from(value, "base64");
    return received.length === expected.length && timingSafeEqual(received, expected);
  });
}

export function signHookBody(secret: Buffer, id: string, timestamp: string, body: string): string {
  return `v1,${createHmac("sha256", secret).update(`${id}.${timestamp}.${body}`).digest("base64")}`;
}

export type HookPayload = {
  user?: { id?: string; email?: string; new_email?: string };
  email_data?: {
    token?: string;
    token_hash?: string;
    redirect_to?: string;
    email_action_type?: string;
    site_url?: string;
  };
};

export type AuthEmail =
  | { ok: true; to: string; userId: string | null; kind: EmailKind; data: EmailTemplateData[EmailKind] }
  | { ok: false; reason: string };

// Hook action type → template, and the `type` verifyOtp() expects in the link.
const LINK_TYPES: Record<string, { kind: "signup" | "recovery" | "magiclink" | "invite"; otpType: string }> = {
  signup: { kind: "signup", otpType: "signup" },
  recovery: { kind: "recovery", otpType: "recovery" },
  magiclink: { kind: "magiclink", otpType: "magiclink" },
  invite: { kind: "invite", otpType: "invite" },
  email: { kind: "magiclink", otpType: "email" },
};

function originOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

/**
 * Turns a hook payload into the e-mail to send. The link points at our own
 * /auth/confirm route (token_hash), which works on any device, on the origin
 * the request came from (`redirect_to`, already checked by Supabase against its
 * allow-list) and falls back to the project's site URL.
 */
export function buildAuthEmail(payload: HookPayload, fallbackOrigin: string): AuthEmail {
  const to = payload.user?.email?.trim();
  const data = payload.email_data;
  const action = data?.email_action_type;
  if (!to || !data || !action) return { ok: false, reason: "Eksik alan: kullanıcı e-postası ya da e-posta türü." };

  const userId = payload.user?.id ?? null;

  if (action === "reauthentication") {
    if (!data.token) return { ok: false, reason: "Doğrulama kodu yok." };
    return { ok: true, to, userId, kind: "reauthentication", data: { code: data.token } };
  }

  const mapping = LINK_TYPES[action];
  if (!mapping) {
    return { ok: false, reason: `Desteklenmeyen e-posta türü: ${action}` };
  }
  if (!data.token_hash) return { ok: false, reason: "Bağlantı belirteci yok." };

  const origin = originOf(data.redirect_to) ?? originOf(data.site_url) ?? fallbackOrigin;
  const link = new URL("/auth/confirm", origin);
  link.searchParams.set("token_hash", data.token_hash);
  link.searchParams.set("type", mapping.otpType);

  // Keep the page the user was heading to (sign-up / magic link); a reset link
  // always ends on the new-password page, so `next` is pointless there.
  if (mapping.otpType !== "recovery" && data.redirect_to) {
    try {
      const next = new URL(data.redirect_to).searchParams.get("next");
      if (next) link.searchParams.set("next", safeNextPath(next));
    } catch {
      // not a URL: no next
    }
  }

  return { ok: true, to, userId, kind: mapping.kind, data: { link: link.toString() } };
}
