import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { hasValidSecret } from "@/lib/auth/cron-auth";
import { formatCurrencyTRY } from "@/lib/formatters";
import { extractProductTypeFromAttributes } from "@/lib/market-intelligence/helpers";
import { createNotificationMailer } from "@/lib/email/notify";
import { createNotificationDeliverer } from "@/lib/notifications/deliver";
import { evaluatePriceAlert } from "@/lib/price-alerts/rules";
import { getSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AdminClient = SupabaseClient<Database>;

/** Alerts are processed in id order, this many per round trip. */
const ALERT_PAGE_SIZE = 500;

const VISIBLE_LISTING_STATUSES = ["published", "active"];

// Accessory / spare part / service listings must never be reported as a price
// drop for the primary product they attach to. This is the same exclusion set
// used by the PUE-aware saved-search alarm; null (unknown) product types pass
// through unchanged rather than being force-typed.
const NON_PRIMARY_PRODUCT_TYPES = new Set(["accessory", "spare_part", "service"]);

type AlertRow = {
  id: string;
  user_id: string;
  product_id: number | null;
  listing_id: number | null;
  target_price: number;
  current_price: number | null;
};

type PageLookups = {
  /** Lowest visible price per product. */
  productPrices: Map<number, number>;
  /** Price of each still-visible listing (removed listings are absent). */
  listingPrices: Map<number, number>;
  productNames: Map<number, string>;
  productSlugs: Map<number, string>;
  /** The product each watched listing belongs to (for the e-mail link). */
  listingProducts: Map<number, number>;
  listingTitles: Map<number, string>;
  /** Products whose price drops must not be reported (accessories, parts). */
  suppressedProducts: Set<number>;
};

type RunTotals = {
  checked: number;
  triggered: number;
  priceDrops: number;
  failed: number;
  notificationsCreated: number;
  emailsSent: number;
};

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET tanımlı değil." }, { status: 500 });
  }

  if (!hasValidSecret(request, secret)) {
    return NextResponse.json({ ok: false, error: "Yetkisiz cron isteği." }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Supabase service-role bağlantısı yok." },
      { status: 500 },
    );
  }

  const totals: RunTotals = { checked: 0, triggered: 0, priceDrops: 0, failed: 0, notificationsCreated: 0, emailsSent: 0 };
  const origin = getSiteUrl();
  const deliver = createNotificationDeliverer(supabase, createNotificationMailer(supabase, origin));
  const now = new Date().toISOString();
  let lastId: string | null = null;

  // Keyset pagination: alerts flip to "triggered" while we work, so an offset
  // would skip rows. Ordering by id and resuming after the last one is stable.
  for (;;) {
    let query = supabase
      .from("price_alerts")
      .select("id, user_id, product_id, listing_id, target_price, current_price")
      .eq("status", "active")
      .order("id", { ascending: true })
      .limit(ALERT_PAGE_SIZE);
    if (lastId) query = query.gt("id", lastId);

    const { data, error } = await query;
    if (error) {
      console.error("Price alerts cron query failed:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const alerts: AlertRow[] = (data ?? []).map((row) => ({
      ...row,
      target_price: Number(row.target_price),
      current_price: row.current_price == null ? null : Number(row.current_price),
    }));
    if (alerts.length === 0) break;

    const lookups = await loadLookups(supabase, alerts);
    for (const alert of alerts) {
      try {
        await processAlert(supabase, alert, lookups, now, totals, deliver, origin);
      } catch (alertError) {
        totals.failed += 1;
        console.error("Price alert check failed:", alertError);
      }
    }

    lastId = alerts[alerts.length - 1].id;
    if (alerts.length < ALERT_PAGE_SIZE) break;
  }

  return NextResponse.json({ ok: true, ...totals });
}

