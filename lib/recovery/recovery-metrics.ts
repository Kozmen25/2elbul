import type { SupabaseClient } from "@supabase/supabase-js";
import type { RecoveryMetric, RecoveryMetricType } from "./types";

export interface RecoverySummary {
  cbTrip: number;
  cbReset: number;
  cbHalfOpen: number;
  dlqInsert: number;
  dlqRetry: number;
  dlqResolve: number;
  recoverySuccess: number;
  recoveryFailure: number;
  total: number;
}

export class RecoveryMetricsService {
  constructor(private supabase: SupabaseClient) {}

  async record(metric: {
    source_id: number | null;
    source_slug: string;
    metric_type: RecoveryMetricType;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const { error } = await this.supabase.from("recovery_metrics").insert({
      source_id: metric.source_id,
      source_slug: metric.source_slug,
      metric_type: metric.metric_type,
      metadata: metric.metadata ?? {},
    });

    if (error) {
      console.error("[RecoveryMetrics] kayıt hatası:", error);
    }
  }

  async getSummary(since?: string): Promise<RecoverySummary> {
    let query = this.supabase
      .from("recovery_metrics")
      .select("metric_type", { count: "exact" });

    if (since) {
      query = query.gte("recorded_at", since);
    }

    const { data, error } = await query;

    if (error || !data) {
      return emptySummary();
    }

    const summary = emptySummary();
    for (const row of data) {
      const key = metricTypeToKey(row.metric_type as RecoveryMetricType);
      if (key) (summary as any)[key]++;
    }
    summary.total = data.length;
    return summary;
  }

  async getBySource(
    slug: string,
    since?: string,
  ): Promise<RecoveryMetric[]> {
    let query = this.supabase
      .from("recovery_metrics")
      .select("*")
      .eq("source_slug", slug);

    if (since) {
      query = query.gte("recorded_at", since);
    }

    const { data, error } = await query;

    if (error || !data) return [];
    return data as RecoveryMetric[];
  }
}

function metricTypeToKey(
  type: RecoveryMetricType,
): keyof RecoverySummary | null {
  switch (type) {
    case "cb_trip":
      return "cbTrip";
    case "cb_reset":
      return "cbReset";
    case "cb_half_open":
      return "cbHalfOpen";
    case "dlq_insert":
      return "dlqInsert";
    case "dlq_retry":
      return "dlqRetry";
    case "dlq_resolve":
      return "dlqResolve";
    case "recovery_success":
      return "recoverySuccess";
    case "recovery_failure":
      return "recoveryFailure";
    default:
      return null;
  }
}

function emptySummary(): RecoverySummary {
  return {
    cbTrip: 0,
    cbReset: 0,
    cbHalfOpen: 0,
    dlqInsert: 0,
    dlqRetry: 0,
    dlqResolve: 0,
    recoverySuccess: 0,
    recoveryFailure: 0,
    total: 0,
  };
}
