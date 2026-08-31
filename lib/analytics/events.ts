import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side-only, privacy-safe analytics event recorder.
 *
 * Records only coarse, aggregate-safe data (§13-14):
 *   - user_id is recorded only when the caller already knows it from the
 *     authenticated session.
 *   - traffic_source / device_type are coarse categories derived from the
 *     Referer + User-Agent headers at collection time. The raw header, IP, and
 *     UA string are never persisted or logged.
 *
 * Fire-and-forget: every failure is swallowed and logged at debug level. It is
 * intentionally impossible for analytics to break the auth/search path that
 * calls it.
 */

export type AnalyticsSource = "direct" | "google" | "social" | "search" | "referral";

export type AnalyticsDevice = "mobile" | "desktop" | "tablet";

export type RecordEventInput = {
  eventName: string;
  userId?: string | null;
  path?: string | null;
  searchQuery?: string | null;
  headers?: Headers;
};

/**
 * Coarse device category from a User-Agent header. Returns `null` when the
 * header is absent. Never returns or stores the UA string itself.
 */
export function classifyDevice(userAgent: string | null): AnalyticsDevice | null {
  if (!userAgent) return null;
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet|tab.*os|silk/.test(ua)) return "tablet";
  if (/iphone|android|mobile/.test(ua)) return "mobile";
  return "desktop";
}

/**
 * Coarse traffic-source category from a Referer header, based only on the
 * referrer's hostname. Falls back to "direct" when absent or opaque.
 */
export function classifyTrafficSource(referer: string | null): AnalyticsSource {
  if (!referer) return "direct";
  try {
    const hostname = new URL(referer).hostname.toLowerCase();
    if (/google\./.test(hostname) || hostname === "bing.com" || hostname.endsWith(".bing.com")) {
      return "google";
    }
    if (/facebook\.|instagram\.|x\.com|twitter\.|youtube\.|tiktok\.|linkedin\./.test(hostname)) {
      return "social";
    }
    if (/(^|\.)(bing|duckduckgo|yahoo|ecosia|startpage)\./.test(hostname)) {
      return "search";
    }
    return "referral";
  } catch {
    return "direct";
  }
}

export async function recordEvent(
  adminClient: SupabaseClient | null,
  input: RecordEventInput,
): Promise<void> {
  if (!adminClient) return;
  if (!input.eventName) return;

  const headers = input.headers;
  const device = classifyDevice(headers?.get("user-agent") ?? null);
  const source = classifyTrafficSource(headers?.get("referer") ?? null);

  try {
    await adminClient.from("analytics_events").insert({
      event_name: input.eventName,
      user_id: input.userId || null,
      path: input.path || null,
      search_query: input.searchQuery || null,
      traffic_source: source,
      device_type: device,
    });
  } catch (error) {
    console.debug("[analytics] event record failed:", error);
  }
}
