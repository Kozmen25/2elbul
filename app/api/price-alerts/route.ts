import { NextRequest, NextResponse } from "next/server";
import { changePriceAlertStatus, createPriceAlert } from "@/lib/price-alerts/service";
import { getAlertSession } from "@/lib/price-alerts/session";

export const dynamic = "force-dynamic";

async function authenticate() {
  const result = await getAlertSession();
  if (result.ok) return { session: result.session };
  return {
    error: NextResponse.json(
      {
        ok: false,
        error:
          result.reason === "unauthenticated"
            ? "Bu işlem için giriş yapmalısınız."
            : "Supabase bağlantısı yapılandırılmamış.",
      },
      { status: result.reason === "unauthenticated" ? 401 : 500 },
    ),
  };
}

export async function GET() {
  const { session, error: authError } = await authenticate();
  if (!session) return authError;

  const { data, error } = await session.supabase
    .from("price_alerts")
    .select(
      "id, product_id, listing_id, target_price, current_price, status, triggered_at, last_checked_at, created_at, products(name), listings(title, price)",
    )
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Price alerts list failed:", error);
    return NextResponse.json({ ok: false, error: "Fiyat alarmları okunamadı." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, alerts: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { session, error: authError } = await authenticate();
  if (!session) return authError;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const result = await createPriceAlert(session.supabase, session.userId, {
    productId: body?.productId,
    listingId: body?.listingId,
    targetPrice: body?.targetPrice,
  });

  return NextResponse.json(
    result.ok
      ? { ok: true, alertId: result.alertId, duplicate: result.duplicate ?? false, message: result.message }
      : { ok: false, error: result.message },
    { status: result.httpStatus },
  );
}

/** Body: { id, status } where status is active | paused | cancelled. */
export async function PATCH(request: NextRequest) {
  const { session, error: authError } = await authenticate();
  if (!session) return authError;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const result = await changePriceAlertStatus(session.supabase, session.userId, body?.id, body?.status);

  return NextResponse.json(
    result.ok ? { ok: true, message: result.message } : { ok: false, error: result.message },
    { status: result.httpStatus },
  );
}
