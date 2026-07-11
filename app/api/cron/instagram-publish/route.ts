import { NextRequest, NextResponse } from "next/server";
import {
  buildInstagramPublishConfig,
  buildInstagramReelCaptionForDraft,
  buildInstagramReelDraftForSlug,
  publishInstagramReel,
  selectDailyInstagramReelSelection,
} from "@/lib/instagram";
import { getAbsoluteUrl } from "@/lib/site-url";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type BotRunRow = {
  id: number;
  status: string;
  run_type: string;
  created_at: string;
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

  const startedAt = new Date().toISOString();
  const runId = await createInstagramRun(supabase, startedAt);

  try {
    const duplicateCheck = await hasRecentSuccessfulRun(supabase, startedAt);
    if (duplicateCheck) {
      await finishInstagramRun(supabase, runId, {
        status: "skipped",
        finishedAt: new Date().toISOString(),
        message: "Bugün için Instagram reel zaten yayınlandı.",
        sampleSize: 0,
        sourceCount: 0,
        matchedProductCount: 0,
        mediaId: null,
      });

      return NextResponse.json({
        ok: true,
        status: "skipped",
        message: "Bugün için Instagram reel zaten yayınlandı.",
      });
    }

    const selection = await selectDailyInstagramReelSelection();
    if (!selection) {
      await finishInstagramRun(supabase, runId, {
        status: "failed",
        finishedAt: new Date().toISOString(),
        message: "Instagram reel için seçilecek ürün bulunamadı.",
        sampleSize: 0,
        sourceCount: 0,
        matchedProductCount: 0,
        mediaId: null,
      });

      return NextResponse.json(
        { ok: false, error: "Instagram reel için seçilecek ürün bulunamadı." },
        { status: 404 },
      );
    }

    const draft = await buildInstagramReelDraftForSlug(selection.productSlug);
    if (!draft) {
      await finishInstagramRun(supabase, runId, {
        status: "failed",
        finishedAt: new Date().toISOString(),
        message: "Seçilen ürün için reel draft üretilemedi.",
        sampleSize: 0,
        sourceCount: 0,
        matchedProductCount: 0,
        mediaId: null,
      });

      return NextResponse.json(
        { ok: false, error: "Seçilen ürün için reel draft üretilemedi." },
        { status: 404 },
      );
    }

    const config = buildInstagramPublishConfig();
    if (!config) {
      await finishInstagramRun(supabase, runId, {
        status: "failed",
        finishedAt: new Date().toISOString(),
        message: "Instagram yayınlama ortam değişkenleri eksik.",
        sampleSize: draft.sampleSize,
        sourceCount: draft.sourceCount,
        matchedProductCount: 1,
        mediaId: null,
      });

      return NextResponse.json(
        {
          ok: false,
          error: "Instagram yayınlama ortam değişkenleri eksik.",
        },
        { status: 500 },
      );
    }

    const videoUrl = getAbsoluteUrl(`/api/instagram/reels/${draft.productSlug}`);
    const caption = buildInstagramReelCaptionForDraft(draft);
    const publishResult = await publishInstagramReel(config, {
      videoUrl,
      caption,
      shareToFeed: true,
    });

    await finishInstagramRun(supabase, runId, {
      status: "success",
      finishedAt: new Date().toISOString(),
      message: null,
      sampleSize: draft.sampleSize,
      sourceCount: draft.sourceCount,
      matchedProductCount: 1,
      mediaId: publishResult.mediaId,
    });

    return NextResponse.json({
      ok: true,
      status: "success",
      productSlug: draft.productSlug,
      productName: draft.productName,
      mediaId: publishResult.mediaId,
      creationId: publishResult.creationId,
      videoUrl,
    });
  } catch (error) {
    const message = getErrorMessage(error);
    await finishInstagramRun(supabase, runId, {
      status: "failed",
      finishedAt: new Date().toISOString(),
      message,
      sampleSize: 0,
      sourceCount: 0,
      matchedProductCount: 0,
      mediaId: null,
    });

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}

async function hasValidSecret(request: NextRequest, secret: string) {
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

async function createInstagramRun(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  startedAt: string,
) {
  const { data, error } = await supabase
    .from("bot_runs")
    .insert({
      source_id: null,
      status: "running",
      run_type: "instagram_reel",
      started_at: startedAt,
      error_message: "Instagram reel çalışıyor.",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Instagram run kaydı oluşturulamadı.");
  }

  return Number(data.id);
}

async function hasRecentSuccessfulRun(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  startedAt: string,
) {
  const recentWindow = new Date(new Date(startedAt).getTime() - 20 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("bot_runs")
    .select("id, status, run_type, created_at")
    .eq("run_type", "instagram_reel")
    .eq("status", "success")
    .gte("created_at", recentWindow)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

async function finishInstagramRun(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  runId: number,
  input: {
    status: string;
    finishedAt: string;
    message: string | null;
    sampleSize: number;
    sourceCount: number;
    matchedProductCount: number;
    mediaId: string | null;
  },
) {
  const payload = {
    status: input.status,
    finished_at: input.finishedAt,
    found_count: input.sampleSize,
    imported_count: input.mediaId ? 1 : 0,
    skipped_count: input.status === "skipped" ? 1 : 0,
    error_count: input.status === "failed" ? 1 : 0,
    matched_product_count: input.matchedProductCount,
    error_message: input.message,
  };

  let result = await supabase.from("bot_runs").update(payload).eq("id", runId);
  if (result.error) {
    const { matched_product_count: _matchedProductCount, ...legacyPayload } =
      payload;
    result = await supabase.from("bot_runs").update(legacyPayload).eq("id", runId);
  }

  if (result.error) {
    console.error("Instagram run finalization failed:", result.error);
  }
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
  return "Bilinmeyen Instagram hatası";
}
