import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth/admin-auth";
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
