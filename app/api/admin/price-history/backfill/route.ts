import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth/admin-auth";
import {
  backfillPriceHistoryFromListings,
  normalizeBackfillLimit,
  type PriceHistoryBackfillListing,
} from "@/lib/price-history-backfill";
import { isMissingPriceHistorySchemaError } from "@/lib/listing-status";
import {
  recordListingPriceHistory,
} from "@/lib/price-history";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const authResult = await verifyAdmin();
  if (authResult) return authResult;

  const body = (await request.json().catch(() => null)) as {
    limit?: unknown;
  } | null;
  const limit = normalizeBackfillLimit(
    body?.limit ?? request.nextUrl.searchParams.get("limit"),
  );
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Supabase service-role baglantisi yok." },
      { status: 500 },
    );
  }

  const listingsResult = await supabase
    .from("listings")
    .select("id, product_id, price, source, status")
    .in("status", ["published", "active"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (listingsResult.error) {
    console.error("Price history backfill listings query failed:", listingsResult.error);
    return NextResponse.json(
      {
        ok: false,
        error: listingsResult.error.message,
        schemaMissing: isMissingPriceHistorySchemaError(listingsResult.error),
      },
      { status: 500 },
    );
  }

  const summary = await backfillPriceHistoryFromListings(
    (listingsResult.data ?? []) as PriceHistoryBackfillListing[],
    (input) => recordListingPriceHistory(supabase, input),
  );
  const schemaMissing = summary.errorMessages.some((message) =>
    isLikelySchemaMessage(message),
  );

  return NextResponse.json(
    {
      ok: !schemaMissing,
      limit,
      ...summary,
      schemaMissing,
    },
    { status: schemaMissing ? 500 : 200 },
  );
}

function isLikelySchemaMessage(message: string) {
  const text = message.toLowerCase();
  return (
    text.includes("price_history") ||
    text.includes("recorded_at") ||
    text.includes("source")
  );
}
