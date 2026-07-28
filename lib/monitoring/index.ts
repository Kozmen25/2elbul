/**
 * Monitoring & Alerting platform — barrel exports.
 *
 * Re-exports all types, collectors, and alert engine for external consumption.
 */

export * from "./types";

export {
  collectSourceHealth,
  collectBotHealth,
  collectImportMetrics,
  collectQueueMetrics,
  collectPerformanceMetrics,
  collectMonitoringSummary,
  collectMetricsSnapshot,
  calculateHealthScore,
} from "./metrics-collector";

export {
  AlertEngine,
  InMemoryAlertStore,
  DEFAULT_ALERT_RULES,
  getAlertEngine,
  resetAlertEngine,
  listActiveAlerts,
  listAlerts,
  acknowledgeAlert,
  resolveAlert,
} from "./alert-engine";

export { WebhookNotifier } from "./webhook-notifier";

export type { AlertEngineOptions } from "./alert-engine";
