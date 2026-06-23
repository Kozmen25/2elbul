import { NextRequest, NextResponse } from "next/server";
import {
  isSupportedScrapeSource,
  runSourceScrapeBot,
  type SourceRunRecord,
} from "@/lib/bots/source-runner";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SourceRow = SourceRunRecord & {
  is_active: boolean;
  cron_enabled: boolean;
  integration_type?: string | null;
};

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

  const { data, error } = await supabase
    .from("sources")
    .select(
      "id, name, slug, is_active, cron_enabled, integration_type, fetch_limit, bot_import_mode, scrape_url, total_imported",
    )
    .eq("is_active", true)
    .eq("cron_enabled", true);

  if (error) {
    console.error("Cron source query failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: `Kaynaklar okunamadı: ${error.message}`,
        migration: "supabase/bot-scheduler.sql",
      },
      { status: 500 },
    );
  }

  const runnableSources = ((data ?? []) as SourceRow[]).filter(
    (source) =>
      source.integration_type === "scrape" &&
      isSupportedScrapeSource(source.slug),
  );
  const skippedSources = ((data ?? []) as SourceRow[])
    .filter((source) => !runnableSources.includes(source))
    .map((source) => ({
      id: source.id,
      name: source.name,
      slug: source.slug,
      reason:
        source.integration_type !== "scrape"
          ? "integration_type scrape değil"
          : "gerçek adaptör hazır değil",
    }));
  const results = [];

  for (const source of runnableSources) {
    const result = await runSourceScrapeBot(supabase, source, {
      runType: "scheduled",
    });
    results.push(result);
  }

  return NextResponse.json({
    ok: true,
    scanned: data?.length ?? 0,
    ran: results.length,
    skipped: skippedSources.length,
    skippedSources,
    results,
  });
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
