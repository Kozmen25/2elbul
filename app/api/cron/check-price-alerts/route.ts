import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { hasValidSecret } from "@/lib/auth/cron-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PriceAlertRow = {
  id: string | number;
  user_id: string;
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
    .select("id, user_id, product_id, listing_id, target_price")
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
  let notificationsCreated = 0;
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

        const productName = await resolveProductName(supabase, alert.product_id);
        await supabase.from("user_notifications").insert({
          user_id: alert.user_id,
          type: "price_alert",
          title: "Fiyat Alarmı Tetiklendi",
          body: `${productName} için fiyat alarmın tetiklendi! Hedef: ${targetPrice} TL, Güncel: ${currentPrice} TL`,
          metadata: {
            price_alert_id: alert.id,
            product_id: alert.product_id,
            listing_id: alert.listing_id,
            target_price: targetPrice,
            current_price: currentPrice,
          },
        });

        notificationsCreated += 1;
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

  return NextResponse.json({
    ok: true,
    checked,
    triggered,
    failed,
    notificationsCreated,
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

async function resolveProductName(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  productId: number | null,
) {
  if (!productId) return "Ürün";
  const { data, error } = await supabase
    .from("products")
    .select("name")
    .eq("id", productId)
    .maybeSingle();
  if (error || !data) return "Ürün";
  return String(data.name);
}
