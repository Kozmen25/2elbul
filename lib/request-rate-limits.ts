// Which requests the middleware rate-limits, and how hard. Limits are per
// client IP (see getClientIp in lib/rate-limit.ts) and per route.

export type RateLimitRule = { limit: number; windowMs: number };

export type RateLimitedRouteType = "search" | "api" | "action";

const ONE_MINUTE_MS = 60_000;

export const ROUTE_RATE_LIMITS: Record<RateLimitedRouteType, RateLimitRule> = {
  search: { limit: 100, windowMs: ONE_MINUTE_MS },
  api: { limit: 60, windowMs: ONE_MINUTE_MS },
  action: { limit: 30, windowMs: ONE_MINUTE_MS },
};

// Called by Supabase's servers, which share IPs across many projects, so an
// IP-based limit would throttle real sign-ups. The request signature
// (lib/email/auth-hook.ts) is what protects this route.
// /api/header-state is fetched by the header on every navigation of a signed-in
// user; it is cheap and must not trip the generic API limit.
const RATE_LIMIT_EXEMPT_PATHS = new Set(["/api/auth/email-hook", "/api/header-state"]);

/** Header Next.js puts on every server action call (they POST to the page URL). */
export const SERVER_ACTION_HEADER = "next-action";

export function classifyRateLimitedRoute(
  pathname: string,
  method: string,
  isServerAction: boolean,
): { type: RateLimitedRouteType; key: string } | null {
  if (RATE_LIMIT_EXEMPT_PATHS.has(pathname)) return null;
  if (method === "POST" && isServerAction) {
    return { type: "action", key: `action:${pathname}` };
  }
  if (pathname.startsWith("/api/search") || pathname.startsWith("/search")) {
    return { type: "search", key: `search:${pathname}` };
  }
  if (pathname.startsWith("/api/")) {
    return { type: "api", key: `api:${pathname}` };
  }
  return null;
}
