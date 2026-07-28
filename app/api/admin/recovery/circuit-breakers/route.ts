import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { CircuitBreakerRegistry } from "@/lib/recovery";
import { isAdminEmail } from "@/lib/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET: tüm devre kesici durumlarını listele */
export async function GET() {
  const authResult = await verifyAdmin();
  if (authResult) return authResult;

  const cb = CircuitBreakerRegistry.getInstance();
  const list = cb.getAllStates().map((s) => ({
    slug: s.slug,
    state: s.state,
    failureCount: s.failureCount,
    tripCount: s.tripCount,
    lastFailureAt: s.lastFailureAt,
    openedAt: s.openedAt,
    lastTestedAt: s.lastTestedAt,
  }));

  return NextResponse.json({ ok: true, breakers: list });
}

/** POST: belirli bir devre kesiciyi sıfırla ({ slug: "easycep" }) */
export async function POST(request: NextRequest) {
  const authResult = await verifyAdmin();
  if (authResult) return authResult;

  const body = (await request.json().catch(() => null)) as {
    slug?: unknown;
    action?: unknown;
  } | null;

  const slug = String(body?.slug ?? "");
  if (!slug) {
    return NextResponse.json(
      { ok: false, error: "slug gerekli." },
      { status: 400 },
    );
  }

  const cb = CircuitBreakerRegistry.getInstance();
  const state = cb.getState(slug);

  if (!state) {
    return NextResponse.json(
      { ok: false, error: `"${slug}" için devre kesici bulunamadı.` },
      { status: 404 },
    );
  }

  cb.reset(slug);

  return NextResponse.json({
    ok: true,
    slug,
    message: `"${slug}" devre kesici sıfırlandı.`,
  });
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

  if (error) console.error("[CircuitBreakers] admin auth error:", error);
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
