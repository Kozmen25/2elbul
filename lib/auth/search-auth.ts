import { NextRequest } from "next/server";

const SKIP_SEARCH_AUTH =
  process.env.SKIP_SEARCH_AUTH === "true" ||
  process.env.SKIP_SEARCH_AUTH === "1";

export function verifySearchRequest(request: NextRequest): {
  ok: boolean;
  error?: string;
} {
  if (SKIP_SEARCH_AUTH) {
    return { ok: true };
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return { ok: false, error: "CRON_SECRET tanımlı değil." };
  }

  const headerSecret =
    request.headers.get("x-cron-secret") ||
    request.headers.get("x-vercel-cron-secret");
  const authHeader = request.headers.get("authorization");
  const bearerSecret = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";

  const valid = [headerSecret, bearerSecret].some((value) => value === secret);
  if (!valid) {
    return { ok: false, error: "Yetkisiz arama isteği." };
  }

  return { ok: true };
}
