import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type PriceAlertPayload = {
  productId?: string | number | null;
  listingId?: string | number | null;
  targetPrice?: string | number | null;
};

export async function GET() {
  const auth = await getAuthenticatedClient();
  if (auth.error) return auth.error;

  const { data, error } = await auth.supabase
    .from("price_alerts")
    .select(
      "id, product_id, listing_id, target_price, current_price, status, triggered_at, last_checked_at, created_at, products(name), listings(title, price)",
    )
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Price alerts list failed:", error);
    return NextResponse.json(
      { ok: false, error: "Fiyat alarmları okunamadı." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, alerts: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedClient();
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => null)) as PriceAlertPayload | null;
  const productId = normalizePositiveInteger(body?.productId);
  const listingId = normalizePositiveInteger(body?.listingId);
  const targetPrice = normalizePositiveNumber(body?.targetPrice);

  if (!productId && !listingId) {
    return NextResponse.json(
      { ok: false, error: "Ürün veya ilan seçimi gerekli." },
      { status: 400 },
    );
  }

  if (!targetPrice) {
    return NextResponse.json(
      { ok: false, error: "Geçerli bir hedef fiyat girin." },
      { status: 400 },
    );
  }

  const existingQuery = auth.supabase
    .from("price_alerts")
    .select("id")
    .eq("user_id", auth.userId)
    .eq("target_price", targetPrice)
    .eq("status", "active")
    .limit(1);

  if (listingId) existingQuery.eq("listing_id", listingId);
  else existingQuery.eq("product_id", productId);

  const { data: existing, error: existingError } = await existingQuery.maybeSingle();

  if (existingError) {
    console.error("Price alert duplicate lookup failed:", existingError);
    return NextResponse.json(
      { ok: false, error: "Fiyat alarmı kontrol edilemedi." },
      { status: 500 },
    );
  }

  if (existing) {
    return NextResponse.json({
      ok: true,
      duplicate: true,
      alertId: existing.id,
      message: "Bu hedef fiyat için aktif alarmın zaten var.",
    });
  }

  const currentPrice = await getCurrentPrice(auth.supabase, productId, listingId);

  const { data, error } = await auth.supabase
    .from("price_alerts")
    .insert({
      user_id: auth.userId,
      product_id: productId,
      listing_id: listingId,
      target_price: targetPrice,
      current_price: currentPrice,
      status: "active",
    })
    .select("id")
    .single();

  if (error) {
    console.error("Price alert insert failed:", error);
    return NextResponse.json(
      { ok: false, error: "Fiyat alarmı oluşturulamadı." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    alertId: data.id,
    message: "Fiyat alarmın oluşturuldu.",
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await getAuthenticatedClient();
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => null)) as
    | { id?: string; status?: string }
    | null;
  const id = body?.id;

  if (!id) {
    return NextResponse.json(
      { ok: false, error: "Alarm kimliği gerekli." },
      { status: 400 },
    );
  }

  const status = body?.status === "paused" ? "paused" : "cancelled";
  const { error } = await auth.supabase
    .from("price_alerts")
    .update({ status })
    .eq("id", id)
    .eq("user_id", auth.userId);

  if (error) {
    console.error("Price alert update failed:", error);
    return NextResponse.json(
      { ok: false, error: "Fiyat alarmı güncellenemedi." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, message: "Fiyat alarmı iptal edildi." });
}

async function getAuthenticatedClient() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      error: NextResponse.json(
        { ok: false, error: "Supabase bağlantısı yapılandırılmamış." },
        { status: 500 },
      ),
    } as const;
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return {
      error: NextResponse.json(
        { ok: false, error: "Bu işlem için giriş yapmalısınız." },
        { status: 401 },
      ),
    } as const;
  }

  return { supabase, userId: data.user.id, error: null } as const;
}

async function getCurrentPrice(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  productId: number | null,
  listingId: number | null,
) {
  if (listingId) {
    const { data, error } = await supabase
      .from("listings")
      .select("price")
      .eq("id", listingId)
      .maybeSingle();
    if (error) console.error("Price alert listing price lookup failed:", error);
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
  if (error) console.error("Price alert product price lookup failed:", error);
  return data?.price ? Number(data.price) : null;
}

function normalizePositiveInteger(value: PriceAlertPayload[keyof PriceAlertPayload]) {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null;
}

function normalizePositiveNumber(value: PriceAlertPayload[keyof PriceAlertPayload]) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
}
