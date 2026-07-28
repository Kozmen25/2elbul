import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { RecoveryMetricsService } from "@/lib/recovery";
import { isAdminEmail } from "@/lib/admin";

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

async function verifyAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = (await supabase?.auth.getUser()) ?? {
    data: { user: null },
    error: null,
  };

  if (error) console.error("[RecoveryMetrics] admin auth error:", error);
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
