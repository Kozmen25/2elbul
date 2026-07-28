/**
 * Core types for the Monitoring & Alerting platform.
 *
 * All types are additive — they describe metrics read from existing engines
 * without modifying them.
 */

// ─── Metric Types ───────────────────────────────────────────────────────────

export interface SourceHealthMetric {
  sourceId: number;
  sourceName: string;
  successCount: number;
  failureCount: number;
  successRate: number; // 0–100
  avgResponseTime: number; // ms
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  listingsCollected: number;
  status: "healthy" | "degraded" | "down";
}

export interface BotHealthMetric {
  botId: string;
  botName: string;
  sourceId: number;
  sourceName: string;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  successRate: number; // 0–100
  avgDurationMs: number;
  consecutiveFailures: number;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
  status: "healthy" | "degraded" | "down";
}

export interface ImportMetric {
  importId: string;
  sourceId: number | null;
  sourceName: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  totalListings: number;
  successfulListings: number;
  failedListings: number;
  errorRate: number; // 0–100
  status: "running" | "completed" | "failed" | "aborted";
  error: string | null;
  listingsPerSecond: number;
}

export interface ImportSummaryMetric {
  period: string; // ISO date/hour
  totalImports: number;
  successfulImports: number;
  failedImports: number;
  abortedImports: number;
  totalListings: number;
  avgDurationMs: number;
  avgErrorRate: number;
}

export interface QueueMetric {
  queueName: string;
  depth: number;
  processingCount: number;
  pendingCount: number;
  failedCount: number;
  avgProcessingTimeMs: number;
  oldestItemAgeSec: number;
  processedLastHour: number;
  failureRate: number; // 0–100
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: string;
  tags: Record<string, string>;
}

// ─── Alert Types ────────────────────────────────────────────────────────────

export type AlertType =
  | "consecutive_failures"
  | "timeout"
  | "http_error"
  | "cloudflare_detected"
  | "captcha_detected"
  | "empty_import"
  | "abnormal_duplicate_rate"
  | "source_unavailable";

export type AlertSeverity = "critical" | "warning" | "info";
export type AlertStatus = "active" | "acknowledged" | "resolved" | "silenced";

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  message: string;
  sourceId: number | null;
  sourceName: string | null;
  metadata: Record<string, unknown>;
  triggeredAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  resolvedAt: string | null;
  expiresAt: string | null;
  count: number; // how many times this alert fired
}

export interface AlertRule {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  enabled: boolean;
  threshold: number;
  windowSec: number; // evaluation window
  cooldownSec: number; // minimum gap between firings
  description: string;
}

// ─── Health Score ───────────────────────────────────────────────────────────

export type HealthStatus = "healthy" | "degraded" | "critical";

export interface HealthScoreComponent {
  name: string;
  score: number; // 0–100
  weight: number; // 0–1, sum = 1
  status: HealthStatus;
  detail: string;
}

export interface HealthScore {
  overall: number; // 0–100
  status: HealthStatus;
  components: HealthScoreComponent[];
  updatedAt: string;
}

// ─── Extensible Provider Interfaces ─────────────────────────────────────────

export interface MetricsExporter {
  readonly name: string;
  export(snapshot: MetricsSnapshot): Promise<void>;
}

export interface AlertNotifier {
  readonly name: string;
  send(alert: Alert): Promise<void>;
}

export interface AlertStore {
  save(alert: Alert): Promise<void>;
  list(filter?: AlertFilter): Promise<Alert[]>;
  acknowledge(id: string, by: string): Promise<void>;
  resolve(id: string): Promise<void>;
  getActive(): Promise<Alert[]>;
}

// ─── Composite / Snapshot Types ─────────────────────────────────────────────

export interface MetricsSnapshot {
  timestamp: string;
  sources: SourceHealthMetric[];
  bots: BotHealthMetric[];
  imports: ImportSummaryMetric[];
  queues: QueueMetric[];
  healthScore: HealthScore;
  activeAlerts: Alert[];
}

export interface AlertFilter {
  type?: AlertType;
  severity?: AlertSeverity;
  status?: AlertStatus;
  sourceId?: number;
  limit?: number;
  offset?: number;
}

export interface MonitoringSummary {
  overallHealth: HealthScore;
  alerts: Alert[];
  activeAlertCount: number;
  criticalAlertCount: number;
  warningAlertCount: number;
  infoAlertCount: number;
  healthySourceCount: number;
  degradedSourceCount: number;
  criticalSourceCount: number;
  totalSources: number;
  successfulImportsLastHour: number;
  failedImportsLastHour: number;
  totalQueueDepth: number;
  lastUpdated: string;
}

// ─── API Types ──────────────────────────────────────────────────────────────

export interface MetricsReportRequest {
  sources?: boolean;
  bots?: boolean;
  imports?: boolean;
  queues?: boolean;
  alerts?: boolean;
  health?: boolean;
}

export interface AcknowledgeAlertRequest {
  alertId: string;
  acknowledgedBy: string;
}

export interface ReportMetricRequest {
  type: "bot_run" | "import_run" | "source_check" | "queue_check" | "performance";
  data: Record<string, unknown>;
  timestamp: string;
}
