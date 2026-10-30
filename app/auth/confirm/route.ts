import type { NextRequest } from "next/server";
import { confirmFailurePath, confirmSuccessPath, parseEmailOtpType } from "@/lib/auth/confirm";
import { redirectToPath } from "@/lib/relative-redirect";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

/**
 * Landing route for every Supabase e-mail link (sign-up confirmation, password
 * reset, e-mail change, magic link). The e-mail templates point here with a
 * one-time `token_hash`; verifying it signs the user in.
 *
 * Unlike the PKCE `?code=` flow (/auth/callback), this does not depend on a
 * code-verifier cookie set in the browser that requested the e-mail, so the
 * link also works when it is opened on another device or browser.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = parseEmailOtpType(searchParams.get("type"));

  if (tokenHash && type) {
    const supabase = await createSupabaseServerClient();
    const { error } = (await supabase?.auth.verifyOtp({ type, token_hash: tokenHash })) ?? {
      error: new Error("Supabase yapılandırılmamış"),
    };

    if (!error) {
      return redirectToPath(confirmSuccessPath(type, searchParams.get("next")));
    }
    console.error("Supabase e-mail link verification failed:", error.message);
  }

  return redirectToPath(confirmFailurePath(type));
}
