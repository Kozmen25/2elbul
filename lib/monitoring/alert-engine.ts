/**
 * AlertEngine — evaluates alert rules against metrics and manages alert state.
 *
 * Architecture:
 * - AlertRules define conditions (type, threshold, window, cooldown)
 * - AlertEngine evaluates rules against metric snapshots
 * - In-memory store keeps active alerts (can be swapped for DB-backed store)
 * - AlertNotifier interface for extensible notification (Slack, Discord, Email — NOT integrated yet)
 */

import type {
  Alert,
  AlertRule,
  AlertType,
  AlertSeverity,
  AlertStatus,
  AlertFilter,
  AlertNotifier,
  AlertStore,
  SourceHealthMetric,
  BotHealthMetric,
  ImportMetric,
  ImportSummaryMetric,
  QueueMetric,
} from "./types";

import { SupabaseAlertStore } from "./supabase-alert-store";
import { WebhookNotifier } from "./webhook-notifier";

// ─── Default Alert Rules ────────────────────────────────────────────────────

export const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    id: "consecutive-failures-critical",
    type: "consecutive_failures",
    severity: "critical",
    enabled: true,
    threshold: 3,
    windowSec: 3600,
    cooldownSec: 600,
    description: "Bot or source has 3+ consecutive failures",
  },
  {
    id: "consecutive-failures-warning",
    type: "consecutive_failures",
    severity: "warning",
    enabled: true,
    threshold: 2,
    windowSec: 3600,
    cooldownSec: 300,
    description: "Bot or source has 2 consecutive failures",
  },
  {
    id: "timeout-critical",
    type: "timeout",
    severity: "critical",
    enabled: true,
    threshold: 60000, // 60 seconds
    windowSec: 300,
    cooldownSec: 600,
    description: "Response time exceeds 60 seconds",
  },
  {
    id: "timeout-warning",
    type: "timeout",
    severity: "warning",
    enabled: true,
    threshold: 30000, // 30 seconds
    windowSec: 300,
    cooldownSec: 300,
    description: "Response time exceeds 30 seconds",
  },
  {
    id: "http-error",
    type: "http_error",
    severity: "warning",
    enabled: true,
    threshold: 20, // 20% error rate
    windowSec: 600,
    cooldownSec: 600,
    description: "HTTP error rate exceeds 20%",
  },
  {
    id: "http-error-critical",
    type: "http_error",
    severity: "critical",
    enabled: true,
    threshold: 50,
    windowSec: 300,
    cooldownSec: 600,
    description: "HTTP error rate exceeds 50%",
  },
  {
    id: "cloudflare-detected",
    type: "cloudflare_detected",
    severity: "warning",
    enabled: true,
    threshold: 1,
    windowSec: 300,
    cooldownSec: 1800, // 30 min — Cloudflare issues take time to resolve
    description: "Cloudflare challenge detected — bot may be blocked",
  },
  {
    id: "captcha-detected",
    type: "captcha_detected",
    severity: "critical",
    enabled: true,
    threshold: 1,
    windowSec: 300,
    cooldownSec: 1800,
    description: "CAPTCHA detected — bot is blocked",
  },
  {
    id: "empty-import",
    type: "empty_import",
    severity: "warning",
    enabled: true,
    threshold: 0,
    windowSec: 600,
    cooldownSec: 900,
    description: "Import completed with 0 listings",
  },
  {
    id: "abnormal-duplicate-rate",
    type: "abnormal_duplicate_rate",
    severity: "warning",
    enabled: true,
    threshold: 30, // 30% deviation from normal
    windowSec: 3600,
    cooldownSec: 1800,
    description: "Duplicate rate deviates more than 30% from baseline",
  },
  {
    id: "source-unavailable",
    type: "source_unavailable",
    severity: "critical",
    enabled: true,
    threshold: 1,
    windowSec: 300,
    cooldownSec: 600,
    description: "Source is completely unreachable",
  },
];

// ─── In-Memory Alert Store ──────────────────────────────────────────────────

let alertIdCounter = 0;
const alerts: Alert[] = [];

function generateAlertId(): string {
  alertIdCounter++;
  return `alert-${Date.now()}-${alertIdCounter}`;
}

