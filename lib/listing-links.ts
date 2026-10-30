/**
 * Where a "go to listing" link points. Every outbound listing link goes through
 * /git/[id], which forwards to the source page only while the listing is live
 * and otherwise shows a "no longer listed" page with alternatives.
 */
export function listingOutboundPath(listingId: string | number): string {
  return `/git/${encodeURIComponent(String(listingId))}`;
}
