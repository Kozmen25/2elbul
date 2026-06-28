import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CronTaskResult = {
  task: string;
  ok: boolean;
  status: number;
  data: unknown;
};

const TASKS = [
  { task: "run-sources", path: "/api/cron/run-sources" },
  { task: "process-search-queue", path: "/api/cron/process-search-queue" },
  { task: "check-price-alerts", path: "/api/cron/check-price-alerts" },
] as const;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET tanımlı değil." },
      { status: 500 },
    );
  }

  if (!hasValidSecret(request, secret)) {
    return NextResponse.json(
      { ok: false, error: "Yetkisiz cron isteği." },
      { status: 401 },
    );
  }

  const origin = getCronOrigin(request);
  const results: CronTaskResult[] = [];

  for (const item of TASKS) {
    try {
      const response = await fetch(`${origin}${item.path}`, {
        headers: {
          "x-cron-secret": secret,
        },
        cache: "no-store",
      });
      const data = await readJsonSafely(response);
      results.push({
        task: item.task,
        ok: response.ok,
        status: response.status,
        data,
      });
    } catch (error) {
      results.push({
        task: item.task,
        ok: false,
        status: 500,
        data: {
          error: error instanceof Error ? error.message : "Bilinmeyen cron hatası",
        },
      });
    }
  }

  const ok = results.every((result) => result.ok);

  return NextResponse.json(
    {
      ok,
      mode: "hobby-daily",
      results,
    },
    { status: ok ? 200 : 207 },
  );
}

function hasValidSecret(request: NextRequest, secret: string) {
  const headerSecret =
    request.headers.get("x-cron-secret") ||
    request.headers.get("x-vercel-cron-secret");
  const authHeader = request.headers.get("authorization");
  const bearerSecret = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";
  const querySecret = request.nextUrl.searchParams.get("secret");

  return [headerSecret, bearerSecret, querySecret].some(
    (value) => value === secret,
  );
}

function getCronOrigin(request: NextRequest) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) return siteUrl.replace(/\/$/, "");
  return request.nextUrl.origin;
}

async function readJsonSafely(response: Response) {
  try {
    return await response.json();
  } catch {
    return { error: "Cron endpoint JSON cevabı döndürmedi." };
  }
}
