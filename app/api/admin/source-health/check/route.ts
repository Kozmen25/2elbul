import { NextRequest, NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import { getStandardSourceAdapter } from "@/lib/bots/connectors";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SourceRow = {
  id: number;
  name: string;
  slug: string;
  is_active?: boolean | null;
  api_url?: string | null;
  scrape_url?: string | null;
  cron_enabled?: boolean | null;
  cron_schedule?: string | null;
  fetch_limit?: number | null;
  product_limit?: number | null;
};

export async function POST(request: NextRequest) {
  const authResult = await verifyAdmin();
  if (authResult) return authResult;

  const body = (await request.json().catch(() => null)) as {
    sourceId?: unknown;
  } | null;
  const sourceId = Number(body?.sourceId);

  if (!Number.isFinite(sourceId) || sourceId <= 0) {
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

  let sourceResult = await supabase
    .from("sources")
    .select(
      "id, name, slug, is_active, api_url, scrape_url, cron_enabled, cron_schedule, fetch_limit, product_limit",
    )
    .eq("id", sourceId)
    .maybeSingle();

  if (sourceResult.error && isMissingColumn(sourceResult.error, ["api_url"])) {
    sourceResult = await supabase
      .from("sources")
      .select(
        "id, name, slug, is_active, scrape_url, cron_enabled, cron_schedule, fetch_limit, product_limit",
      )
      .eq("id", sourceId)
      .maybeSingle();
  }

  if (sourceResult.error) {
    console.error("Source health source query failed:", sourceResult.error);
    return NextResponse.json(
      { ok: false, error: sourceResult.error.message },
      { status: 500 },
    );
  }

  if (!sourceResult.data) {
    return NextResponse.json(
      { ok: false, error: "Kaynak bulunamadı." },
      { status: 404 },
    );
  }

  const source = sourceResult.data as SourceRow;
  const adapter = getStandardSourceAdapter({
    sourceId: Number(source.id),
    sourceName: String(source.name),
    sourceSlug: String(source.slug),
    apiUrl: source.api_url ?? null,
    scrapeUrl: source.scrape_url ?? null,
    cronEnabled: Boolean(source.cron_enabled ?? false),
    cronSchedule: source.cron_schedule ?? "",
    productLimit: Number(source.fetch_limit ?? source.product_limit ?? 1),
  });

  try {
    const health = await adapter.healthCheck();
    const healthStatus = !adapter.enabled
      ? "unknown"
      : health.ok
        ? "healthy"
        : "failed";

    return NextResponse.json({
      ok: health.ok,
      sourceId,
      sourceName: source.name,
      adapterType: source.slug,
      enabled: adapter.enabled,
      healthStatus,
      message: health.message,
    });
  } catch (error) {
    const message = getErrorMessage(error);
    console.error("Source health check failed:", error);
    return NextResponse.json(
      {
        ok: false,
        sourceId,
        sourceName: source.name,
        adapterType: source.slug,
        enabled: adapter.enabled,
        healthStatus: "failed",
        message,
      },
      { status: 200 },
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

  if (error) {
    console.error("Source health admin auth failed:", error);
  }

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

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "Kaynak sağlığı kontrolü başarısız oldu.";
}

function isMissingColumn(error: unknown, columns: string[]) {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: string; message?: string; details?: string };
  const text = `${record.message ?? ""} ${record.details ?? ""}`.toLowerCase();
  return (
    record.code === "42703" ||
    record.code === "PGRST204" ||
    columns.some((column) => text.includes(column))
  );
}
