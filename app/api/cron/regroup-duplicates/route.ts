import { NextRequest, NextResponse } from "next/server";
import { hasValidSecret } from "@/lib/auth/cron-auth";
import { regroupAllProducts } from "@/lib/duplicate-engine/group-repository";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Daily full pass over every product: finds the same item posted on several
 * platforms and keeps listings.duplicate_group_id up to date. Syncs and
 * imports already regroup the products they touch; this catches listings that
 * went inactive or came back, and anything a failed regroup missed.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET tanımlı değil." }, { status: 500 });
  }
  if (!hasValidSecret(request, secret)) {
    return NextResponse.json({ ok: false, error: "Yetkisiz cron isteği." }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase service-role bağlantısı yok." }, { status: 500 });
  }

  try {
    return NextResponse.json({ ok: true, ...(await regroupAllProducts(supabase)) });
  } catch (error) {
    console.error("Duplicate regroup cron failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Bilinmeyen hata" },
      { status: 500 },
    );
  }
}