export class InMemoryAlertStore implements AlertStore {
  async save(alert: Alert): Promise<void> {
    const existing = alerts.findIndex((a) => a.id === alert.id);
    if (existing >= 0) {
      alerts[existing] = alert;
    } else {
      alerts.push(alert);
    }
  }

  async list(filter?: AlertFilter): Promise<Alert[]> {
    let result = [...alerts];

    if (filter?.type) result = result.filter((a) => a.type === filter.type);
    if (filter?.severity) result = result.filter((a) => a.severity === filter.severity);
    if (filter?.status) result = result.filter((a) => a.status === filter.status);
    if (filter?.sourceId) result = result.filter((a) => a.sourceId === filter.sourceId);

    result.sort((a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime());

    const offset = filter?.offset ?? 0;
    const limit = filter?.limit ?? 50;
    return result.slice(offset, offset + limit);
  }

  async acknowledge(id: string, by: string): Promise<void> {
    const alert = alerts.find((a) => a.id === id);
    if (alert && alert.status === "active") {
      alert.status = "acknowledged";
      alert.acknowledgedAt = new Date().toISOString();
      alert.acknowledgedBy = by;
    }
  }

  async resolve(id: string): Promise<void> {
    const alert = alerts.find((a) => a.id === id);
    if (alert && (alert.status === "active" || alert.status === "acknowledged")) {
      alert.status = "resolved";
      alert.resolvedAt = new Date().toISOString();
    }
  }

  async getActive(): Promise<Alert[]> {
    return alerts.filter(
      (a) => a.status === "active" || a.status === "acknowledged",
    );
  }
}

// ─── Alert Engine ───────────────────────────────────────────────────────────

export interface AlertEngineOptions {
  rules?: AlertRule[];
  store?: AlertStore;
  notifiers?: AlertNotifier[];
}

export class AlertEngine {
  private rules: AlertRule[];
  private store: AlertStore;
  private notifiers: AlertNotifier[];
  private lastTriggered = new Map<string, number>(); // key → timestamp

  constructor(options?: AlertEngineOptions) {
    this.rules = options?.rules ?? DEFAULT_ALERT_RULES;
    this.store = options?.store ?? new InMemoryAlertStore();
    this.notifiers = options?.notifiers ?? [];
  }

  /**
   * Evaluate all enabled alert rules against current metrics.
   * Returns newly triggered alerts.
   */
  async evaluate(
    sources: SourceHealthMetric[],
    bots: BotHealthMetric[],
    imports: ImportMetric[],
    importSummaries: ImportSummaryMetric[],
    queues: QueueMetric[],
  ): Promise<Alert[]> {
    const triggered: Alert[] = [];
    const activeRules = this.rules.filter((r) => r.enabled);

    for (const rule of activeRules) {
      const newAlerts = await this.evaluateRule(rule, sources, bots, imports, importSummaries, queues);
      triggered.push(...newAlerts);
    }

    // Auto-resolve alerts for metrics that have recovered
    await this.autoResolve(sources, bots);

    return triggered;
  }

