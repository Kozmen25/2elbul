export type {
  ErrorCategory,
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerState,
  DLQStatus,
  DLQEntry,
  RecoveryMetricType,
  RecoveryMetric,
} from "./types";

export {
  classifyError,
  isRetryableByCategory,
} from "./failure-classification";

export { CircuitBreakerRegistry } from "./circuit-breaker";

export { RecoveryMetricsService } from "./recovery-metrics";
export type { RecoverySummary } from "./recovery-metrics";

export { DeadLetterQueue } from "./dead-letter-queue";
export type {
  DLQInsertPayload,
  DLQListFilter,
  DLQStats,
} from "./dead-letter-queue";

export { withRecoveryPolicy } from "./connector-wrapper";
