import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NEW_PASSWORD_PATH } from "@/lib/auth/recovery";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next") ?? "/");
  const type = url.searchParams.get("type");

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = (await supabase?.auth.exchangeCodeForSession(code)) ?? {
      error: new Error("Supabase yapılandırılmamış"),
    };

    if (!error) {
      if (type === "recovery") {
        // Password-reset link landed: the session is now authenticated but its
        // amr method is `recovery`, so we land the user on the new-password page.
        // The user is already session-valid here, so the page must NOT redirect
        // away just because a user exists.
        return NextResponse.redirect(
          new URL(NEW_PASSWORD_PATH, url.origin),
        );
      }
      return NextResponse.redirect(new URL(next, url.origin));
    }

    console.error("Supabase auth callback failed:", error);
  }

  return NextResponse.redirect(
    new URL("/giris?error=verification_failed", url.origin),
  );
}

function safeNextPath(value: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

