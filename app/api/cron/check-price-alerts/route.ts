import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PriceAlertRow = {
  id: string | number;
  product_id: number | null;
  listing_id: number | null;
  target_price: number | string;
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

  const { data, error } = await supabase
    .from("price_alerts")
    .select("id, product_id, listing_id, target_price")
    .eq("status", "active")
    .limit(500);

  if (error) {
    console.error("Price alerts cron query failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message,
        migration: "supabase/price-alerts.sql",
      },
      { status: 500 },
    );
  }

  const alerts = (data ?? []) as PriceAlertRow[];
  let checked = 0;
  let triggered = 0;
  let failed = 0;
  const now = new Date().toISOString();

  for (const alert of alerts) {
    try {
      const currentPrice = await resolveCurrentPrice(
        supabase,
        alert.product_id,
        alert.listing_id,
      );
      const targetPrice = Number(alert.target_price);

      if (!currentPrice || !Number.isFinite(targetPrice)) {
        await supabase
          .from("price_alerts")
          .update({ current_price: currentPrice, last_checked_at: now })
          .eq("id", alert.id);
        checked += 1;
        continue;
      }

      if (currentPrice <= targetPrice) {
        await supabase
          .from("price_alerts")
          .update({
            current_price: currentPrice,
            status: "triggered",
            triggered_at: now,
            last_checked_at: now,
          })
          .eq("id", alert.id);
        triggered += 1;
      } else {
        await supabase
          .from("price_alerts")
          .update({ current_price: currentPrice, last_checked_at: now })
          .eq("id", alert.id);
      }

      checked += 1;
    } catch (alertError) {
      failed += 1;
      console.error("Price alert check failed:", alertError);
    }
  }

  // TODO: Tetiklenen alarmlar için e-posta veya uygulama içi bildirim gönderimi eklenecek.
  return NextResponse.json({
    ok: true,
    checked,
    triggered,
    failed,
  });
}

async function resolveCurrentPrice(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  productId: number | null,
  listingId: number | null,
) {
  if (listingId) {
    const { data, error } = await supabase
      .from("listings")
      .select("price")
      .eq("id", listingId)
      .maybeSingle();
    if (error) throw error;
    return data?.price ? Number(data.price) : null;
  }

  if (!productId) return null;

  const { data, error } = await supabase
    .from("listings")
    .select("price")
    .eq("product_id", productId)
    .in("status", ["published", "active"])
    .order("price", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.price ? Number(data.price) : null;
}

function hasValidSecret(request: NextRequest, secret: string) {
  const headerSecret =
    request.headers.get("x-cron-secret") ||
    request.headers.get("x-vercel-cron-secret");
  const authHeader = request.headers.get("authorization");
  const bearerSecret = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";
  const querySecret = request.nextUrl.searchParams.get("secret");

  return [headerSecret, bearerSecret, querySecret].some(
    (value) => value === secret,
  );
}
