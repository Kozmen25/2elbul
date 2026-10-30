// Parses the URL fragment Supabase appends to an "implicit flow" recovery link:
//   https://site/auth/recovery#access_token=…&refresh_token=…&type=recovery
// Fragments never reach the server, so /auth/recovery (a client page) reads
// them and hands the tokens to a server action.

export type RecoveryHash =
  | { ok: true; accessToken: string; refreshToken: string }
  | { ok: false };

export function parseRecoveryHash(hash: string): RecoveryHash {
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");

  // An error fragment (expired/used link) carries error_description instead.
  if (params.get("type") !== "recovery" || !accessToken || !refreshToken) {
    return { ok: false };
  }
  return { ok: true, accessToken, refreshToken };
}
