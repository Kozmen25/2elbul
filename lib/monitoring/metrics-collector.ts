/**
 * MetricsCollector — gathers metrics from existing platform modules.
 *
 * Reads from Source Registry, bot system, import pipeline, and queue system
 * WITHOUT modifying any of them. All data is read-only observation.
 */

import { createClient } from "@supabase/supabase-js";
import type {
  SourceHealthMetric,
  BotHealthMetric,
  ImportMetric,
  ImportSummaryMetric,
  QueueMetric,
  PerformanceMetric,
  MetricsSnapshot,
  MonitoringSummary,
  HealthScore,
} from "./types";

// ─── Supabase Client ────────────────────────────────────────────────────────

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ─── Source Health ──────────────────────────────────────────────────────────

export async function collectSourceHealth(): Promise<SourceHealthMetric[]> {
  const supabase = getClient();

  const { data: runLogs, error: runError } = await supabase
    .from("source_run_logs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(1000);

  if (runError) {
    console.warn("[Metrics] Failed to fetch source run logs:", runError.message);
    return [];
  }

  // Aggregate by source
  const sourceMap = new Map<
    number,
    {
      total: number;
      success: number;
      failure: number;
      totalResponseMs: number;
      lastRun: string | null;
      lastSuccess: string | null;
      lastFailure: string | null;
      lastError: string | null;
      listings: number;
    }
  >();

  // Also fetch source names from source_registry table
  const { data: sources } = await supabase
    .from("sources")
    .select("id, name")
    .order("id");

  // Initialize all known sources
  if (sources) {
    for (const s of sources) {
      if (!sourceMap.has(s.id)) {
        sourceMap.set(s.id, {
          total: 0,
          success: 0,
          failure: 0,
          totalResponseMs: 0,
          lastRun: null,
          lastSuccess: null,
          lastFailure: null,
          lastError: null,
          listings: 0,
        });
      }
    }
  }

  if (runLogs) {
    for (const log of runLogs) {
      const sid = log.source_id ?? log.sourceId;
      if (sid == null) continue;

      let entry = sourceMap.get(sid);
      if (!entry) {
        entry = {
          total: 0,
          success: 0,
          failure: 0,
          totalResponseMs: 0,
          lastRun: null,
          lastSuccess: null,
          lastFailure: null,
          lastError: null,
          listings: 0,
        };
        sourceMap.set(sid, entry);
      }

      entry.total++;
      entry.totalResponseMs += log.duration_ms ?? log.durationMs ?? 0;
      entry.listings += log.listings_collected ?? log.listingsCollected ?? 0;

      const startedAt = log.started_at ?? log.startedAt ?? null;
      if (startedAt && (!entry.lastRun || startedAt > entry.lastRun)) {
        entry.lastRun = startedAt;
      }

      const status = log.status ?? (log.success ? "success" : "failure");
      if (status === "success") {
        entry.success++;
        if (startedAt && (!entry.lastSuccess || startedAt > entry.lastSuccess)) {
          entry.lastSuccess = startedAt;
        }
      } else {
        entry.failure++;
        if (startedAt && (!entry.lastFailure || startedAt > entry.lastFailure)) {
          entry.lastFailure = startedAt;
        }
        entry.lastError = log.error ?? log.error_message ?? null;
      }
    }
  }

  const metrics: SourceHealthMetric[] = [];
  const sourceNames = new Map<number, string>();
  if (sources) {
    for (const s of sources) {
      sourceNames.set(s.id, s.name);
    }
  }

  for (const [sourceId, data] of sourceMap) {
    const successRate = data.total > 0 ? (data.success / data.total) * 100 : 100;
    const avgResponseTime = data.total > 0 ? data.totalResponseMs / data.total : 0;

    let status: SourceHealthMetric["status"] = "healthy";
    if (data.failure >= 3 || successRate < 50) {
      status = "down";
    } else if (data.failure > 0 || successRate < 90) {
      status = "degraded";
    }

    metrics.push({
      sourceId,
      sourceName: sourceNames.get(sourceId) ?? `Source #${sourceId}`,
      successCount: data.success,
      failureCount: data.failure,
      successRate: Math.round(successRate * 100) / 100,
      avgResponseTime: Math.round(avgResponseTime),
      lastRunAt: data.lastRun,
      lastSuccessAt: data.lastSuccess,
      lastFailureAt: data.lastFailure,
      listingsCollected: data.listings,
      status,
    });
  }

  return metrics.sort((a, b) => a.sourceId - b.sourceId);
}

// ─── Bot Health ─────────────────────────────────────────────────────────────

export async function collectBotHealth(): Promise<BotHealthMetric[]> {
  const supabase = getClient();

  const { data: botLogs, error: botError } = await supabase
    .from("bot_run_logs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(2000);

  if (botError) {
    console.warn("[Metrics] Failed to fetch bot run logs:", botError.message);
    return [];
  }

  const botMap = new Map<
    string,
    {
      botId: string;
      total: number;
      success: number;
      failure: number;
      totalDurationMs: number;
      consecutiveFailures: number;
      lastRun: string | null;
      lastSuccess: string | null;
      lastFailure: string | null;
      lastError: string | null;
    }
  >();

  // Track consecutive failures — scan most recent first
  const botRunHistory = new Map<string, Array<{ status: string; startedAt: string }>>();

  if (botLogs) {
    for (const log of botLogs) {
      const bid = log.bot_id ?? log.botId ?? log.bot_name ?? "unknown";
      let entry = botMap.get(bid);
      if (!entry) {
        entry = {
          botId: bid,
          total: 0,
          success: 0,
          failure: 0,
          totalDurationMs: 0,
          consecutiveFailures: 0,
          lastRun: null,
          lastSuccess: null,
          lastFailure: null,
          lastError: null,
        };
        botMap.set(bid, entry);
      }

      entry.total++;
      entry.totalDurationMs += log.duration_ms ?? log.durationMs ?? 0;

      const startedAt = log.started_at ?? log.startedAt ?? null;
      if (startedAt && (!entry.lastRun || startedAt > entry.lastRun)) {
        entry.lastRun = startedAt;
      }

      // Track run history for consecutive failure calculation
      const history = botRunHistory.get(bid) ?? [];
      if (startedAt) {
        history.push({ status: log.status ?? (log.success ? "success" : "failure"), startedAt });
      }
      botRunHistory.set(bid, history);

      const status = log.status ?? (log.success ? "success" : "failure");
      if (status === "success") {
        entry.success++;
        if (startedAt && (!entry.lastSuccess || startedAt > entry.lastSuccess)) {
          entry.lastSuccess = startedAt;
        }
      } else {
        entry.failure++;
        if (startedAt && (!entry.lastFailure || startedAt > entry.lastFailure)) {
          entry.lastFailure = startedAt;
        }
        entry.lastError = log.error ?? log.error_message ?? null;
      }
    }
  }

  // Calculate consecutive failures from most-recent-first logs
  for (const [bid, entry] of botMap) {
    const history = (botRunHistory.get(bid) ?? []).sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );
    let consecutive = 0;
    for (const run of history) {
      if (run.status === "success") break;
      consecutive++;
    }
    entry.consecutiveFailures = consecutive;
  }

  // Map bot IDs to source info
  const metrics: BotHealthMetric[] = [];
  for (const [botId, data] of botMap) {
    const successRate = data.total > 0 ? (data.success / data.total) * 100 : 100;

    let status: BotHealthMetric["status"] = "healthy";
    if (data.consecutiveFailures >= 3 || successRate < 50) {
      status = "down";
    } else if (data.consecutiveFailures >= 1 || successRate < 90) {
      status = "degraded";
    }

    // Extract source info from bot_id convention: "sourceName-bot"
    const sourceId = extractSourceIdFromBotId(botId);

    metrics.push({
      botId,
      botName: botId,
      sourceId,
      sourceName: sourceId > 0 ? `Source #${sourceId}` : "Unknown",
      totalRuns: data.total,
      successfulRuns: data.success,
      failedRuns: data.failure,
      successRate: Math.round(successRate * 100) / 100,
      avgDurationMs: data.total > 0 ? Math.round(data.totalDurationMs / data.total) : 0,
      consecutiveFailures: data.consecutiveFailures,
      lastRunAt: data.lastRun,
      lastSuccessAt: data.lastSuccess,
      lastFailureAt: data.lastFailure,
      lastError: data.lastError,
      status,
    });
  }

  return metrics;
}

function extractSourceIdFromBotId(botId: string): number {
  // Try to extract source ID from bot naming conventions
  // e.g., "sahibinden-bot", "letgo-scraper", "easycep-adapter"
  const name = botId.toLowerCase();
  if (name.includes("sahibinden") || name.includes("sahib")) return 1;
  if (name.includes("letgo")) return 2;
  if (name.includes("facebook") || name.includes("fb")) return 3;
  if (name.includes("easycep") || name.includes("easy")) return 4;
  if (name.includes("getmobil") || name.includes("get")) return 5;
  if (name.includes("yenilenmişmarket") || name.includes("yenilenmis")) return 6;
  if (name.includes("teknosa")) return 7;
  if (name.includes("hepsiburada")) return 8;
  if (name.includes("mediamarkt")) return 9;
  if (name.includes("satarız") || name.includes("satariz")) return 10;
  return 0;
}

// ─── Import Metrics ─────────────────────────────────────────────────────────

export async function collectImportMetrics(
  hours: number = 24,
): Promise<{ active: ImportMetric[]; summary: ImportSummaryMetric[] }> {
  const supabase = getClient();
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();

  const { data: imports, error } = await supabase
    .from("import_logs")
    .select("*")
    .gte("started_at", since)
    .order("started_at", { ascending: false });

  if (error) {
    console.warn("[Metrics] Failed to fetch import logs:", error.message);
    return { active: [], summary: [] };
  }

  const active: ImportMetric[] = [];
  const hourlyMap = new Map<string, ImportSummaryMetric>();

  if (imports) {
    for (const imp of imports) {
      const startedAt = imp.started_at ?? imp.startedAt;
      const completedAt = imp.completed_at ?? imp.completedAt;
      const durationMs = imp.duration_ms ?? imp.durationMs;
      const totalListing = imp.total_listings ?? imp.totalListings ?? 0;
      const failedCount = imp.failed_listings ?? imp.failedListings ?? 0;
      const status = imp.status ?? "completed";
      const sourceId = imp.source_id ?? imp.sourceId ?? null;

      const successCount = totalListing - failedCount;
      const errorRate = totalListing > 0 ? (failedCount / totalListing) * 100 : 0;
      const duration = durationMs ?? 0;
      const listingsPerSec = duration > 0 ? (totalListing / duration) * 1000 : 0;

      // Active import
      if (status === "running") {
        active.push({
          importId: imp.id ?? imp.import_id ?? "unknown",
          sourceId,
          sourceName: sourceId ? `Source #${sourceId}` : "Unknown",
          startedAt: startedAt ?? "",
          completedAt,
          durationMs: duration,
          totalListings: totalListing,
          successfulListings: successCount,
          failedListings: failedCount,
          errorRate: Math.round(errorRate * 100) / 100,
          status: "running",
          error: imp.error ?? null,
          listingsPerSecond: Math.round(listingsPerSec * 100) / 100,
        });
      }

      // Hourly summary
      if (startedAt) {
        const hour = startedAt.substring(0, 13); // "2026-07-13T10"
        let summary = hourlyMap.get(hour);
        if (!summary) {
          summary = {
            period: hour,
            totalImports: 0,
            successfulImports: 0,
            failedImports: 0,
            abortedImports: 0,
            totalListings: 0,
            avgDurationMs: 0,
            avgErrorRate: 0,
          };
          hourlyMap.set(hour, summary);
        }
        summary.totalImports++;
        summary.totalListings += totalListing;

        if (status === "completed") summary.successfulImports++;
        else if (status === "failed") summary.failedImports++;
        else if (status === "aborted") summary.abortedImports++;

        // Running average for duration and error rate
        // Use incremental averaging to avoid overflow
        summary.avgDurationMs =
          (summary.avgDurationMs * (summary.totalImports - 1) + duration) / summary.totalImports;
        summary.avgErrorRate =
          (summary.avgErrorRate * (summary.totalImports - 1) + errorRate) / summary.totalImports;
      }
    }
  }

  const summary = Array.from(hourlyMap.values())
    .map((s) => ({
      ...s,
      avgDurationMs: Math.round(s.avgDurationMs),
      avgErrorRate: Math.round(s.avgErrorRate * 100) / 100,
    }))
    .sort((a, b) => a.period.localeCompare(b.period));

  return { active, summary };
}

// ─── Queue Metrics ──────────────────────────────────────────────────────────

export async function collectQueueMetrics(): Promise<QueueMetric[]> {
  const supabase = getClient();

  const { data: queues, error } = await supabase
    .from("job_queue")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) {
    console.warn("[Metrics] Failed to fetch queue:", error.message);
    return [];
  }

  const queueMap = new Map<
    string,
    {
      total: number;
      processing: number;
      pending: number;
      failed: number;
      totalDurationMs: number;
      processedCount: number;
      oldestAgeSec: number;
    }
  >();

  if (queues) {
    const now = Date.now();
    for (const job of queues) {
      const qname = job.queue_name ?? job.queueName ?? job.type ?? "default";
      let entry = queueMap.get(qname);
      if (!entry) {
        entry = { total: 0, processing: 0, pending: 0, failed: 0, totalDurationMs: 0, processedCount: 0, oldestAgeSec: 0 };
        queueMap.set(qname, entry);
      }

      entry.total++;
      const status = job.status ?? "pending";

      if (status === "processing") entry.processing++;
      else if (status === "pending") {
        entry.pending++;
        const createdAt = new Date(job.created_at ?? job.createdAt ?? now).getTime();
        const ageSec = Math.round((now - createdAt) / 1000);
        if (ageSec > entry.oldestAgeSec) entry.oldestAgeSec = ageSec;
      } else if (status === "failed") {
        entry.failed++;
      }

      if (status === "completed" || status === "processing") {
        const dur = job.duration_ms ?? job.durationMs ?? 0;
        if (dur > 0) {
          entry.totalDurationMs += dur;
          entry.processedCount++;
        }
      }
    }
  }

  const metrics: QueueMetric[] = [];
  for (const [queueName, data] of queueMap) {
    const processedLastHour = data.processedCount; // rough — from our limited fetch
    const failureRate = data.total > 0 ? (data.failed / data.total) * 100 : 0;

    metrics.push({
      queueName,
      depth: data.pending,
      processingCount: data.processing,
      pendingCount: data.pending,
      failedCount: data.failed,
      avgProcessingTimeMs:
        data.processedCount > 0 ? Math.round(data.totalDurationMs / data.processedCount) : 0,
      oldestItemAgeSec: data.oldestAgeSec,
      processedLastHour,
      failureRate: Math.round(failureRate * 100) / 100,
    });
  }

  return metrics.sort((a, b) => a.queueName.localeCompare(b.queueName));
}

