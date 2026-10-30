import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  ROUTE_RATE_LIMITS,
  SERVER_ACTION_HEADER,
  classifyRateLimitedRoute,
} from "@/lib/request-rate-limits";
import { updateSupabaseSession } from "@/lib/supabase-middleware";
import { adminLoginPath, decideAdminAccess, isAdminPath } from "@/lib/auth/admin-gate";
import { isAdminEmail } from "@/lib/auth/admin-emails";
import { isDbAdmin } from "@/lib/auth/db-admin";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

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

  // /categories?kategori=<slug> was a second, parallel view of /category/<slug>
  // (kept here, not in next.config, so the old query string is dropped).
  if (pathname === "/categories") {
    const legacySlug = request.nextUrl.searchParams.get("kategori")?.trim();
    if (legacySlug) {
      return NextResponse.redirect(
        new URL(`/category/${encodeURIComponent(legacySlug)}`, request.url),
        308,
      );
    }
  }

  // Rate limiting for search, API and server action requests
  const route = classifyRateLimitedRoute(
    pathname,
    request.method,
    request.headers.has(SERVER_ACTION_HEADER),
  );
  if (route) {
    const config = ROUTE_RATE_LIMITS[route.type];
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

    // Server actions run on pages: they still need the session refresh and
    // the admin gate below.
    if (route.type !== "action") {
      const response = NextResponse.next();
      response.headers.set("X-RateLimit-Remaining", String(rl.remaining));
      return response;
    }
  }

  // Supabase session refresh for all other routes
  const { response: sessionResponse, user } = await updateSupabaseSession(request);

  if (isAdminPath(pathname)) {
    const userIsAdmin = user
      ? isAdminEmail(user.email) || (await isDbAdmin(createSupabaseAdminClient(), user.id))
      : false;
    const access = decideAdminAccess(Boolean(user), userIsAdmin);
    if (access === "login") {
      return NextResponse.redirect(
        new URL(adminLoginPath(pathname, request.nextUrl.search), request.url),
      );
    }
    if (access === "forbidden") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  sessionResponse.headers.set("x-pathname", pathname);
  return sessionResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
