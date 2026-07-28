import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth/admin-auth";
import { resolveAlert } from "@/lib/monitoring";

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
    await resolveAlert(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Monitor Resolve] Failed:", error);
    return NextResponse.json(
      { ok: false, error: "Alarm çözülemedi." },
      { status: 500 },
    );
  }
}
