import { createSupabaseServerClient } from "@/lib/supabase-server";
import { confirmFailurePath, safeNextPath } from "@/lib/auth/confirm";
import { NEW_PASSWORD_PATH } from "@/lib/auth/recovery";
import { redirectToPath } from "@/lib/relative-redirect";

/**
 * PKCE landing route: Supabase's default e-mail links (sign-up confirmation,
 * password reset) return here with `?code=…`. The code is exchanged for a
 * session using the verifier cookie stored when the e-mail was requested, so
 * the link must be opened in the same browser. Custom e-mail templates use
 * /auth/confirm instead, which has no such restriction.
 *
 * `next` is set by the requesting action (e.g. /yeni-sifre for a password
 * reset). Whether a session may actually set a new password is decided by the
 * new-password page itself (lib/auth/recovery.ts), not by this route.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = (await supabase?.auth.exchangeCodeForSession(code)) ?? {
      error: new Error("Supabase yapılandırılmamış"),
    };

    if (!error) {
      return redirectToPath(next);
    }

    console.error("Supabase auth callback failed:", error.message);
  }

  return redirectToPath(confirmFailurePath(next === NEW_PASSWORD_PATH ? "recovery" : null));
}
