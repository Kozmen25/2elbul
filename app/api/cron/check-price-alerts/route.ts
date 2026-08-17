import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { hasValidSecret } from "@/lib/auth/cron-auth";
import { extractProductTypeFromAttributes } from "@/lib/market-intelligence/helpers";
import { isMissingAttributesColumn } from "@/lib/listing-status";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Minimum relative price reduction (percent) before a price drop is reported.
 * Below this bound genuine price changes are too small to act on; the market
 * pulse trend engine treats ~4% as the falling-direction boundary, so a drop
 * boundary slightly above it avoids firing on noise while still catching real
 * reductions that never cross an absolute target price.
 */
const PRICE_DROP_MIN_PERCENT = 5;

// Accessory / spare part / service listings must never be reported as a price
// drop for the primary product they attach to. This is the same exclusion set
// used by the PUE-aware saved-search alarm; null (unknown) product types pass
// through unchanged rather than being force-typed.
const NON_PRIMARY_PRODUCT_TYPES = new Set([
  "accessory",
  "spare_part",
  "service",
]);

type PriceAlertRow = {
  id: string | number;
  user_id: string;
  product_id: number | null;
  listing_id: number | null;
  target_price: number | string;
  current_price: number | string | null;
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
    .select("id, user_id, product_id, listing_id, target_price, current_price")
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

  // PUE-aware product type lookup for product-linked alerts. Accessory /
  // spare_part / service alerts are left unmatched so their price drop is
  // suppressed; alerts whose product type is unknown still pass through.
  const productIds = [
    ...new Set(
      alerts
        .map((alert) =>
          alert.listing_id == null && alert.product_id != null
            ? String(alert.product_id)
            : null,
        )
        .filter((id): id is string => id !== null),
    ),
  ];
  let excludedProductIds = new Set<number>();
  if (productIds.length > 0) {
    const productsResult = await supabase
      .from("products")
      .select("id, attributes")
      .in("id", productIds);
    const products =
      !productsResult.error || !isMissingAttributesColumn(productsResult.error)
        ? (productsResult.data ?? [])
        : [];
    excludedProductIds = new Set(
      products
        .filter(
          (product) =>
            NON_PRIMARY_PRODUCT_TYPES.has(
              extractProductTypeFromAttributes(
                "attributes" in product
                  ? (product as { attributes?: unknown }).attributes
                  : null,
              ) ?? "",
            ),
        )
        .map((product) => Number(product.id)),
    );
  }

  const now = new Date().toISOString();
  let checked = 0;
  let triggered = 0;
  let priceDrops = 0;
  let failed = 0;
  let notificationsCreated = 0;

  // Within a single run, an alert should only report a price drop once even if
  // the cron runs repeatedly while the new (lower) price is still in effect.
  const deliveredDropAlerts = new Set<string>();

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

      const previousPrice =
        currentPrice !== null && alert.current_price != null
          ? Number(alert.current_price)
          : null;

      // Relative price drop detection — a distinct responsibility from the
      // absolute target-price alarm below. Fires when the price fell by at
      // least PRICE_DROP_MIN_PERCENT versus the last observed price. The
      // accessory exclusion prevents a dropped accessory price from being
      // reported as a drop for the primary product.
      const isSuppressedAccessory =
        alert.listing_id == null &&
        alert.product_id != null &&
        excludedProductIds.has(Number(alert.product_id));
      const didDrop =
        previousPrice != null &&
        previousPrice > 0 &&
        currentPrice < previousPrice &&
        ((previousPrice - currentPrice) / previousPrice) * 100 >=
          PRICE_DROP_MIN_PERCENT;

      const absoluteTriggered = currentPrice <= targetPrice;

      if (absoluteTriggered) {
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
        checked += 1;
        continue;
      }

      if (didDrop && !isSuppressedAccessory) {
        const alertKey = String(alert.id);
        if (deliveredDropAlerts.has(alertKey)) {
          priceDrops += 1;
          checked += 1;
          continue;
        }
        deliveredDropAlerts.add(alertKey);

        await supabase
          .from("price_alerts")
          .update({ current_price: currentPrice, last_checked_at: now })
          .eq("id", alert.id);

        const productName =
          alert.listing_id != null
            ? "Ürün"
            : await resolveProductName(supabase, alert.product_id);
        const dropPercent = Math.round(
          ((previousPrice - currentPrice) / previousPrice) * 100,
        );
        await supabase.from("user_notifications").insert({
          user_id: alert.user_id,
          type: "price_drop",
          title: "Fiyat Düştü",
          body: `${productName} için fiyat düştü! Önceki: ${previousPrice} TL, Güncel: ${currentPrice} TL (%${dropPercent} düşüş)`,
          metadata: {
            price_alert_id: alert.id,
            product_id: alert.product_id,
            listing_id: alert.listing_id,
            previous_price: previousPrice,
            current_price: currentPrice,
            drop_percent: dropPercent,
          },
        });

        notificationsCreated += 1;
        priceDrops += 1;
        checked += 1;
        continue;
      }

      await supabase
        .from("price_alerts")
        .update({ current_price: currentPrice, last_checked_at: now })
        .eq("id", alert.id);

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
    priceDrops,
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
