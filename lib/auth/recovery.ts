// Password-reset (recovery) helpers shared by the auth callback route and the
// new-password page so the recovery gate is defined exactly once.

export const NEW_PASSWORD_PATH = "/yeni-sifre";

/**
 * True when the single-sign-on/session method came from the password-recovery
 * email link. The callback exchanges the token and the resulting session is
 * tagged with the `recovery` amr method; only such sessions may set a new
 * password without a normal login.
 */
export function isRecoverySession(user: unknown): boolean {
  const appMetadata = (user as { app_metadata?: { amr?: Array<{ method: string }> } })
    ?.app_metadata;
  return Boolean(
    appMetadata?.amr?.some((entry) => entry.method === "recovery"),
  );
}