// ─── Performance Metrics ────────────────────────────────────────────────────

export async function collectPerformanceMetrics(): Promise<PerformanceMetric[]> {
  const metrics: PerformanceMetric[] = [
    {
      name: "memory_usage_mb",
      value: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      unit: "MB",
      timestamp: new Date().toISOString(),
      tags: { host: process.env.HOSTNAME ?? "local" },
    },
    {
      name: "uptime_seconds",
      value: Math.round(process.uptime()),
      unit: "s",
      timestamp: new Date().toISOString(),
      tags: { host: process.env.HOSTNAME ?? "local" },
    },
  ];

  return metrics;
}

// ─── Summary ────────────────────────────────────────────────────────────────

export async function collectMonitoringSummary(): Promise<MonitoringSummary> {
  const [sources, bots, imports, queues, alerts] = await Promise.all([
    collectSourceHealth(),
    collectBotHealth(),
    collectImportMetrics(1), // last hour
    collectQueueMetrics(),
    getActiveAlerts(),
  ]);

  const healthySources = sources.filter((s) => s.status === "healthy").length;
  const degradedSources = sources.filter((s) => s.status === "degraded").length;
  const downSources = sources.filter((s) => s.status === "down").length;

  // Count successful vs failed imports in the last hour
  const successfulImports = imports.summary.reduce(
    (sum, s) => sum + s.successfulImports,
    0,
  );
  const failedImports =
    imports.summary.reduce((sum, s) => sum + s.failedImports + s.abortedImports, 0);

  const totalQueueDepth = queues.reduce((sum, q) => sum + q.depth, 0);

  const criticalAlerts = alerts.filter((a) => a.severity === "critical" && a.status === "active").length;
  const warningAlerts = alerts.filter((a) => a.severity === "warning" && a.status === "active").length;
  const infoAlerts = alerts.filter((a) => a.severity === "info" && a.status === "active").length;

  return {
    overallHealth: await calculateHealthScore(sources, bots, imports, queues),
    alerts,
    activeAlertCount: criticalAlerts + warningAlerts + infoAlerts,
    criticalAlertCount: criticalAlerts,
    warningAlertCount: warningAlerts,
    infoAlertCount: infoAlerts,
    healthySourceCount: healthySources,
    degradedSourceCount: degradedSources,
    criticalSourceCount: downSources,
    totalSources: sources.length,
    successfulImportsLastHour: successfulImports,
    failedImportsLastHour: failedImports,
    totalQueueDepth,
    lastUpdated: new Date().toISOString(),
  };
}

