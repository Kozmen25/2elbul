import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isAdminEmail } from "@/lib/admin";

export async function verifyAdmin(): Promise<NextResponse | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = (await supabase?.auth.getUser()) ?? {
    data: { user: null },
    error: null,
  };

  if (error) console.error("[verifyAdmin] auth error:", error);
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Bu işlem için giriş yapmalısınız." },
      { status: 401 },
    );
  }
  if (!isAdminEmail(user.email)) {
    return NextResponse.json(
      { ok: false, error: "Bu işlem için admin yetkisi gerekli." },
      { status: 403 },
    );
  }
  return null;
}
