import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth/admin-auth";
import { diagnoseSourceRun } from "@/lib/source-engine";
import { runSourceEngine } from "@/lib/source-engine";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const authResult = await verifyAdmin();
  if (authResult) return authResult;

  const body = (await request.json().catch(() => null)) as {
    sourceId?: unknown;
    limit?: unknown;
  } | null;
  const sourceId = Number(body?.sourceId);
  const limit = Number(body?.limit ?? 10);

  if (!Number.isInteger(sourceId) || sourceId <= 0) {
    return NextResponse.json(
      { ok: false, error: "Geçerli bir kaynak seçin." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Supabase service-role bağlantısı yok." },
      { status: 500 },
    );
  }

  try {
    const summary = await runSourceEngine(supabase, {
      mode: "debug",
      force: true,
      sourceId,
      limit: Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), 50) : 10,
    });
    const diagnostics = summary.results.map((result) => ({
      sourceId: result.sourceId,
      sourceName: result.sourceName,
      ...diagnoseSourceRun(result),
    }));

    return NextResponse.json({ ...summary, diagnostics }, { status: summary.ok ? 200 : 207 });
  } catch (error) {
    console.error("Source debug run failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Kaynak debug çalıştırılamadı.",
      },
      { status: 500 },
    );
  }
}
