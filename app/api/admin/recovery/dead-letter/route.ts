import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { DeadLetterQueue } from "@/lib/recovery";
import type { DLQStatus, ErrorCategory } from "@/lib/recovery";
import { isAdminEmail } from "@/lib/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET: DLQ listesi */
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
  const sourceSlug = searchParams.get("source_slug") ?? undefined;
  const status = (searchParams.get("status") ?? undefined) as DLQStatus | undefined;
  const errorCategory = (searchParams.get("error_category") ?? undefined) as ErrorCategory | undefined;
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 50), 1), 200);
  const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);

  const dlq = new DeadLetterQueue(supabase);
  const [entries, stats] = await Promise.all([
    dlq.list({ sourceSlug, status, errorCategory, limit, offset }),
    dlq.getStats(),
  ]);

  return NextResponse.json({ ok: true, entries, stats });
}

/** POST: DLQ aksiyonları (retry / resolve / mark-dead / retry-all) */
export async function POST(request: NextRequest) {
  const authResult = await verifyAdmin();
  if (authResult) return authResult;

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Supabase service-role bağlantısı yok." },
      { status: 500 },
    );
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || !body.action) {
    return NextResponse.json(
      { ok: false, error: "action gerekli (retry / resolve / mark-dead / retry-all)." },
      { status: 400 },
    );
  }

  const dlq = new DeadLetterQueue(supabase);
  const action = String(body.action);

  switch (action) {
    case "retry": {
      const id = String(body.id ?? "");
      if (!id) {
        return NextResponse.json(
          { ok: false, error: "id gerekli." },
          { status: 400 },
        );
      }
      await dlq.retry(id);
      return NextResponse.json({ ok: true, action: "retry", id });
    }

    case "resolve": {
      const id = String(body.id ?? "");
      if (!id) {
        return NextResponse.json(
          { ok: false, error: "id gerekli." },
          { status: 400 },
        );
      }
      const notes = body.notes ? String(body.notes) : undefined;
      await dlq.resolve(id, notes);
      return NextResponse.json({ ok: true, action: "resolve", id });
    }

    case "mark-dead": {
      const id = String(body.id ?? "");
      if (!id) {
        return NextResponse.json(
          { ok: false, error: "id gerekli." },
          { status: 400 },
        );
      }
      await dlq.markDead(id);
      return NextResponse.json({ ok: true, action: "mark-dead", id });
    }

    case "retry-all": {
      const count = await dlq.retryAllPending();
      return NextResponse.json({ ok: true, action: "retry-all", count });
    }

    default:
      return NextResponse.json(
        { ok: false, error: `Bilinmeyen action: "${action}".` },
        { status: 400 },
      );
  }
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

  if (error) console.error("[DeadLetter] admin auth error:", error);
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