// ─── Snapshot ───────────────────────────────────────────────────────────────

export async function collectMetricsSnapshot(): Promise<MetricsSnapshot> {
  const [sources, bots, imports, queues, performance, health, alerts] = await Promise.all([
    collectSourceHealth(),
    collectBotHealth(),
    collectImportMetrics(24),
    collectQueueMetrics(),
    collectPerformanceMetrics(),
    calculateHealthScoreFromAll(),
    getActiveAlerts(),
  ]);

  return {
    timestamp: new Date().toISOString(),
    sources,
    bots,
    imports: imports.summary,
    queues,
    healthScore: health,
    activeAlerts: alerts,
  };
}

// ─── Health Score Delegate ──────────────────────────────────────────────────

async function calculateHealthScoreFromAll(): Promise<HealthScore> {
  const [sources, bots, imports, queues] = await Promise.all([
    collectSourceHealth(),
    collectBotHealth(),
    collectImportMetrics(1),
    collectQueueMetrics(),
  ]);
  return calculateHealthScore(sources, bots, imports, queues);
}

export async function calculateHealthScore(
  sources: SourceHealthMetric[],
  bots: BotHealthMetric[],
  imports: { active: ImportMetric[]; summary: ImportSummaryMetric[] },
  queues: QueueMetric[],
): Promise<HealthScore> {
  // Source health score
  const sourceScore =
    sources.length > 0
      ? Math.round(
          sources.reduce((sum, s) => {
            if (s.status === "healthy") return sum + 100;
            if (s.status === "degraded") return sum + 60;
            return sum + 20;
          }, 0) / sources.length,
        )
      : 100;

  // Bot health score
  const botScore =
    bots.length > 0
      ? Math.round(bots.reduce((sum, b) => sum + b.successRate, 0) / bots.length)
      : 100;

  // Import health score
  const importSummary = imports.summary;
  const importScore =
    importSummary.length > 0
      ? (() => {
          const total = importSummary.reduce((s, i) => s + i.totalImports, 0);
          const failed = importSummary.reduce(
            (s, i) => s + i.failedImports + i.abortedImports,
            0,
          );
          const errorRate = total > 0 ? (failed / total) * 100 : 0;
          return Math.max(0, Math.round(100 - errorRate * 5));
        })()
      : 100;

  // Queue health score
  const queueScore =
    queues.length > 0
      ? Math.round(
          queues.reduce((sum, q) => {
            if (q.failureRate > 20) return sum + 20;
            if (q.failureRate > 10) return sum + 50;
            if (q.depth > 100) return sum + 60;
            if (q.depth > 50) return sum + 80;
            return sum + 100;
          }, 0) / queues.length,
        )
      : 100;

  // Performance score
  const perfScore = 100; // baseline — extended in future

  const components = [
    {
      name: "source_health",
      score: sourceScore,
      weight: 0.3,
      status: scoreToStatus(sourceScore),
      detail: `${sources.filter((s) => s.status === "healthy").length}/${sources.length} sources healthy`,
    },
    {
      name: "bot_health",
      score: botScore,
      weight: 0.25,
      status: scoreToStatus(botScore),
      detail: `${bots.filter((b) => b.status === "healthy").length}/${bots.length} bots healthy`,
    },
    {
      name: "import_health",
      score: importScore,
      weight: 0.2,
      status: scoreToStatus(importScore),
      detail: `Last ${importSummary.length}h: avg import quality ${importScore}/100`,
    },
    {
      name: "queue_health",
      score: queueScore,
      weight: 0.15,
      status: scoreToStatus(queueScore),
      detail: `${queues.length} queues, total depth ${queues.reduce((s, q) => s + q.depth, 0)}`,
    },
    {
      name: "performance",
      score: perfScore,
      weight: 0.1,
      status: scoreToStatus(perfScore),
      detail: "Runtime performance nominal",
    },
  ];

  const overall = Math.round(
    components.reduce((sum, c) => sum + c.score * c.weight, 0),
  );

  return {
    overall,
    status: scoreToStatus(overall),
    components,
    updatedAt: new Date().toISOString(),
  };
}

function scoreToStatus(score: number): "healthy" | "degraded" | "critical" {
  if (score >= 80) return "healthy";
  if (score >= 50) return "degraded";
  return "critical";
}

// ─── Alerts Read (lightweight, no circular dep) ─────────────────────────────

async function getActiveAlerts() {
  try {
    const { listActiveAlerts } = await import("./alert-engine");
    return await listActiveAlerts();
  } catch {
    return [];
  }
}