async function processAlert(
  supabase: AdminClient,
  alert: AlertRow,
  lookups: PageLookups,
  now: string,
  totals: RunTotals,
  deliver: ReturnType<typeof createNotificationDeliverer>,
  origin: string,
) {
  const currentPrice =
    alert.listing_id != null
      ? lookups.listingPrices.get(alert.listing_id) ?? null
      : alert.product_id != null
        ? lookups.productPrices.get(alert.product_id) ?? null
        : null;

  // No visible price right now (all listings gone, or the watched listing was
  // removed): keep the last known price as the baseline and just note the check.
  if (currentPrice === null || !Number.isFinite(alert.target_price)) {
    await updateAlert(supabase, alert.id, { last_checked_at: now });
    totals.checked += 1;
    return;
  }

  const name =
    alert.listing_id != null
      ? lookups.listingTitles.get(alert.listing_id) ?? "Ürün"
      : lookups.productNames.get(alert.product_id ?? -1) ?? "Ürün";
  const productId =
    alert.listing_id != null ? lookups.listingProducts.get(alert.listing_id) : (alert.product_id ?? undefined);
  const slug = productId != null ? lookups.productSlugs.get(productId) : undefined;
  const productUrl = slug ? `${origin}/product/${slug}` : `${origin}/hesabim`;
  const outcome = evaluatePriceAlert({
    targetPrice: alert.target_price,
    currentPrice,
    previousPrice: alert.current_price,
    suppressDrop: alert.listing_id == null && lookups.suppressedProducts.has(alert.product_id ?? -1),
  });

  const alertMetadata = {
    price_alert_id: alert.id,
    product_id: alert.product_id,
    listing_id: alert.listing_id,
    ...(slug ? { product_slug: slug } : {}),
  };

  if (outcome.kind === "triggered") {
    // Delivery first: if the notification cannot be stored the alert stays
    // active and the next run retries, instead of being marked triggered with
    // nobody told. A user who switched this kind off still gets the alert
    // marked as triggered (they chose not to be told).
    const delivery = await deliver({
      userId: alert.user_id,
      kind: "price_alert",
      notification: {
        title: "Fiyat Alarmı Tetiklendi",
        body: `${name} için fiyat alarmın tetiklendi! Hedef: ${formatCurrencyTRY(alert.target_price)}, Güncel: ${formatCurrencyTRY(currentPrice)}`,
        metadata: { ...alertMetadata, target_price: alert.target_price, current_price: currentPrice },
      },
      email: { productName: name, targetPrice: alert.target_price, currentPrice, productUrl },
    });
    await updateAlert(supabase, alert.id, {
      current_price: currentPrice,
      status: "triggered",
      triggered_at: now,
      last_checked_at: now,
    });
    if (delivery.inApp) totals.notificationsCreated += 1;
    if (delivery.email === "sent") totals.emailsSent += 1;
    totals.triggered += 1;
  } else if (outcome.kind === "price_drop") {
    const delivery = await deliver({
      userId: alert.user_id,
      kind: "price_drop",
      notification: {
        title: "Fiyat Düştü",
        body: `${name} için fiyat düştü! Önceki: ${formatCurrencyTRY(outcome.previousPrice)}, Güncel: ${formatCurrencyTRY(currentPrice)} (%${outcome.dropPercent} düşüş)`,
        metadata: {
          ...alertMetadata,
          previous_price: outcome.previousPrice,
          current_price: currentPrice,
          drop_percent: outcome.dropPercent,
        },
      },
      email: {
        productName: name,
        previousPrice: outcome.previousPrice,
        currentPrice,
        dropPercent: outcome.dropPercent,
        productUrl,
      },
    });
    await updateAlert(supabase, alert.id, { current_price: currentPrice, last_checked_at: now });
    if (delivery.inApp) totals.notificationsCreated += 1;
    if (delivery.email === "sent") totals.emailsSent += 1;
    totals.priceDrops += 1;
  } else {
    await updateAlert(supabase, alert.id, { current_price: currentPrice, last_checked_at: now });
  }

  totals.checked += 1;
}

async function updateAlert(
  supabase: AdminClient,
  alertId: string,
  patch: Database["public"]["Tables"]["price_alerts"]["Update"],
) {
  const { error } = await supabase.from("price_alerts").update(patch).eq("id", alertId);
  if (error) throw error;
}

/** One query per kind for the whole page instead of several per alert. */
async function loadLookups(supabase: AdminClient, alerts: AlertRow[]): Promise<PageLookups> {
  const listingIds = [...new Set(alerts.filter((a) => a.listing_id != null).map((a) => a.listing_id as number))];
  const watchedProductIds = alerts.filter((a) => a.listing_id == null && a.product_id != null).map((a) => a.product_id as number);

  const lookups: PageLookups = {
    productPrices: new Map(),
    listingPrices: new Map(),
    productNames: new Map(),
    productSlugs: new Map(),
    listingProducts: new Map(),
    listingTitles: new Map(),
    suppressedProducts: new Set(),
  };

  if (listingIds.length > 0) {
    const { data, error } = await supabase
      .from("listings")
      .select("id, product_id, title, price, status")
      .in("id", listingIds);
    if (error) throw error;
    for (const listing of data ?? []) {
      lookups.listingTitles.set(listing.id, listing.title);
      lookups.listingProducts.set(listing.id, listing.product_id);
      if (VISIBLE_LISTING_STATUSES.includes(listing.status)) {
        lookups.listingPrices.set(listing.id, Number(listing.price));
      }
    }
  }

  const productIds = [...new Set([...watchedProductIds, ...lookups.listingProducts.values()])];
  if (productIds.length > 0) {
    const [prices, products] = await Promise.all([
      watchedProductIds.length > 0
        ? supabase.from("product_price_stats").select("product_id, min_price").in("product_id", watchedProductIds)
        : Promise.resolve({ data: [], error: null }),
      supabase.from("products").select("id, name, slug, attributes").in("id", productIds),
    ]);
    if (prices.error) throw prices.error;
    if (products.error) throw products.error;

    for (const row of prices.data ?? []) {
      if (row.product_id != null && row.min_price != null) {
        lookups.productPrices.set(row.product_id, Number(row.min_price));
      }
    }
    for (const product of products.data ?? []) {
      lookups.productNames.set(product.id, product.name);
      if (product.slug) lookups.productSlugs.set(product.id, product.slug);
      const type = extractProductTypeFromAttributes(product.attributes) ?? "";
      if (NON_PRIMARY_PRODUCT_TYPES.has(type)) lookups.suppressedProducts.add(product.id);
    }
  }

  return lookups;
}
