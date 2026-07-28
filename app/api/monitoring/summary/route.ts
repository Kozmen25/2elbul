import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { collectMonitoringSummary } from "@/lib/monitoring";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const auth = await verifyAdmin();
  if (auth) return auth;

  try {
    const summary = await collectMonitoringSummary();
    return NextResponse.json({ ok: true, data: summary });
  } catch (error) {
    console.error("[Monitor Summary] Failed:", error);
    return NextResponse.json(
      { ok: false, error: "İzleme özeti alınamadı." },
      { status: 500 },
    );
  }
}

async function verifyAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = (await supabase?.auth.getUser()) ?? { data: { user: null } };

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
