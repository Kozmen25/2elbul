// Price-alert use cases behind both entry points: the /hesabim + product page
// server actions (app/price-alerts/actions.ts) and the JSON API
// (app/api/price-alerts/route.ts). They run with the signed-in user's own
// Supabase client, so row-level security scopes every query to that user.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { formatCurrencyTRY } from "@/lib/formatters";
import {
  MAX_ACTIVE_ALERTS_PER_USER,
  canChangeAlertStatus,
  isPriceAlertStatus,
  parsePositiveInteger,
  parseTargetPrice,
  statusChangeMessage,
  type PriceAlertStatus,
} from "@/lib/price-alerts/rules";

type UserClient = SupabaseClient<Database>;

export type PriceAlertResult = {
  ok: boolean;
  message: string;
  /** HTTP status the API route should answer with. */
  httpStatus: 200 | 400 | 404 | 409 | 500;
  alertId?: string;
  duplicate?: boolean;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POSTGRES_UNIQUE_VIOLATION = "23505";
const POSTGRES_CHECK_VIOLATION = "23514";
const VISIBLE_LISTING_STATUSES = ["published", "active"];

const fail = (httpStatus: 400 | 404 | 409 | 500, message: string): PriceAlertResult => ({
  ok: false,
  message,
  httpStatus,
});

export async function createPriceAlert(
  supabase: UserClient,
  userId: string,
  input: { productId?: unknown; listingId?: unknown; targetPrice?: unknown },
): Promise<PriceAlertResult> {
  const productId = parsePositiveInteger(input.productId);
  const listingId = parsePositiveInteger(input.listingId);
  const targetPrice = parseTargetPrice(input.targetPrice);

  if (!productId && !listingId) return fail(400, "Ürün veya ilan seçimi gerekli.");
  if (!targetPrice) return fail(400, "Geçerli bir hedef fiyat girin.");

  const currentPrice = listingId
    ? await lookupListingPrice(supabase, listingId)
    : await lookupLowestProductPrice(supabase, productId as number);
  if (currentPrice === "error") return fail(500, "Fiyat alarmı oluşturulamadı.");
  if (currentPrice === "missing") {
    return fail(404, listingId ? "İlan bulunamadı ya da artık yayında değil." : "Ürün bulunamadı.");
  }

  const duplicateQuery = supabase
    .from("price_alerts")
    .select("id")
    .eq("user_id", userId)
    .eq("target_price", targetPrice)
    .eq("status", "active")
    .limit(1);
  const { data: existing, error: duplicateError } = await (listingId
    ? duplicateQuery.eq("listing_id", listingId)
    : duplicateQuery.eq("product_id", productId as number).is("listing_id", null)
  ).maybeSingle();
  if (duplicateError) {
    console.error("Price alert duplicate lookup failed:", duplicateError);
    return fail(500, "Fiyat alarmı oluşturulamadı.");
  }
  if (existing) {
    return { ok: true, httpStatus: 200, duplicate: true, alertId: existing.id, message: "Bu hedef fiyat için aktif alarmın zaten var." };
  }

  const { count, error: countError } = await supabase
    .from("price_alerts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "active");
  if (countError) {
    console.error("Price alert count failed:", countError);
    return fail(500, "Fiyat alarmı oluşturulamadı.");
  }
  if ((count ?? 0) >= MAX_ACTIVE_ALERTS_PER_USER) return fail(409, limitMessage());

  const { data, error } = await supabase
    .from("price_alerts")
    .insert({
      user_id: userId,
      product_id: listingId ? null : productId,
      listing_id: listingId,
      target_price: targetPrice,
      current_price: currentPrice,
      status: "active",
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === POSTGRES_UNIQUE_VIOLATION) {
      // Two identical requests raced; the other one created it.
      return { ok: true, httpStatus: 200, duplicate: true, message: "Bu hedef fiyat için aktif alarmın zaten var." };
    }
    if (error.code === POSTGRES_CHECK_VIOLATION) return fail(409, limitMessage());
    console.error("Price alert insert failed:", error);
    return fail(500, "Fiyat alarmı oluşturulamadı.");
  }

  return {
    ok: true,
    httpStatus: 200,
    alertId: data.id,
    message:
      currentPrice !== null && targetPrice >= currentPrice
        ? `Fiyat alarmın oluşturuldu. Hedef fiyat şu anki en düşük fiyatın (${formatCurrencyTRY(currentPrice)}) altında olmadığı için ilk kontrolde bildirim alacaksın.`
        : "Fiyat alarmın oluşturuldu.",
  };
}

export async function changePriceAlertStatus(
  supabase: UserClient,
  userId: string,
  alertId: unknown,
  nextStatus: unknown,
): Promise<PriceAlertResult> {
  if (typeof alertId !== "string" || !UUID_PATTERN.test(alertId)) return fail(400, "Alarm kimliği geçersiz.");
  if (!isPriceAlertStatus(nextStatus)) return fail(400, "Geçersiz alarm durumu.");

  const { data: alert, error: lookupError } = await supabase
    .from("price_alerts")
    .select("id, status")
    .eq("id", alertId)
    .eq("user_id", userId)
    .maybeSingle();
  if (lookupError) {
    console.error("Price alert lookup failed:", lookupError);
    return fail(500, "Fiyat alarmı güncellenemedi.");
  }
  if (!alert) return fail(404, "Fiyat alarmı bulunamadı.");

  const current = alert.status as PriceAlertStatus;
  if (!canChangeAlertStatus(current, nextStatus)) {
    return fail(409, "Bu alarmın durumu bu şekilde değiştirilemez.");
  }

  const { error } = await supabase
    .from("price_alerts")
    .update({ status: nextStatus, ...(nextStatus === "active" ? { triggered_at: null } : {}) })
    .eq("id", alertId)
    .eq("user_id", userId);
  if (error) {
    if (error.code === POSTGRES_CHECK_VIOLATION) return fail(409, limitMessage());
    console.error("Price alert update failed:", error);
    return fail(500, "Fiyat alarmı güncellenemedi.");
  }

  return { ok: true, httpStatus: 200, alertId, message: statusChangeMessage(nextStatus) };
}

function limitMessage() {
  return `En fazla ${MAX_ACTIVE_ALERTS_PER_USER} aktif fiyat alarmın olabilir. Birini iptal edip tekrar dene.`;
}

/** Lowest visible price of a product; "missing" when the product has no row. */
async function lookupLowestProductPrice(
  supabase: UserClient,
  productId: number,
): Promise<number | null | "missing" | "error"> {
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id")
    .eq("id", productId)
    .maybeSingle();
  if (productError) {
    console.error("Price alert product lookup failed:", productError);
    return "error";
  }
  if (!product) return "missing";

  const { data, error } = await supabase
    .from("product_price_stats")
    .select("min_price")
    .eq("product_id", productId)
    .maybeSingle();
  if (error) {
    console.error("Price alert product price lookup failed:", error);
    return "error";
  }
  return data?.min_price != null ? Number(data.min_price) : null;
}

async function lookupListingPrice(
  supabase: UserClient,
  listingId: number,
): Promise<number | "missing" | "error"> {
  const { data, error } = await supabase
    .from("listings")
    .select("price, status")
    .eq("id", listingId)
    .maybeSingle();
  if (error) {
    console.error("Price alert listing lookup failed:", error);
    return "error";
  }
  if (!data || !VISIBLE_LISTING_STATUSES.includes(data.status)) return "missing";
  return Number(data.price);
}
