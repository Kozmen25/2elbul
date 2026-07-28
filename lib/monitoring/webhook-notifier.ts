import type { Alert, AlertNotifier } from "./types";

const RETRY_COUNT = 2;
const RETRY_DELAY_MS = 1000;

/**
 * WebhookNotifier — POSTs alert payloads to a configured webhook URL.
 *
 * Activated by setting the `ALERT_WEBHOOK_URL` environment variable.
 * Retries up to 2 times with a 1-second delay on failure.
 */
export class WebhookNotifier implements AlertNotifier {
  readonly name = "webhook";

  async send(alert: Alert): Promise<void> {
    const url = process.env.ALERT_WEBHOOK_URL;
    if (!url) return;

    const payload = {
      title: alert.title,
      message: alert.message,
      severity: alert.severity,
      source: alert.sourceName,
      sourceId: alert.sourceId,
      status: alert.status,
      type: alert.type,
      timestamp: alert.triggeredAt,
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= RETRY_COUNT; attempt++) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(
            `Webhook responded with ${response.status}: ${response.statusText}`,
          );
        }

        return; // success
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    throw lastError ?? new Error("WebhookNotifier: unknown error after retries");
  }
}
