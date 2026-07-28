import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { updateSupabaseSession } from "@/lib/supabase-middleware";

type RouteConfig = { limit: number; windowMs: number };

const limits: Record<string, RouteConfig> = {
  search: { limit: 100, windowMs: 60_000 },
  api: { limit: 60, windowMs: 60_000 },
  action: { limit: 20, windowMs: 60_000 },
};

function classifyRoute(
  pathname: string,
  method: string,
): { type: string; key: string } | null {
  if (method === "POST" && pathname.includes("/actions")) {
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip internal Next.js and static assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Rate limiting for search, API, and action routes
  const route = classifyRoute(pathname, request.method);
  if (route) {
    const config = limits[route.type];
    const ip = getClientIp(request);
    const rl = checkRateLimit(
      `${route.type}:${ip}:${route.key}`,
      config.limit,
      config.windowMs,
    );

    if (!rl.allowed) {
      return new NextResponse(
        JSON.stringify({
          ok: false,
          error:
            "Çok fazla istek gönderdiniz. Lütfen biraz bekleyip tekrar deneyin.",
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(Math.ceil(rl.resetMs / 1000)),
          },
        },
      );
    }

    const response = NextResponse.next();
    response.headers.set("X-RateLimit-Remaining", String(rl.remaining));
    return response;
  }

  // Supabase session refresh for all other routes
  const sessionResponse = await updateSupabaseSession(request);
  sessionResponse.headers.set("x-pathname", pathname);
  return sessionResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
