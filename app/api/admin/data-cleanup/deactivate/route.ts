import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth/admin-auth";
import { getPublicDemoListingReasons } from "@/lib/public-data-cleanup";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ListingDeactivateRow = {
  id: number;
  product_id: number | null;
  title: string | null;
  source: string | null;
  url: string | null;
  status: string | null;
};

export async function POST(request: NextRequest) {
  const authResult = await verifyAdmin();
  if (authResult) return authResult;

  const body = (await request.json().catch(() => null)) as {
    listingId?: unknown;
  } | null;
  const listingId = normalizeListingId(body?.listingId);

  if (!listingId) {
    return NextResponse.json(
      { ok: false, error: "Geçerli bir ilan ID gönderin." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Supabase service role bağlantısı yapılandırılmadı." },
      { status: 500 },
    );
  }

  const listingResult = await fetchListingCandidate(supabase, listingId);
  if (listingResult.error) {
    console.error("Data cleanup listing fetch failed:", listingResult.error);
    return NextResponse.json(
      { ok: false, error: "İlan kontrol edilirken hata oluştu." },
      { status: 500 },
    );
  }

  if (!listingResult.listing) {
    return NextResponse.json(
      { ok: false, error: "İlan bulunamadı." },
      { status: 404 },
    );
  }

  const productName = await fetchProductName(
    supabase,
    listingResult.listing.product_id,
  );
  const reasons = getPublicDemoListingReasons({
    title: listingResult.listing.title,
    productName,
    source: listingResult.listing.source,
    url: listingResult.listing.url,
  });

  if (!reasons.length) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Bu ilan demo/test filtresine takılmadığı için pasife alınmadı.",
      },
      { status: 400 },
    );
  }

  const { error: updateError } = await supabase
    .from("listings")
    .update({ status: "inactive" })
    .eq("id", listingId);

  if (updateError) {
    console.error("Data cleanup deactivate failed:", updateError);
    return NextResponse.json(
      {
        ok: false,
        error: "İlan pasife alınırken Supabase hatası oluştu.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: "İlan silinmeden pasife alındı.",
    listingId,
    column: "status",
    reasons,
  });
}

async function fetchListingCandidate(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  listingId: number,
): Promise<{ listing: ListingDeactivateRow | null; error: unknown }> {
  const { data, error } = await supabase
    .from("listings")
    .select("id, product_id, title, source, url, status")
    .eq("id", listingId)
    .maybeSingle();

  return { listing: data, error };
}

async function fetchProductName(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  productId: number | null,
) {
  if (productId === null) return "";
  const { data, error } = await supabase
    .from("products")
    .select("name")
    .eq("id", productId)
    .maybeSingle();

  if (error) {
    console.error("Data cleanup product fetch failed:", error);
    return "";
  }

  return typeof data?.name === "string" ? data.name : "";
}

// listings.id is a bigint; anything else is rejected with 400.
function normalizeListingId(value: unknown): number | null {
  const id = typeof value === "string" ? Number(value.trim()) : value;
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0 ? id : null;
}
