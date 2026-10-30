import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/**
 * Constant-time comparison: a plain === returns sooner the earlier the first
 * wrong character is, which leaks the secret one character at a time.
 * Hashing first makes both sides the same length.
 */
export function secretsMatch(candidate: string | null | undefined, secret: string): boolean {
  if (!candidate || !secret) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(candidate), digest(secret));
}

/** Reads the token from an `Authorization: Bearer <token>` header. */
export function readBearerToken(request: Pick<Request, "headers">): string | null {
  const authHeader = request.headers.get("authorization");
  return authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
}

export function hasValidSecret(request: NextRequest, secret: string): boolean {
  const headerSecret =
    request.headers.get("x-cron-secret") ||
    request.headers.get("x-vercel-cron-secret");

  return [headerSecret, readBearerToken(request)].some((value) => secretsMatch(value, secret));
}
