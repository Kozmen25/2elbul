import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { RecoveryMetricsService } from "@/lib/recovery";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET: iyileşme metrikleri özeti */
export async function GET(request: NextRequest) {
  const authResult = await verifyAdmin();
  if (authResult) return authResult;

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Supabase service-role bağlantısı yok." },
      { status: 500 },
    );
  }

  const { searchParams } = request.nextUrl;
  const sourceSlug = searchParams.get("source_slug");
  const since = searchParams.get("since") ?? undefined;

  const metrics = new RecoveryMetricsService(supabase);
  const summary = await metrics.getSummary(since);

  if (sourceSlug) {
    const bySource = await metrics.getBySource(sourceSlug, since);
    return NextResponse.json({ ok: true, summary, bySource });
  }

  return NextResponse.json({ ok: true, summary });
}
