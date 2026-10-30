import { NextResponse, type NextRequest } from "next/server";
import { parseListingId, resolveListingOutbound } from "@/lib/listing-availability/outbound";
import { redirectToPath } from "@/lib/relative-redirect";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * "Go to listing": a real HTTP redirect to the source page while the listing
 * is live, otherwise to the page that explains it is gone and offers
 * alternatives. Never cached, so every click sees the current status.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listingId = parseListingId(id);
  const outbound = listingId === null ? null : await resolveListingOutbound(listingId);

  const response =
    outbound?.kind === "live"
      ? NextResponse.redirect(outbound.url, 302)
      : redirectToPath(`/ilan-yayinda-degil/${encodeURIComponent(id)}`, 302);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
