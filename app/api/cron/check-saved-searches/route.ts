import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { hasValidSecret } from "@/lib/auth/cron-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SavedSearchRow = {
  id: string | number;
  user_id: string;
  query: string;
  filters: Record<string, unknown> | null;
  last_notified_at: string | null;
};

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET tanımlı değil." },
      { status: 500 },
    );
  }

  if (!hasValidSecret(request, secret)) {
    return NextResponse.json(
      { ok: false, error: "Yetkisiz cron isteği." },
      { status: 401 },
    );
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Supabase service-role bağlantısı yok." },
      { status: 500 },
    );
  }

  // Fetch all active saved searches with instant or daily frequency
  const { data, error } = await supabase
    .from("saved_searches")
    .select("id, user_id, query, filters, last_notified_at")
    .in("frequency", ["instant", "daily"])
    .limit(500);

  if (error) {
    console.error("Saved searches cron query failed:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  const searches = (data ?? []) as SavedSearchRow[];
  let checked = 0;
  let matched = 0;
  let failed = 0;
  let notificationsCreated = 0;

  for (const search of searches) {
    try {
      const now = new Date().toISOString();
      const queryTerms = search.query.trim().split(/\s+/).filter(Boolean);

      if (queryTerms.length === 0) {
        checked += 1;
        continue;
      }

      // Build ILIKE query: search for new listings matching the saved query
      let listingsQuery = supabase
        .from("listings")
        .select("id")
        .in("status", ["published", "active"])
        .ilike("title", `%${search.query.trim()}%`);

      // Only check listings created since last notification
      if (search.last_notified_at) {
        listingsQuery = listingsQuery.gt("created_at", search.last_notified_at);
      }

      const { data: newListings, error: listError } = await listingsQuery.limit(50);

      if (listError) {
        console.error(`Saved search "${search.query}" query failed:`, listError);
        failed += 1;
        checked += 1;
        continue;
      }

      const count = newListings?.length ?? 0;

      if (count > 0) {
        // Create notification for the user
        const listingId = String(newListings![0].id);
        const body =
          count === 1
            ? `"${search.query}" için 1 yeni ilan bulundu.`
            : `"${search.query}" için ${count} yeni ilan bulundu.`;

        const { error: notifError } = await supabase
          .from("user_notifications")
          .insert({
            user_id: search.user_id,
            type: "new_listing",
            title: "Yeni İlan Bulundu",
            body,
            metadata: {
              saved_search_id: search.id,
              query: search.query,
              match_count: count,
              listing_id: listingId,
            },
          });

        if (notifError) {
          console.error("Saved search notification insert failed:", notifError);
          failed += 1;
          checked += 1;
          continue;
        }

        notificationsCreated += 1;

        // Update last_notified_at
        await supabase
          .from("saved_searches")
          .update({ last_notified_at: now })
          .eq("id", search.id);

        matched += 1;
      }

      checked += 1;
    } catch (searchError) {
      failed += 1;
      console.error("Saved search check failed:", searchError);
    }
  }

  return NextResponse.json({
    ok: true,
    checked,
    matched,
    failed,
    notificationsCreated,
  });
}
