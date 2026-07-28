import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { hasValidSecret } from "@/lib/auth/cron-auth";
import { DeadLetterQueue, RecoveryMetricsService } from "@/lib/recovery";

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

  const dlq = new DeadLetterQueue(supabase);
  const metrics = new RecoveryMetricsService(supabase);

  // Fetch all pending DLQ entries
  const { data: pending, error: listError } = await supabase
    .from("dead_letter_queue")
    .select("*")
    .eq("status", "pending")
    .limit(100);

  if (listError) {
    console.error("[RetryDLQ] pending listesi alınamadı:", listError);
    return NextResponse.json(
      { ok: false, error: listError.message },
      { status: 500 },
    );
  }

  const entries = (pending ?? []) as Array<{
    id: string;
    retry_count: number;
    max_retries: number;
    source_slug: string;
    source_id: number | null;
  }>;

  // Filter entries that still have retry budget
  const retryable = entries.filter((e) => e.retry_count < e.max_retries);
  const alreadyExhausted = entries.filter((e) => e.retry_count >= e.max_retries);

  // Mark exhausted entries as dead
  for (const entry of alreadyExhausted) {
    await dlq.markDead(entry.id);
  }

  const retried: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  for (const entry of retryable) {
    const nextRetry = entry.retry_count + 1;
    const nextRetryAt = computeNextRetryAt(nextRetry);

    try {
      // Update retry_count and set status/next_retry_at
      await supabase
        .from("dead_letter_queue")
        .update({
          retry_count: nextRetry,
          status: "retrying",
          next_retry_at: nextRetryAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", entry.id);

      // Re-invoke the source to see if it recovers
      const origin = getRetryOrigin(request);
      const sourceUrl = `${origin}/api/cron/run-sources?sourceSlug=${encodeURIComponent(entry.source_slug)}&limit=10`;

      const response = await fetch(sourceUrl, {
        headers: { "x-cron-secret": secret },
        cache: "no-store",
        signal: AbortSignal.timeout(25_000),
      });

      if (response.ok) {
        await dlq.resolve(entry.id, `Otomatik tekrar denendi (${nextRetry}/${entry.max_retries})`);
        retried.push(entry.id);
        await metrics.record({
          source_id: entry.source_id,
          source_slug: entry.source_slug,
          metric_type: "recovery_success",
          metadata: { dlq_id: entry.id },
        });
      } else {
        // Still failing — keep as pending for next cycle
        await supabase
          .from("dead_letter_queue")
          .update({
            status: "pending",
            updated_at: new Date().toISOString(),
          })
          .eq("id", entry.id);
        failed.push({ id: entry.id, error: `HTTP ${response.status}` });
        await metrics.record({
          source_id: entry.source_id,
          source_slug: entry.source_slug,
          metric_type: "recovery_failure",
          metadata: { dlq_id: entry.id, http_status: response.status },
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bilinmeyen hata";
      // Network error — keep as pending for next cycle
      await supabase
        .from("dead_letter_queue")
        .update({
          status: "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", entry.id);
      failed.push({ id: entry.id, error: message });
      await metrics.record({
        source_id: entry.source_id,
        source_slug: entry.source_slug,
        metric_type: "recovery_failure",
        metadata: { dlq_id: entry.id, error: message },
      });
    }
  }

  return NextResponse.json({
    ok: true,
    totalPending: entries.length,
    retryable: retryable.length,
    alreadyExhausted: alreadyExhausted.length,
    retried: retried.length,
    failed: failed.length,
  });
}

function getRetryOrigin(request: NextRequest) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) return siteUrl.replace(/\/$/, "");
  return request.nextUrl.origin;
}

function computeNextRetryAt(retryCount: number): string {
  const baseDelayMs = 60_000; // 1 minute base
  const maxDelayMs = 86_400_000; // 24 hours cap
  const delay = Math.min(baseDelayMs * Math.pow(2, retryCount - 1), maxDelayMs);
  return new Date(Date.now() + delay).toISOString();
}
