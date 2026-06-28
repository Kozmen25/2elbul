import { NextRequest, NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import { getPublicDemoListingReasons } from "@/lib/public-data-cleanup";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ListingDeactivateRow = {
  id: string | number;
  product_id: string | number | null;
  title: string | null;
  source: string | null;
  url: string | null;
  status?: string | null;
  is_active?: boolean | null;
};

type ListingColumnMode = "status" | "is_active" | "none";

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

  const mode = listingResult.mode;
  if (mode === "none") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "listings tablosunda pasife alma için status veya is_active kolonu bulunamadı.",
        sql:
          "alter table public.listings add column if not exists status text default 'published';",
      },
      { status: 409 },
    );
  }

  const payload =
    mode === "status" ? { status: "inactive" } : { is_active: false };
  const { error: updateError } = await supabase
    .from("listings")
    .update(payload)
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
    column: mode,
    reasons,
  });
}

async function verifyAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = (await supabase?.auth.getUser()) ?? {
    data: { user: null },
    error: null,
  };

  if (error) {
    console.error("Data cleanup admin auth failed:", error);
  }

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Bu işlem için giriş yapmalısınız." },
      { status: 401 },
    );
  }

  if (!isAdminEmail(user.email)) {
    return NextResponse.json(
      { ok: false, error: "Bu işlem için admin yetkisi gerekli." },
      { status: 403 },
    );
  }

  return null;
}

async function fetchListingCandidate(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  listingId: string,
): Promise<{
  listing: ListingDeactivateRow | null;
  mode: ListingColumnMode;
  error: unknown;
}> {
  const statusSelect = await supabase
    .from("listings")
    .select("id, product_id, title, source, url, status")
    .eq("id", listingId)
    .maybeSingle();

  if (!statusSelect.error) {
    return {
      listing: statusSelect.data as ListingDeactivateRow | null,
      mode: "status",
      error: null,
    };
  }

  if (!isMissingColumn(statusSelect.error, "status")) {
    return { listing: null, mode: "none", error: statusSelect.error };
  }

  const activeSelect = await supabase
    .from("listings")
    .select("id, product_id, title, source, url, is_active")
    .eq("id", listingId)
    .maybeSingle();

  if (!activeSelect.error) {
    return {
      listing: activeSelect.data as ListingDeactivateRow | null,
      mode: "is_active",
      error: null,
    };
  }

  if (!isMissingColumn(activeSelect.error, "is_active")) {
    return { listing: null, mode: "none", error: activeSelect.error };
  }

  const baseSelect = await supabase
    .from("listings")
    .select("id, product_id, title, source, url")
    .eq("id", listingId)
    .maybeSingle();

  return {
    listing: (baseSelect.data as ListingDeactivateRow | null) ?? null,
    mode: "none",
    error: baseSelect.error,
  };
}

async function fetchProductName(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  productId: string | number | null,
) {
  if (productId === null || productId === undefined) return "";
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

function normalizeListingId(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return /^[0-9a-fA-F-]+$/.test(trimmed) ? trimmed : "";
}

function isMissingColumn(error: unknown, column: string) {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: string; message?: string; details?: string };
  const text = `${record.message ?? ""} ${record.details ?? ""}`.toLowerCase();
  return (
    record.code === "42703" ||
    record.code === "PGRST204" ||
    (text.includes(column.toLowerCase()) &&
      (text.includes("column") || text.includes("schema cache")))
  );
}
