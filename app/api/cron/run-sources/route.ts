import { NextRequest, NextResponse } from "next/server";
import { isSourceDueForRun } from "@/lib/bots/cron-schedule";
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
  cron_schedule?: string | null;
  last_run_at?: string | null;
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
      "id, name, slug, is_active, cron_enabled, cron_schedule, last_run_at, integration_type, fetch_limit, bot_import_mode, scrape_url, total_imported",
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

  const allSources = (data ?? []) as SourceRow[];
  const runnableSources = allSources.filter(
    (source) =>
      source.integration_type === "scrape" &&
      isSupportedScrapeSource(source.slug) &&
      isSourceDueForRun(
        source.cron_schedule ?? "0 */6 * * *",
        source.last_run_at,
      ),
  );
  const skippedSources = allSources
    .filter((source) => !runnableSources.includes(source))
    .map((source) => ({
      id: source.id,
      name: source.name,
      slug: source.slug,
      reason: getSkipReason(source),
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
    scanned: allSources.length,
    ran: results.length,
    skipped: skippedSources.length,
    skippedSources,
    results,
  });
}

function getSkipReason(source: SourceRow) {
  if (source.integration_type !== "scrape") {
    return "integration_type scrape değil";
  }
  if (!isSupportedScrapeSource(source.slug)) {
    return "gerçek adaptör hazır değil";
  }
  if (
    !isSourceDueForRun(
      source.cron_schedule ?? "0 */6 * * *",
      source.last_run_at,
    )
  ) {
    return "cron_schedule aralığı dolmadı";
  }
  return "bilinmeyen neden";
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
