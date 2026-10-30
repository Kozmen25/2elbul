// Password-reset (recovery) helpers shared by the auth confirm route and the
// new-password page/action so the recovery gate is defined exactly once.
//
// How the flow works: the reset e-mail links to /auth/confirm?token_hash=…&
// type=recovery. That route verifies the one-time token, which signs the user
// in. Supabase records how a session was created in the access token's `amr`
// claim (NOT on the user object): a token verified from an e-mail link is
// `otp`, a normal login is `password`. A session may therefore set a new
// password without knowing the old one only if it was created by an e-mail
// link very recently.

import type { SupabaseClient } from "@supabase/supabase-js";

export const NEW_PASSWORD_PATH = "/yeni-sifre";

/** How long after clicking the e-mail link a new password may be set. */
export const RECOVERY_WINDOW_MS = 15 * 60 * 1000;

export type AuthMethodReference = { method: string; timestamp: number };

// Authentication methods that prove control of the mailbox. Supabase reports a
// token verified via /auth/confirm as `otp`; a PKCE code from a reset link may
// carry a more specific name, so all e-mail-link methods are accepted.
const EMAIL_LINK_METHODS = new Set([
  "otp",
  "recovery",
  "magiclink",
  "email/signup",
  "email_change",
  "invite",
]);

// Recorded whenever a session is refreshed; says nothing about how it began.
const IGNORED_METHODS = new Set(["token_refresh"]);

/** Decodes the `amr` claim of a JWT access token (no signature check). */
export function readAmrClaim(accessToken: string | null | undefined): AuthMethodReference[] {
  if (!accessToken) return [];
  const payload = accessToken.split(".")[1];
  if (!payload) return [];
  try {
    const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const amr = (JSON.parse(json) as { amr?: unknown }).amr;
    if (!Array.isArray(amr)) return [];
    return amr.filter(
      (entry): entry is AuthMethodReference =>
        typeof entry?.method === "string" && typeof entry?.timestamp === "number",
    );
  } catch {
    return [];
  }
}

/**
 * True when the most recent authentication was an e-mail link (otp/recovery)
 * completed within the recovery window. `timestamp` is in seconds.
 */
export function isRecentEmailLinkLogin(
  amr: AuthMethodReference[],
  nowMs: number = Date.now(),
): boolean {
  const latest = amr
    .filter((entry) => !IGNORED_METHODS.has(entry.method))
    .sort((a, b) => b.timestamp - a.timestamp)[0];
  if (!latest || !EMAIL_LINK_METHODS.has(latest.method)) return false;
  return nowMs - latest.timestamp * 1000 <= RECOVERY_WINDOW_MS;
}

/**
 * Server-side check that the current session came from a fresh password-reset
 * e-mail link. The user is validated with the Auth server first, so the token
 * decoded afterwards is genuine.
 */
export async function isRecoverySession(supabase: SupabaseClient): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return false;
  const { data: sessionData } = await supabase.auth.getSession();
  return isRecentEmailLinkLogin(readAmrClaim(sessionData.session?.access_token));
}
