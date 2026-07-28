import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { collectMetricsSnapshot } from "@/lib/monitoring";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const auth = await verifyAdmin();
  if (auth) return auth;

  try {
    const snapshot = await collectMetricsSnapshot();
    return NextResponse.json({ ok: true, data: snapshot });
  } catch (error) {
    console.error("[Monitor Snapshot] Failed:", error);
    return NextResponse.json(
      { ok: false, error: "Metrik anlık görüntüsü alınamadı." },
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
