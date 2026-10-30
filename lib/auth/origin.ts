import { headers } from "next/headers";
import { getSiteUrl } from "@/lib/site-url";

/**
 * Picks the origin an auth e-mail link should return to.
 *
 * The PKCE code-verifier cookie is stored on the host the user requested the
 * e-mail from; the link must come back to that same host or the code cannot be
 * exchanged. NEXT_PUBLIC_SITE_URL can differ from it (apex vs www, preview
 * deployments, localhost), so the request's own origin wins.
 */
export function resolveRequestOrigin(
  originHeader: string | null,
  forwardedHost: string | null,
  forwardedProto: string | null,
  fallback: string,
): string {
  const candidate =
    originHeader ?? (forwardedHost ? `${forwardedProto ?? "https"}://${forwardedHost}` : null);
  if (!candidate) return fallback;
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : fallback;
  } catch {
    return fallback;
  }
}

export async function getRequestOrigin(): Promise<string> {
  const requestHeaders = await headers();
  return resolveRequestOrigin(
    requestHeaders.get("origin"),
    requestHeaders.get("x-forwarded-host"),
    requestHeaders.get("x-forwarded-proto"),
    getSiteUrl(),
  );
}
