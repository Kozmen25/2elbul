/**
 * Simple in-memory sliding-window rate limiter.
 * Compatible with both Edge Runtime and Node.js.
 */

const windows = new Map<string, number[]>();
const MAX_KEYS = 10_000;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetMs: number;
};

/**
 * Check if a request should be rate-limited.
 *
 * @param key - Unique identifier (e.g. `ip:route`)
 * @param limit - Max requests allowed in the window
 * @param windowMs - Window duration in milliseconds
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  let timestamps = windows.get(key);
  if (!timestamps) {
    timestamps = [];
    windows.set(key, timestamps);
  }

  const recent = timestamps.filter((t) => now - t < windowMs);
  windows.set(key, recent);

  // Periodic full-map cleanup (sample ~1% of calls)
  if (windows.size > MAX_KEYS && Math.random() < 0.01) {
    for (const [k, ts] of windows) {
      const valid = ts.filter((t) => now - t < windowMs);
      if (valid.length === 0) windows.delete(k);
      else windows.set(k, valid);
    }
  }

  if (recent.length >= limit) {
    const oldest = recent[0] ?? now;
    return {
      allowed: false,
      remaining: 0,
      resetMs: Math.max(1, windowMs - (now - oldest)),
    };
  }

  recent.push(now);
  return {
    allowed: true,
    remaining: Math.max(0, limit - recent.length - 1),
    resetMs: Math.max(1, windowMs - (now - recent[0])),
  };
}

/** Extract a client IP from request headers (works with Vercel, Cloudflare, nginx). */
export function getClientIp(request: {
  headers: { get(name: string): string | null };
}): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip") ??
    "127.0.0.1"
  );
}
