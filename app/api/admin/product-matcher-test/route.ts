import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth/admin-auth";
import { dryRunProductMatch } from "@/lib/product-matcher";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const authResult = await verifyAdmin();
  if (authResult) return authResult;

  const body = (await request.json().catch(() => null)) as {
    title?: unknown;
  } | null;
  const title = typeof body?.title === "string" ? body.title.trim() : "";

  if (!title) {
    return NextResponse.json(
      { ok: false, error: "İlan başlığı boş olamaz." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Supabase admin bağlantısı yapılandırılmamış." },
      { status: 500 },
    );
  }

  try {
    const result = await dryRunProductMatch({
      supabase,
      title,
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("Product matcher dry-run failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Bilinmeyen eşleştirme hatası.",
      },
      { status: 500 },
    );
  }
}