  private async evaluateRule(
    rule: AlertRule,
    sources: SourceHealthMetric[],
    bots: BotHealthMetric[],
    _imports: ImportMetric[],
    importSummaries: ImportSummaryMetric[],
    _queues: QueueMetric[],
  ): Promise<Alert[]> {
    const now = Date.now();
    const triggered: Alert[] = [];

    switch (rule.type) {
      case "consecutive_failures":
        // Check bots
        for (const bot of bots) {
          if (bot.consecutiveFailures >= rule.threshold) {
            const key = `consecutive:bot:${bot.botId}`;
            if (this.canTrigger(key, rule, now)) {
              triggered.push(
                this.createAlert(rule, bot.botId, bot.sourceId, bot.sourceName, {
                  botId: bot.botId,
                  consecutiveFailures: bot.consecutiveFailures,
                  lastError: bot.lastError,
                }),
              );
              this.lastTriggered.set(key, now);
            }
          }
        }
        // Check sources
        for (const source of sources) {
          if (source.failureCount >= rule.threshold && source.status === "down") {
            const key = `consecutive:source:${source.sourceId}`;
            if (this.canTrigger(key, rule, now)) {
              triggered.push(
                this.createAlert(rule, String(source.sourceId), source.sourceId, source.sourceName, {
                  sourceId: source.sourceId,
                  failureCount: source.failureCount,
                  successRate: source.successRate,
                }),
              );
              this.lastTriggered.set(key, now);
            }
          }
        }
        break;

      case "timeout":
        for (const source of sources) {
          if (source.avgResponseTime >= rule.threshold) {
            const key = `timeout:${source.sourceId}`;
            if (this.canTrigger(key, rule, now)) {
              triggered.push(
                this.createAlert(rule, String(source.sourceId), source.sourceId, source.sourceName, {
                  avgResponseTime: source.avgResponseTime,
                  threshold: rule.threshold,
                }),
              );
              this.lastTriggered.set(key, now);
            }
          }
        }
        break;

      case "http_error":
        for (const source of sources) {
          if (source.failureCount > 0) {
            if (source.successRate < 100 - rule.threshold) {
              const key = `http-error:${source.sourceId}`;
              if (this.canTrigger(key, rule, now)) {
                triggered.push(
                  this.createAlert(rule, String(source.sourceId), source.sourceId, source.sourceName, {
                    successRate: source.successRate,
                    errorRate: 100 - source.successRate,
                    threshold: rule.threshold,
                  }),
                );
                this.lastTriggered.set(key, now);
              }
            }
          }
        }
        break;

      case "cloudflare_detected":
        for (const bot of bots) {
          if (bot.lastError?.toLowerCase().includes("cloudflare")) {
            const key = `cloudflare:${bot.botId}`;
            if (this.canTrigger(key, rule, now)) {
              triggered.push(
                this.createAlert(rule, bot.botId, bot.sourceId, bot.sourceName, {
                  botId: bot.botId,
                  lastError: bot.lastError,
                }),
              );
              this.lastTriggered.set(key, now);
            }
          }
        }
        break;

      case "captcha_detected":
        for (const bot of bots) {
          if (bot.lastError?.toLowerCase().includes("captcha")) {
            const key = `captcha:${bot.botId}`;
            if (this.canTrigger(key, rule, now)) {
              triggered.push(
                this.createAlert(rule, bot.botId, bot.sourceId, bot.sourceName, {
                  botId: bot.botId,
                  lastError: bot.lastError,
                }),
              );
              this.lastTriggered.set(key, now);
            }
          }
        }
        break;

      case "empty_import":
        for (const imp of _imports) {
          if (imp.totalListings === 0) {
            const key = `empty-import:${imp.importId}`;
            if (this.canTrigger(key, rule, now)) {
              triggered.push(
                this.createAlert(rule, imp.importId, imp.sourceId, imp.sourceName, {
                  importId: imp.importId,
                  status: imp.status,
                }),
              );
              this.lastTriggered.set(key, now);
            }
          }
        }
        // Also check summaries for periods with 0 listings
        for (const s of importSummaries) {
          if (s.totalListings === 0 && s.totalImports > 0) {
            const key = `empty-import:summary:${s.period}`;
            if (this.canTrigger(key, rule, now)) {
              triggered.push(
                this.createAlert(rule, s.period, null, "Import Pipeline", {
                  period: s.period,
                  totalImports: s.totalImports,
                }),
              );
              this.lastTriggered.set(key, now);
            }
          }
        }
        break;

      case "abnormal_duplicate_rate":
        // Baseline: monitor the import summary error rates as proxy
        // Real implementation would compare against rolling baseline of duplicate engine output
        for (const s of importSummaries) {
          if (s.avgErrorRate > rule.threshold) {
            const key = `abnormal:${s.period}`;
            if (this.canTrigger(key, rule, now)) {
              triggered.push(
                this.createAlert(rule, s.period, null, "Import Pipeline", {
                  period: s.period,
                  avgErrorRate: s.avgErrorRate,
                  threshold: rule.threshold,
                }),
              );
              this.lastTriggered.set(key, now);
            }
          }
        }
        break;

      case "source_unavailable":
        for (const source of sources) {
          if (source.status === "down") {
            const key = `unavailable:${source.sourceId}`;
            if (this.canTrigger(key, rule, now)) {
              triggered.push(
                this.createAlert(rule, String(source.sourceId), source.sourceId, source.sourceName, {
                  successRate: source.successRate,
                  lastFailureAt: source.lastFailureAt,
                }),
              );
              this.lastTriggered.set(key, now);
            }
          }
        }
        break;
    }

    // Persist triggered alerts
    for (const alert of triggered) {
      await this.store.save(alert);
      await this.notify(alert);
    }

    return triggered;
  }

