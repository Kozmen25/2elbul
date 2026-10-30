import "server-only";
import { isPublicListingStatus, PUBLIC_LISTING_STATUSES } from "@/lib/listing-status";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

// Decides where a "go to listing" click (/git/[id]) ends up: the source page
// while the listing is live, otherwise a page that says so and offers the
// cheapest live listings of the same product.

const ALTERNATIVE_COUNT = 3;

export type ListingAlternative = {
  id: number;
  title: string;
  price: number;
  source: string;
  city: string;
};

export type ListingOutbound =
  | { kind: "live"; url: string }
  | {
      kind: "gone";
      title: string | null;
      source: string | null;
      reason: string | null;
      product: { name: string; slug: string | null } | null;
      alternatives: ListingAlternative[];
    };

type OutboundRow = {
  id: number;
  url: string;
  title: string;
  source: string;
  status: string;
  inactive_reason: string | null;
  product_id: number;
  products: { name: string; slug: string | null } | null;
};

/** Only http(s) source pages are followed; anything else is treated as gone. */
export function isFollowableUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

export function parseListingId(value: string): number | null {
  return /^\d{1,15}$/.test(value) ? Number(value) : null;
}

export async function resolveListingOutbound(listingId: number): Promise<ListingOutbound> {
  const missing: ListingOutbound = {
    kind: "gone",
    title: null,
    source: null,
    reason: null,
    product: null,
    alternatives: [],
  };
  // Service client: an inactive listing is hidden by RLS, but we still need
  // its product to offer alternatives. Only public fields leave this module.
  const supabase = createSupabaseAdminClient();
  if (!supabase) return missing;

  const { data, error } = await supabase
    .from("listings")
    .select("id, url, title, source, status, inactive_reason, product_id, products(name, slug)")
    .eq("id", listingId)
    .maybeSingle<OutboundRow>();
  if (error) console.error("Listing outbound lookup failed:", error);
  if (!data) return missing;

  if (isPublicListingStatus(data.status) && isFollowableUrl(data.url)) {
    return { kind: "live", url: data.url };
  }

  const { data: alternatives, error: alternativesError } = await supabase
    .from("listings")
    .select("id, title, price, source, city")
    .eq("product_id", data.product_id)
    .in("status", [...PUBLIC_LISTING_STATUSES])
    .neq("id", data.id)
    .order("price", { ascending: true })
    .limit(ALTERNATIVE_COUNT);
  if (alternativesError) console.error("Listing alternatives lookup failed:", alternativesError);

  // A listing that never went public (pending/rejected) reveals nothing.
  const wasPublic = data.status === "inactive";
  return {
    kind: "gone",
    title: wasPublic ? data.title : null,
    source: wasPublic ? data.source : null,
    reason: wasPublic ? data.inactive_reason : null,
    product: data.products,
    alternatives: (alternatives ?? []).map((row) => ({ ...row, price: Number(row.price) })),
  };
}
