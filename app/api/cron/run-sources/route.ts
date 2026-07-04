import { NextRequest, NextResponse } from "next/server";
import { runSourceEngine } from "@/lib/source-engine";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET tanımlı değil." },
      { status: 500 },
    );
  }

  if (!hasValidSecret(request, secret)) {
    return NextResponse.json(
      { ok: false, error: "Yetkisiz cron isteği." },
      { status: 401 },
    );
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Supabase service-role bağlantısı yok." },
      { status: 500 },
    );
  }

  const params = request.nextUrl.searchParams;
  const force = isTruthy(params.get("force")) || isTruthy(params.get("manual"));
  const sourceId = parsePositiveInt(params.get("sourceId"));
  const sourceSlug = params.get("source") || params.get("sourceSlug") || undefined;
  const limit = parsePositiveInt(params.get("limit"));

  try {
    const summary = await runSourceEngine(supabase, {
      mode: force ? "manual" : "scheduled",
      force,
      sourceId,
      sourceSlug,
      limit,
    });

    return NextResponse.json(summary, { status: summary.ok ? 200 : 207 });
  } catch (error) {
    console.error("Source engine run failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Kaynak senkronizasyonu başarısız oldu.",
      },
      { status: 500 },
    );
  }
}

function hasValidSecret(request: NextRequest, secret: string) {
  const headerSecret =
    request.headers.get("x-cron-secret") ||
    request.headers.get("x-vercel-cron-secret");
  const authHeader = request.headers.get("authorization");
  const bearerSecret = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";
  const querySecret = request.nextUrl.searchParams.get("secret");

  return [headerSecret, bearerSecret, querySecret].some(
    (value) => value === secret,
  );
}

function parsePositiveInt(value: string | null) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

function isTruthy(value: string | null) {
  return value === "1" || value === "true" || value === "yes";
}
