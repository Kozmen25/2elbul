import { NextResponse } from "next/server";

/**
 * Redirect to a path on this site with a relative Location header. Route
 * handlers behind the nginx proxy see their internal address
 * (http://127.0.0.1:3217) in request.url, so an absolute URL built from it
 * would send visitors to localhost. Browsers resolve a relative Location
 * against the address they actually requested.
 */
export function redirectToPath(path: string, status: 302 | 303 | 307 = 307): NextResponse {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error(`redirectToPath expects a same-site path, got: ${path}`);
  }
  return new NextResponse(null, { status, headers: { Location: path } });
}
