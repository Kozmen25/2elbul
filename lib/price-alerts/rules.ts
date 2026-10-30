// Pure price-alert rules shared by the app (server action, API route) and the
// daily check (/api/cron/check-price-alerts). No I/O.

export const MAX_TARGET_PRICE = 100_000_000;

/** Mirrors the database trigger enforce_price_alert_limit(). */
export const MAX_ACTIVE_ALERTS_PER_USER = 50;

/**
 * Minimum relative price reduction (percent) before a price drop is reported.
 * Below this bound genuine price changes are too small to act on; the market
 * pulse trend engine treats ~4% as the falling-direction boundary, so a drop
 * boundary slightly above it avoids firing on noise while still catching real
 * reductions that never cross an absolute target price.
 */
export const PRICE_DROP_MIN_PERCENT = 5;

export type PriceAlertStatus = "active" | "triggered" | "paused" | "cancelled";

export function parsePositiveInteger(value: unknown): number | null {
  const parsed = typeof value === "string" && value.trim() === "" ? Number.NaN : Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

/** A target price in TRY: positive, finite, sane, at most 2 decimals. */
export function parseTargetPrice(value: unknown): number | null {
  const parsed = typeof value === "string" && value.trim() === "" ? Number.NaN : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > MAX_TARGET_PRICE) return null;
  return Math.round(parsed * 100) / 100;
}

// Which status changes a user may make on their own alert.
//   active    → paused | cancelled
//   paused    → active | cancelled
//   triggered → active (re-arm at the same target) | cancelled
//   cancelled → nothing (create a new alert instead)
const ALLOWED_TRANSITIONS: Record<PriceAlertStatus, PriceAlertStatus[]> = {
  active: ["paused", "cancelled"],
  paused: ["active", "cancelled"],
  triggered: ["active", "cancelled"],
  cancelled: [],
};

export function isPriceAlertStatus(value: unknown): value is PriceAlertStatus {
  return value === "active" || value === "triggered" || value === "paused" || value === "cancelled";
}

export function canChangeAlertStatus(from: PriceAlertStatus, to: PriceAlertStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function statusChangeMessage(to: PriceAlertStatus): string {
  if (to === "active") return "Fiyat alarmı yeniden aktif.";
  if (to === "paused") return "Fiyat alarmı duraklatıldı.";
  return "Fiyat alarmı iptal edildi.";
}

export type AlertOutcome =
  | { kind: "triggered" }
  | { kind: "price_drop"; previousPrice: number; dropPercent: number }
  | { kind: "unchanged" };

/**
 * Decides what a check run should do for one alert.
 *  - triggered:  the price is at or below the user's target.
 *  - price_drop: the price fell at least PRICE_DROP_MIN_PERCENT since the last
 *                check (never for accessories/spare parts — `suppressDrop`).
 */
export function evaluatePriceAlert(input: {
  targetPrice: number;
  currentPrice: number;
  previousPrice: number | null;
  suppressDrop?: boolean;
}): AlertOutcome {
  const { targetPrice, currentPrice, previousPrice, suppressDrop = false } = input;

  if (currentPrice <= targetPrice) return { kind: "triggered" };

  if (
    !suppressDrop &&
    previousPrice != null &&
    previousPrice > 0 &&
    currentPrice < previousPrice
  ) {
    const dropPercent = ((previousPrice - currentPrice) / previousPrice) * 100;
    if (dropPercent >= PRICE_DROP_MIN_PERCENT) {
      return { kind: "price_drop", previousPrice, dropPercent: Math.round(dropPercent) };
    }
  }

  return { kind: "unchanged" };
}
