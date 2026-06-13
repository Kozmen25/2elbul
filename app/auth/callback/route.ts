import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next") ?? "/");

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = (await supabase?.auth.exchangeCodeForSession(code)) ?? {
      error: new Error("Supabase yapılandırılmamış"),
    };

    if (!error) {
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
