"use server";

import { changePriceAlertStatus, createPriceAlert as createAlert } from "@/lib/price-alerts/service";
import { getAlertSession } from "@/lib/price-alerts/session";
import type { PriceAlertStatus } from "@/lib/price-alerts/rules";

export type PriceAlertActionResult = {
  ok: boolean;
  message: string;
  requiresAuth?: boolean;
};

async function requireSession(loginMessage: string) {
  const result = await getAlertSession();
  if (result.ok) return { session: result.session };
  return {
    failure: {
      ok: false,
      requiresAuth: result.reason === "unauthenticated",
      message:
        result.reason === "unauthenticated" ? loginMessage : "Supabase bağlantısı yapılandırılmamış.",
    } satisfies PriceAlertActionResult,
  };
}

export async function createPriceAlert(input: {
  productId: string;
  targetPrice: number;
}): Promise<PriceAlertActionResult> {
  const { session, failure } = await requireSession("Fiyat alarmı kurmak için giriş yapmalısınız.");
  if (!session) return failure;

  // No revalidatePath: /hesabim is a dynamic page (per-user cookies), so it is
  // never served from the client router cache, and revalidating here would
  // re-render the heavy product page the form sits on for no benefit.
  const result = await createAlert(session.supabase, session.userId, input);
  return { ok: result.ok, message: result.message };
}

/** Pause, resume, re-arm (triggered → active) or cancel one of the user's alerts. */
export async function setPriceAlertStatus(
  alertId: string,
  status: PriceAlertStatus,
): Promise<PriceAlertActionResult> {
  const { session, failure } = await requireSession("Bu işlem için giriş yapmalısınız.");
  if (!session) return failure;

  const result = await changePriceAlertStatus(session.supabase, session.userId, alertId, status);
  return { ok: result.ok, message: result.message };
}
