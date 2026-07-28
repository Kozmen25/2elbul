import { describe, it, expect, vi, beforeEach } from "vitest";
import { WebhookNotifier } from "./webhook-notifier";
import type { Alert } from "./types";

function makeAlert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: "alert-1",
    type: "consecutive_failures",
    severity: "critical",
    status: "active",
    title: "[CRITICAL] Consecutive Failures — test-source",
    message: "Test message",
    sourceId: 1,
    sourceName: "test-source",
    metadata: { foo: "bar" },
    triggeredAt: "2026-07-19T12:00:00.000Z",
    acknowledgedAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    expiresAt: null,
    count: 1,
    ...overrides,
  };
}

describe("WebhookNotifier", () => {
  let notifier: WebhookNotifier;
  const OLD_ENV = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    process.env = { ...OLD_ENV };
    delete process.env.ALERT_WEBHOOK_URL;
    notifier = new WebhookNotifier();
  });

  // -----------------------------------------------------------------------
  // name
  // -----------------------------------------------------------------------

  it("has the correct name", () => {
    expect(notifier.name).toBe("webhook");
  });

  // -----------------------------------------------------------------------
  // No-op when ALERT_WEBHOOK_URL is unset
  // -----------------------------------------------------------------------

  it("is a no-op when ALERT_WEBHOOK_URL is not set", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await notifier.send(makeAlert());

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Success path
  // -----------------------------------------------------------------------

  it("POSTs the alert to ALERT_WEBHOOK_URL", async () => {
    process.env.ALERT_WEBHOOK_URL = "https://hooks.example.com/alerts";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));

    const alert = makeAlert();
    await notifier.send(alert);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("https://hooks.example.com/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: alert.title,
        message: alert.message,
        severity: alert.severity,
        source: alert.sourceName,
        sourceId: alert.sourceId,
        status: alert.status,
        type: alert.type,
        timestamp: alert.triggeredAt,
      }),
    });
  });

  it("succeeds on 200 response", async () => {
    process.env.ALERT_WEBHOOK_URL = "https://hooks.example.com/alerts";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 200 }),
    );

    await expect(notifier.send(makeAlert())).resolves.not.toThrow();
  });

  it("succeeds on 201 response", async () => {
    process.env.ALERT_WEBHOOK_URL = "https://hooks.example.com/alerts";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 201 }),
    );

    await expect(notifier.send(makeAlert())).resolves.not.toThrow();
  });

  it("succeeds on 204 response", async () => {
    process.env.ALERT_WEBHOOK_URL = "https://hooks.example.com/alerts";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 }),
    );

    await expect(notifier.send(makeAlert())).resolves.not.toThrow();
  });

  // -----------------------------------------------------------------------
  // Retry logic
  // -----------------------------------------------------------------------

  it("retries up to 2 times on 5xx responses", async () => {
    process.env.ALERT_WEBHOOK_URL = "https://hooks.example.com/alerts";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 500 }));

    await expect(notifier.send(makeAlert())).rejects.toThrow(
      "Webhook responded with 500",
    );
    expect(fetchMock).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("retries up to 2 times on network errors", async () => {
    process.env.ALERT_WEBHOOK_URL = "https://hooks.example.com/alerts";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("Network failure"));

    await expect(notifier.send(makeAlert())).rejects.toThrow(
      "Network failure",
    );
    expect(fetchMock).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("succeeds on retry when first attempt fails", async () => {
    process.env.ALERT_WEBHOOK_URL = "https://hooks.example.com/alerts";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("Network failure"))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    await expect(notifier.send(makeAlert())).resolves.not.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(2); // initial + 1 retry
  });

  it("succeeds on third attempt (last retry)", async () => {
    process.env.ALERT_WEBHOOK_URL = "https://hooks.example.com/alerts";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    await expect(notifier.send(makeAlert())).resolves.not.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("throws after all retries are exhausted", async () => {
    process.env.ALERT_WEBHOOK_URL = "https://hooks.example.com/alerts";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("Always fails"),
    );

    await expect(notifier.send(makeAlert())).rejects.toThrow("Always fails");
  });

  // -----------------------------------------------------------------------
  // Payload fields
  // -----------------------------------------------------------------------

  it("sends correct payload for warning alerts", async () => {
    process.env.ALERT_WEBHOOK_URL = "https://hooks.example.com/alerts";
    let capturedBody: string | undefined;
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async (_url, opts) => {
        capturedBody = opts?.body as string;
        return new Response(null, { status: 200 });
      },
    );

    const alert = makeAlert({
      severity: "warning",
      title: "[WARNING] Timeout — slow-source",
      message: "Response time exceeds 30s",
      sourceName: "slow-source",
      type: "timeout",
    });

    await notifier.send(alert);

    const payload = JSON.parse(capturedBody!);
    expect(payload.severity).toBe("warning");
    expect(payload.title).toBe("[WARNING] Timeout — slow-source");
    expect(payload.message).toBe("Response time exceeds 30s");
    expect(payload.source).toBe("slow-source");
    expect(payload.type).toBe("timeout");
    expect(payload.timestamp).toBe(alert.triggeredAt);
  });

  it("includes sourceId in the payload", async () => {
    process.env.ALERT_WEBHOOK_URL = "https://hooks.example.com/alerts";
    let capturedBody: string | undefined;
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async (_url, opts) => {
        capturedBody = opts?.body as string;
        return new Response(null, { status: 200 });
      },
    );

    await notifier.send(makeAlert({ sourceId: 42 }));

    const payload = JSON.parse(capturedBody!);
    expect(payload.sourceId).toBe(42);
  });
});
