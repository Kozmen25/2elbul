import "server-only";

import { CircuitBreakerRegistry } from "@/lib/recovery/circuit-breaker";
import { safeFetchHtml } from "@/lib/bots/html-utils";

const SCRAPINGFISH_BASE_URL = "https://api.scrapingfish.com/";
const SCRAPINGFISH_CB_SLUG = "scrapingfish";

export type AntiBotProxyResult = {
  html: string;
  finalUrl: string;
  status: number;
};

export type AntiBotProxyOptions = {
  apiKey?: string;
  timeoutMs?: number;
};

const CLOUDFLARE_MARKERS = [
  "Just a moment...",
  "cf-challenge",
  "challenges.cloudflare.com",
  "__cf_chl_opt",
  "__cf_chl_tk",
  "/cdn-cgi/challenge-platform",
];

function isCloudflareBlocked(html: string): boolean {
  return CLOUDFLARE_MARKERS.some((marker) => html.includes(marker));
}

/**
 * Routes an HTTP request through ScrapingFish's anti-bot proxy with JS rendering.
 * ScrapingFish handles Cloudflare Managed Challenge, Turnstile, and proof-of-work
 * on its end, returning the real HTML content.
 *
 * Requires SCRAPINGFISH_API_KEY to be set in environment variables.
 * Falls back cleanly with a descriptive error when the key is missing.
 *
 * Resilience: On ScrapingFish failure (HTTP errors, timeouts, Cloudflare blocks),
 * falls back to safeFetchHtml (direct fetch with retry). The scrapingfish circuit
 * breaker tracks consecutive failures and skips ScrapingFish entirely when open.
 */
export async function fetchViaAntiBotProxy(
  url: string,
  options: AntiBotProxyOptions = {},
): Promise<AntiBotProxyResult> {
  const apiKey = options.apiKey ?? process.env.SCRAPINGFISH_API_KEY;

  if (!apiKey) {
    throw new Error(
      "SCRAPINGFISH_API_KEY ortam değişkeni tanımlanmamış. " +
        "Anti-bot proxy kullanmak için .env.local dosyasına SCRAPINGFISH_API_KEY ekleyin.",
    );
  }

  const cb = CircuitBreakerRegistry.getInstance();
  const timeoutMs = options.timeoutMs ?? 30_000;

  // Circuit breaker check — skip ScrapingFish entirely if circuit is open
  if (!cb.isAvailable(SCRAPINGFISH_CB_SLUG)) {
    console.warn(
      `[ScrapingFish] Circuit open for ${SCRAPINGFISH_CB_SLUG}, falling back to safeFetchHtml`,
    );
    return safeFetchHtml(url, { source: "scrapingfish-fallback" });
  }

  const apiUrl = new URL(SCRAPINGFISH_BASE_URL);
  apiUrl.searchParams.set("key", apiKey);
  apiUrl.searchParams.set("url", url);
  apiUrl.searchParams.set("render", "true");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(apiUrl.toString(), {
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      const msg = `ScrapingFish API HTTP ${response.status} yanıtı verdi: ${body.slice(0, 200)}`;

      // Auth errors (401/403) indicate config problems — don't fall back, throw
      if (response.status === 401 || response.status === 403) {
        throw new Error(msg);
      }

      console.warn(`[ScrapingFish] ${msg}`);
      cb.recordFailure(SCRAPINGFISH_CB_SLUG);
      return safeFetchHtml(url, { source: "scrapingfish-fallback" });
    }

    const html = await response.text();

    if (isCloudflareBlocked(html)) {
      const msg =
        "ScrapingFish Cloudflare korumasını aşamadı. Sayfa hala challenge gösteriyor.";
      console.warn(`[ScrapingFish] ${msg}`);
      cb.recordFailure(SCRAPINGFISH_CB_SLUG);
      return safeFetchHtml(url, { source: "scrapingfish-fallback" });
    }

    cb.recordSuccess(SCRAPINGFISH_CB_SLUG);
    return {
      html,
      finalUrl: url,
      status: response.status,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      const msg = `ScrapingFish isteği ${timeoutMs} ms içinde tamamlanamadı.`;
      console.warn(`[ScrapingFish] ${msg}`);
      cb.recordFailure(SCRAPINGFISH_CB_SLUG);
      return safeFetchHtml(url, { source: "scrapingfish-fallback" });
    }

    // Auth errors from ScrapingFish (401/403) indicate config problems — propagate, don't fall back
    if (
      error instanceof Error &&
      (error.message.includes("HTTP 401") || error.message.includes("HTTP 403"))
    ) {
      throw error;
    }

    // All other errors (network, timeout above non-AbortError, etc.) fall back to safeFetchHtml
    console.warn(
      `[ScrapingFish] Hata: ${error instanceof Error ? error.message : String(error)} — safeFetchHtml ile düşüş yapılıyor`,
    );
    cb.recordFailure(SCRAPINGFISH_CB_SLUG);
    return safeFetchHtml(url, { source: "scrapingfish-fallback" });
  } finally {
    clearTimeout(timeout);
  }
}
