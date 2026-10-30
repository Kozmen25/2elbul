import { checkRateLimit, type RateLimitResult } from "@/lib/rate-limit";
import type { RateLimitRule } from "@/lib/request-rate-limits";

// Brute-force protection for the auth server actions. Every attempt counts
// against both the client IP and the targeted account, so neither one IP
// trying many accounts nor many IPs trying one account gets far.

export type AuthRateLimitedAction = "login" | "signup" | "password-reset" | "password-change";

const MINUTE_MS = 60_000;
const QUARTER_HOUR_MS = 15 * MINUTE_MS;
const HOUR_MS = 60 * MINUTE_MS;

export const AUTH_RATE_LIMITS: Record<
  AuthRateLimitedAction,
  { perIp: RateLimitRule; perAccount: RateLimitRule }
> = {
  login: {
    perIp: { limit: 20, windowMs: QUARTER_HOUR_MS },
    perAccount: { limit: 10, windowMs: QUARTER_HOUR_MS },
  },
  signup: {
    perIp: { limit: 5, windowMs: HOUR_MS },
    perAccount: { limit: 3, windowMs: HOUR_MS },
  },
  "password-reset": {
    perIp: { limit: 5, windowMs: QUARTER_HOUR_MS },
    perAccount: { limit: 3, windowMs: HOUR_MS },
  },
  "password-change": {
    perIp: { limit: 10, windowMs: QUARTER_HOUR_MS },
    perAccount: { limit: 5, windowMs: QUARTER_HOUR_MS },
  },
};

export type AuthRateLimitDecision =
  | { allowed: true }
  | { allowed: false; retryAfterMinutes: number };

function retryMinutes(result: RateLimitResult): number {
  return Math.max(1, Math.ceil(result.resetMs / MINUTE_MS));
}

/**
 * Records one attempt of `action` and says whether it may proceed.
 * `account` is the e-mail (case-insensitive) or user id being targeted.
 */
export function checkAuthRateLimit(
  action: AuthRateLimitedAction,
  { ip, account }: { ip: string; account: string },
): AuthRateLimitDecision {
  const rules = AUTH_RATE_LIMITS[action];
  const ipResult = checkRateLimit(`auth:${action}:ip:${ip}`, rules.perIp.limit, rules.perIp.windowMs);
  if (!ipResult.allowed) return { allowed: false, retryAfterMinutes: retryMinutes(ipResult) };

  const accountKey = account.trim().toLocaleLowerCase("en-US");
  if (!accountKey) return { allowed: true };
  const accountResult = checkRateLimit(
    `auth:${action}:account:${accountKey}`,
    rules.perAccount.limit,
    rules.perAccount.windowMs,
  );
  return accountResult.allowed
    ? { allowed: true }
    : { allowed: false, retryAfterMinutes: retryMinutes(accountResult) };
}

export function authRateLimitMessage(retryAfterMinutes: number): string {
  return `Çok fazla deneme yapıldı. Lütfen ${retryAfterMinutes} dakika sonra tekrar deneyin.`;
}
