import { NextRequest, NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { acknowledgeAlert } from "@/lib/monitoring";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verifyAdmin();
  if (auth) return auth;

  try {
    const { id } = await params;
    const body = (await _request.json().catch(() => null)) as { acknowledgedBy?: string } | null;
    const acknowledgedBy = body?.acknowledgedBy ?? "admin";

    await acknowledgeAlert(id, acknowledgedBy);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Monitor Acknowledge] Failed:", error);
    return NextResponse.json(
      { ok: false, error: "Alarm onaylanamadı." },
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
