import { NextResponse, type NextRequest } from "next/server";
import { verifyAdmin } from "@/lib/auth/admin-auth";
import { hasValidSecret } from "@/lib/auth/cron-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { CircuitBreakerRegistry } from "@/lib/recovery/circuit-breaker";
import { DeadLetterQueue } from "@/lib/recovery/dead-letter-queue";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Uptime monitors only need ok/status. The breakdown (runtime version, source
 * failures, queue depth, cron timestamps) helps an attacker map the system, so
 * it is returned only with the cron secret or to a signed-in admin.
 */
async function canSeeDetails(request: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret && hasValidSecret(request, secret)) return true;
  return (await verifyAdmin()) === null;
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();

  // ─── Supabase connectivity probe ──────────────────────────────────────────
  const supabase = createSupabaseAdminClient();
  let supabaseOk = false;
  if (supabase) {
    const { error } = await supabase.from("products").select("id").limit(1);
    supabaseOk = !error;
  }

  const timestamp = new Date().toISOString();
  if (!(await canSeeDetails(request))) {
    return NextResponse.json({
      ok: supabaseOk,
      status: supabaseOk ? "healthy" : "degraded",
      timestamp,
    });
  }

  // ─── Circuit breaker states ───────────────────────────────────────────────
  const cb = CircuitBreakerRegistry.getInstance();
  const states = cb.getAllStates();
  const cbSummary = {
    total: states.length,
    closed: states.filter((s) => s.state === "closed").length,
    open: states.filter((s) => s.state === "open").length,
    halfOpen: states.filter((s) => s.state === "half_open").length,
    details: states.map((s) => ({
      slug: s.slug,
      state: s.state,
      failureCount: s.failureCount,
      tripCount: s.tripCount,
      lastFailureAt: s.lastFailureAt,
    })),
  };

  // ─── DLQ depth ────────────────────────────────────────────────────────────
  let dlqStats = { pending: 0, retrying: 0, resolved: 0, dead: 0, total: 0 };
  if (supabase) {
    const dlq = new DeadLetterQueue(supabase);
    dlqStats = await dlq.getStats();
  }

  // ─── Last cron run timestamps ─────────────────────────────────────────────
  let lastSavedSearchRun: string | null = null;
  let lastPriceAlertRun: string | null = null;
  if (supabase) {
    const [savedResult, alertResult] = await Promise.all([
      supabase
        .from("saved_searches")
        .select("last_notified_at")
        .order("last_notified_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("price_alerts")
        .select("last_checked_at")
        .order("last_checked_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (!savedResult.error && savedResult.data?.last_notified_at) {
      lastSavedSearchRun = String(savedResult.data.last_notified_at);
    }
    if (!alertResult.error && alertResult.data?.last_checked_at) {
      lastPriceAlertRun = String(alertResult.data.last_checked_at);
    }
  }

  const elapsed = Date.now() - startedAt;
  const healthy = supabaseOk;

  return NextResponse.json({
    ok: healthy,
    status: healthy ? "healthy" : "degraded",
    timestamp,
    uptime: process.uptime(),
    node: process.version,
    environment: process.env.NODE_ENV ?? "unknown",
    responseTimeMs: elapsed,
    probes: {
      supabase: { ok: supabaseOk },
    },
    circuitBreakers: cbSummary,
    deadLetterQueue: dlqStats,
    cron: {
      lastSavedSearchRun,
      lastPriceAlertRun,
    },
  });
}
