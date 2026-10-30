import type { NextRequest } from "next/server";
import { hasValidSecret } from "@/lib/auth/cron-auth";

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

  const valid = hasValidSecret(request, secret);
  if (!valid) {
    return { ok: false, error: "Yetkisiz arama isteği." };
  }

  return { ok: true };
}
