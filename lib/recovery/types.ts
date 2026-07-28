export type ErrorCategory =
  | "network" | "timeout" | "http_server" | "http_client"
  | "rate_limit" | "auth" | "parser" | "schema" | "unknown";

export type CircuitState = "closed" | "open" | "half_open";

export interface CircuitBreakerConfig {
  failureThreshold: number;
  halfOpenTimeoutMs: number;
}

export interface CircuitBreakerState {
  slug: string;
  state: CircuitState;
  failureCount: number;
  tripCount: number;
  lastFailureAt: string | null;
  openedAt: string | null;
  lastTestedAt: string | null;
}

export type DLQStatus = "pending" | "retrying" | "resolved" | "dead";

export interface DLQEntry {
  id: string;
  source_id: number | null;
  source_slug: string;
  queue_type: "scrape" | "search_queue";
  retry_count: number;
  max_retries: number;
  last_error: string;
  error_category: ErrorCategory;
  payload: Record<string, unknown> | null;
  status: DLQStatus;
  next_retry_at: string | null;
  resolved_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
}

export type RecoveryMetricType =
  | "cb_trip" | "cb_reset" | "cb_half_open"
  | "dlq_insert" | "dlq_retry" | "dlq_resolve"
  | "recovery_success" | "recovery_failure";

export interface RecoveryMetric {
  id: string;
  source_id: number | null;
  source_slug: string;
  metric_type: RecoveryMetricType;
  recorded_at: string;
  metadata: Record<string, unknown> | null;
}
