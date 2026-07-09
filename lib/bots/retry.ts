const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const NON_RETRYABLE_STATUSES = new Set([401, 403, 404]);

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof HttpError) {
    if (NON_RETRYABLE_STATUSES.has(error.statusCode)) return false;
    if (RETRYABLE_STATUSES.has(error.statusCode)) return true;
    return false;
  }
  if (error instanceof Error) {
    // AbortError = client-side timeout, TypeError = DNS/network failure
    if (error.name === "AbortError") return true;
    if (error.name === "TypeError") return true;
  }
  return false;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  source?: string;
}

export function getBackoffDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
): number {
  // attempt 1: baseDelayMs * 2^0 = baseDelayMs
  // attempt 2: baseDelayMs * 2^1 = baseDelayMs * 2
  // attempt 3: baseDelayMs * 2^2 = baseDelayMs * 4
  const delay = baseDelayMs * Math.pow(2, attempt - 1);
  return Math.min(delay, maxDelayMs);
}

function getBackoffDelayWithJitter(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
): number {
  const delay = getBackoffDelay(attempt, baseDelayMs, maxDelayMs);
  // Jitter: ±25% — prevents thundering herd when multiple sources retry simultaneously
  const jitter = 1 + (Math.random() * 0.5 - 0.25);
  return Math.round(delay * jitter);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options?: Partial<RetryConfig>,
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 1000;
  const maxDelayMs = options?.maxDelayMs ?? 4000;
  const source = options?.source;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn(attempt);
      RetryMetrics.getInstance().recordAttempt(source, attempt, true);
      return result;
    } catch (error) {
      lastError = error;
      RetryMetrics.getInstance().recordAttempt(source, attempt, false);

      if (!isRetryableError(error)) throw error;

      if (attempt < maxRetries) {
        const delay = getBackoffDelayWithJitter(attempt, baseDelayMs, maxDelayMs);
        await sleep(delay);
      }
    }
  }

  // All retries exhausted — throw enriched error
  const message =
    lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(
    `Kaynak ${maxRetries} denemede de yanıt vermedi. Son hata: ${message}`,
  );
}

export type SourceMetrics = {
  attempts: number;
  successes: number;
  failures: number;
};

export type RetryStats = {
  totalAttempts: number;
  totalRetries: number;
  successfulRequests: number;
  failedRequests: number;
  bySource: Record<string, SourceMetrics>;
};

export class RetryMetrics {
  private static instance: RetryMetrics;
  private attempts = 0;
  private successes = 0;
  private failures = 0;
  private bySource = new Map<
    string,
    { attempts: number; successes: number; failures: number }
  >();

  static getInstance(): RetryMetrics {
    if (!RetryMetrics.instance) {
      RetryMetrics.instance = new RetryMetrics();
    }
    return RetryMetrics.instance;
  }

  recordAttempt(
    source: string | undefined,
    attempt: number,
    success: boolean,
  ): void {
    this.attempts++;
    if (success) this.successes++;
    else this.failures++;

    const key = source ?? "unknown";
    let stats = this.bySource.get(key);
    if (!stats) {
      stats = { attempts: 0, successes: 0, failures: 0 };
      this.bySource.set(key, stats);
    }
    stats.attempts++;
    if (success) stats.successes++;
    else stats.failures++;
  }

  getStats(): RetryStats {
    const bySource: Record<string, SourceMetrics> = {};
    for (const [source, stats] of this.bySource) {
      bySource[source] = {
        attempts: stats.attempts,
        successes: stats.successes,
        failures: stats.failures,
      };
    }
    return {
      totalAttempts: this.attempts,
      totalRetries: Math.max(0, this.attempts - this.successes),
      successfulRequests: this.successes,
      failedRequests: this.failures,
      bySource,
    };
  }

  reset(): void {
    this.attempts = 0;
    this.successes = 0;
    this.failures = 0;
    this.bySource.clear();
  }
}
