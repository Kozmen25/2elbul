import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth/admin-auth";
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