  private canTrigger(key: string, rule: AlertRule, now: number): boolean {
    const last = this.lastTriggered.get(key);
    if (!last) return true;
    return now - last >= rule.cooldownSec * 1000;
  }

  private createAlert(
    rule: AlertRule,
    targetName: string,
    sourceId: number | null,
    sourceName: string | null,
    metadata: Record<string, unknown>,
  ): Alert {
    const typeLabels: Record<AlertType, string> = {
      consecutive_failures: "Consecutive Failures",
      timeout: "Timeout",
      http_error: "HTTP Error",
      cloudflare_detected: "Cloudflare Detected",
      captcha_detected: "CAPTCHA Detected",
      empty_import: "Empty Import",
      abnormal_duplicate_rate: "Abnormal Duplicate Rate",
      source_unavailable: "Source Unavailable",
    };

    const severityLabel = rule.severity.toUpperCase();

    return {
      id: generateAlertId(),
      type: rule.type,
      severity: rule.severity,
      status: "active",
      title: `[${severityLabel}] ${typeLabels[rule.type]} — ${sourceName ?? targetName}`,
      message: `${rule.description}. Source: ${sourceName ?? targetName}. Details: ${JSON.stringify(metadata)}`,
      sourceId,
      sourceName,
      metadata,
      triggeredAt: new Date().toISOString(),
      acknowledgedAt: null,
      acknowledgedBy: null,
      resolvedAt: null,
      expiresAt: null,
      count: 1,
    };
  }

  private async notify(alert: Alert): Promise<void> {
    for (const notifier of this.notifiers) {
      try {
        await notifier.send(alert);
      } catch (err) {
        console.warn(`[AlertEngine] Notifier ${notifier.name} failed:`, err);
      }
    }
  }

  /**
   * Auto-resolve alerts for sources/bots that have recovered.
   */
  private async autoResolve(
    sources: SourceHealthMetric[],
    bots: BotHealthMetric[],
  ): Promise<void> {
    const active = await this.store.getActive();

    const healthySourceIds = new Set(
      sources.filter((s) => s.status === "healthy").map((s) => s.sourceId),
    );
    const healthyBotIds = new Set(
      bots.filter((b) => b.status === "healthy").map((b) => b.botId),
    );

    for (const alert of active) {
      if (alert.status === "resolved") continue;

      // Resolve source-related alerts if source is healthy
      if (alert.sourceId && healthySourceIds.has(alert.sourceId)) {
        const recoveryTypes = new Set<AlertType>([
          "source_unavailable", "http_error", "timeout", "consecutive_failures",
        ]);
        if (recoveryTypes.has(alert.type)) {
          await this.store.resolve(alert.id);
        }
      }

      // Resolve bot-related alerts if bot is healthy
      const botId = alert.metadata?.botId as string | undefined;
      if (botId && healthyBotIds.has(botId)) {
        await this.store.resolve(alert.id);
      }
    }
  }
}

// ─── Singleton Instance ─────────────────────────────────────────────────────

let instance: AlertEngine | null = null;

export function getAlertEngine(): AlertEngine {
  if (!instance) {
    instance = new AlertEngine({ store: getAlertStore(), notifiers: getNotifiers() });
  }
  return instance;
}

export function resetAlertEngine(): void {
  instance = null;
}

// ─── Feature Flags ─────────────────────────────────────────────────────────────

function getAlertStore(): AlertStore {
  const mode = (process.env.ALERT_STORE ?? "memory").toLowerCase();
  if (mode === "supabase") {
    return new SupabaseAlertStore();
  }
  return new InMemoryAlertStore();
}

function getNotifiers(): WebhookNotifier[] {
  if (process.env.ALERT_WEBHOOK_URL) {
    return [new WebhookNotifier()];
  }
  return [];
}

export async function listActiveAlerts(): Promise<Alert[]> {
  return getAlertStore().getActive();
}

export async function listAlerts(filter?: AlertFilter): Promise<Alert[]> {
  return getAlertStore().list(filter);
}

export async function acknowledgeAlert(id: string, by: string): Promise<void> {
  return getAlertStore().acknowledge(id, by);
}

export async function resolveAlert(id: string): Promise<void> {
  return getAlertStore().resolve(id);
}
