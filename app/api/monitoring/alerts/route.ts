import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth/admin-auth";
import { listAlerts } from "@/lib/monitoring";
import type { AlertFilter } from "@/lib/monitoring";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin();
  if (auth) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const filter: AlertFilter = {};

    const type = searchParams.get("type");
    if (type) filter.type = type as AlertFilter["type"];

    const severity = searchParams.get("severity");
    if (severity) filter.severity = severity as AlertFilter["severity"];

    const status = searchParams.get("status");
    if (status) filter.status = status as AlertFilter["status"];

    const sourceId = searchParams.get("sourceId");
    if (sourceId) filter.sourceId = Number(sourceId);

    const limit = searchParams.get("limit");
    if (limit) filter.limit = Number(limit);

    const offset = searchParams.get("offset");
    if (offset) filter.offset = Number(offset);

    const alerts = await listAlerts(filter);
    return NextResponse.json({ ok: true, data: alerts });
  } catch (error) {
    console.error("[Monitor Alerts] Failed:", error);
    return NextResponse.json(
      { ok: false, error: "Alarmlar alınamadı." },
      { status: 500 },
    );
  }
}
