import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip internal Next.js and static assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const route = classifyRoute(pathname, request.method);
  if (!route) return NextResponse.next();

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

export const config = {
  matcher: ["/search", "/search/:path*", "/api/:path*"],
};
