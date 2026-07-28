import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { withRecoveryPolicy } from "./connector-wrapper";
import { CircuitBreakerRegistry } from "./circuit-breaker";
import { HttpError } from "@/lib/bots/retry";
import type { BotAdapterListing } from "@/lib/bots/types";

describe("withRecoveryPolicy", () => {
  beforeEach(() => {
    CircuitBreakerRegistry.resetInstance();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // CB open → returns []
  // -----------------------------------------------------------------------

  it("returns [] when circuit breaker is open", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const cb = CircuitBreakerRegistry.getInstance({
      testsource: { failureThreshold: 1, halfOpenTimeoutMs: 60_000 },
    });
    cb.recordFailure("testsource"); // trips open

    const fetcher = vi.fn();
    const wrapped = withRecoveryPolicy(fetcher, "testsource");
    const result = await wrapped("https://example.com", 10);

    expect(result).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("testsource"),
    );
  });

  // -----------------------------------------------------------------------
  // Fetcher succeeds → recordSuccess + returns result
  // -----------------------------------------------------------------------

  it("calls recordSuccess and returns result on success", async () => {
    const cb = CircuitBreakerRegistry.getInstance({
      testsource: { failureThreshold: 3, halfOpenTimeoutMs: 60_000 },
    });

    const listings: BotAdapterListing[] = [
      {
        product_name: "Test",
        title: "Test Ürün",
        price: 100,
        city: "İstanbul",
        source: "test",
        url: "https://example.com",
        condition: "new",
        image_url: null,
        image_urls: [],
        status: "active",
      },
    ];

    const fetcher = vi.fn().mockResolvedValue(listings);
    const wrapped = withRecoveryPolicy(fetcher, "testsource");
    const result = await wrapped("https://example.com", 10);

    expect(result).toEqual(listings);
    expect(fetcher).toHaveBeenCalledWith("https://example.com", 10);
    expect(cb.getState("testsource").failureCount).toBe(0); // recordSuccess reset
  });

  // -----------------------------------------------------------------------
  // Auth errors → throws without recording CB failure
  // -----------------------------------------------------------------------

  it("throws 401 errors without recording CB failure", async () => {
    const cb = CircuitBreakerRegistry.getInstance({
      testsource: { failureThreshold: 3, halfOpenTimeoutMs: 60_000 },
    });

    const fetcher = vi.fn().mockRejectedValue(new HttpError("unauthorized", 401));
    const wrapped = withRecoveryPolicy(fetcher, "testsource");

    await expect(wrapped("https://example.com", 10)).rejects.toThrow(HttpError);
    expect(cb.getState("testsource").failureCount).toBe(0);
  });

  it("throws 403 errors without recording CB failure", async () => {
    const cb = CircuitBreakerRegistry.getInstance({
      testsource: { failureThreshold: 3, halfOpenTimeoutMs: 60_000 },
    });

    const fetcher = vi.fn().mockRejectedValue(new HttpError("forbidden", 403));
    const wrapped = withRecoveryPolicy(fetcher, "testsource");

    await expect(wrapped("https://example.com", 10)).rejects.toThrow(HttpError);
    expect(cb.getState("testsource").failureCount).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Non-auth errors → records failure + re-throws
  // -----------------------------------------------------------------------

  it("records failure and re-throws HTTP server errors", async () => {
    const cb = CircuitBreakerRegistry.getInstance({
      testsource: { failureThreshold: 3, halfOpenTimeoutMs: 60_000 },
    });

    const fetcher = vi.fn().mockRejectedValue(new HttpError("server error", 500));
    const wrapped = withRecoveryPolicy(fetcher, "testsource");

    await expect(wrapped("https://example.com", 10)).rejects.toThrow(HttpError);
    expect(cb.getState("testsource").failureCount).toBe(1);
  });

  it("records failure and re-throws generic errors", async () => {
    const cb = CircuitBreakerRegistry.getInstance({
      testsource: { failureThreshold: 3, halfOpenTimeoutMs: 60_000 },
    });

    const fetcher = vi.fn().mockRejectedValue(new Error("something broke"));
    const wrapped = withRecoveryPolicy(fetcher, "testsource");

    await expect(wrapped("https://example.com", 10)).rejects.toThrow(Error);
    expect(cb.getState("testsource").failureCount).toBe(1);
  });

  // -----------------------------------------------------------------------
  // Retryable errors → logs error message
  // -----------------------------------------------------------------------

  it("logs error message for retryable errors", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const cb = CircuitBreakerRegistry.getInstance({
      testsource: { failureThreshold: 3, halfOpenTimeoutMs: 60_000 },
    });

    const timeoutError = new Error("timed out");
    timeoutError.name = "AbortError"; // → timeout category (retryable)
    const fetcher = vi.fn().mockRejectedValue(timeoutError);
    const wrapped = withRecoveryPolicy(fetcher, "testsource");

    await expect(wrapped("https://example.com", 10)).rejects.toThrow(Error);
    expect(cb.getState("testsource").failureCount).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("testsource"));
  });

  // -----------------------------------------------------------------------
  // Non-retryable errors → does NOT log
  // -----------------------------------------------------------------------

  it("does not log error message for non-retryable errors", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const cb = CircuitBreakerRegistry.getInstance({
      testsource: { failureThreshold: 3, halfOpenTimeoutMs: 60_000 },
    });

    const fetcher = vi.fn().mockRejectedValue(new SyntaxError("Unexpected token"));
    const wrapped = withRecoveryPolicy(fetcher, "testsource");

    await expect(wrapped("https://example.com", 10)).rejects.toThrow(SyntaxError);
    expect(cb.getState("testsource").failureCount).toBe(1);
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
