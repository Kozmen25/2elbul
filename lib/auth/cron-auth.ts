import { NextRequest } from "next/server";

export function hasValidSecret(request: NextRequest, secret: string): boolean {
  const headerSecret =
    request.headers.get("x-cron-secret") ||
    request.headers.get("x-vercel-cron-secret");
  const authHeader = request.headers.get("authorization");
  const bearerSecret = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";

  return [headerSecret, bearerSecret].some((value) => value === secret);
}
