import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth/admin-auth";
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
