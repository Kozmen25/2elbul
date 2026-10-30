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

/**
 * Number of reverse proxies in front of the app that append to
 * X-Forwarded-For (Vercel's edge, or nginx on the VDS). Each one adds the
 * address it received the request from, so the client is that many entries
 * from the right; anything further left was written by the client and can be
 * forged. Override with TRUSTED_PROXY_COUNT when the chain is longer.
 */
const DEFAULT_TRUSTED_PROXY_COUNT = 1;

function getTrustedProxyCount(): number {
  const configured = Number(process.env.TRUSTED_PROXY_COUNT);
  return Number.isInteger(configured) && configured >= 1 ? configured : DEFAULT_TRUSTED_PROXY_COUNT;
}

const LOCAL_FALLBACK_IP = "127.0.0.1";

/**
 * Client IP for rate limiting. Uses the X-Forwarded-For entry added by our
 * own proxy (counted from the right) so a client cannot reset its limit by
 * sending a made-up X-Forwarded-For value.
 */
export function getClientIp(request: {
  headers: { get(name: string): string | null };
}): string {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (forwarded?.length) {
    const index = Math.max(0, forwarded.length - getTrustedProxyCount());
    return forwarded[index];
  }
  return (
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    LOCAL_FALLBACK_IP
  );
}
