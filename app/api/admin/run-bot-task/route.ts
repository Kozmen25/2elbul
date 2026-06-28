import { NextRequest, NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type BotTask = "search_queue" | "sources" | "price_alerts" | "daily";

const TASK_PATHS: Record<BotTask, string> = {
  search_queue: "/api/cron/process-search-queue",
  sources: "/api/cron/run-sources",
  price_alerts: "/api/cron/check-price-alerts",
  daily: "/api/cron/daily",
};

export async function POST(request: NextRequest) {
  const authResult = await verifyAdmin();
  if (authResult) return authResult;

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET tanımlı değil." },
      { status: 500 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    task?: unknown;
  } | null;
  const task = body?.task;

  if (!isBotTask(task)) {
    return NextResponse.json(
      { ok: false, error: "Geçerli bir bot görevi seçin." },
      { status: 400 },
    );
  }

  const response = await fetch(`${request.nextUrl.origin}${TASK_PATHS[task]}`, {
    headers: {
      "x-cron-secret": secret,
    },
    cache: "no-store",
  });
  const data = await readJsonSafely(response);

  return NextResponse.json(
    {
      ok: response.ok,
      task,
      status: response.status,
      data,
    },
    { status: response.ok ? 200 : 502 },
  );
}

async function verifyAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = (await supabase?.auth.getUser()) ?? {
    data: { user: null },
    error: null,
  };

  if (error) {
    console.error("Admin bot task auth failed:", error);
  }

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Bu işlem için giriş yapmalısınız." },
      { status: 401 },
    );
  }

  if (!isAdminEmail(user.email)) {
    return NextResponse.json(
      { ok: false, error: "Bu işlem için admin yetkisi gerekli." },
      { status: 403 },
    );
  }

  return null;
}

function isBotTask(value: unknown): value is BotTask {
  return (
    value === "search_queue" ||
    value === "sources" ||
    value === "price_alerts" ||
    value === "daily"
  );
}

async function readJsonSafely(response: Response) {
  try {
    return await response.json();
  } catch {
    return { error: "Bot görevi JSON cevabı döndürmedi." };
  }
}
