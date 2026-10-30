// Reads one fetch of a listing's source page and says whether the listing is
// still there. Anything ambiguous is "unknown": a blocked or failing request
// must never take a live listing off the site.

export type AvailabilityOutcome = "available" | "removed" | "sold_out" | "unknown";

export type AvailabilityCheck = {
  outcome: AvailabilityOutcome;
  /** Short machine-readable reason, kept in logs and the cron summary. */
  detail: string;
};

export type FetchedPage = {
  requestedUrl: string;
  /** Final status after following redirects; null when the request failed. */
  status: number | null;
  finalUrl: string | null;
  /** Start of the HTML (enough for <title> and structured data). */
  body: string;
};

/** Statuses that mean the page no longer exists. */
const GONE_STATUSES = new Set([404, 410]);

/** Anti-bot interstitials: the page was not shown to us, so nothing is known. */
const CHALLENGE_TITLE_PATTERN =
  /just a moment|attention required|captcha|access denied|erişim engellendi|are you a robot|robot olmadığ/i;

/**
 * Titles of "not found" pages served with status 200 (soft 404). A bare "404"
 * is not enough: it is also a model name ("Peugeot 404").
 */
const NOT_FOUND_TITLE_PATTERN =
  /404 not found|error 404|hata 404|404 hata|sayfa bulunamad|ilan bulunamad|ürün bulunamad|page not found/i;

/**
 * Notices marketplaces show on a removed or sold listing. Kept to full
 * sentences so a seller's own description cannot trigger them.
 */
const REMOVED_TEXT_PATTERN =
  /ilan yayından kaldırılmıştır|ilan yayından kaldırılmış|bu ilan artık yayında değil|bu ilan yayında değil|bu ilan satılmıştır/i;

const SCHEMA_AVAILABILITY_PATTERN =
  /"availability"\s*:\s*"(?:https?:\/\/schema\.org\/)?([A-Za-z]+)"/g;

const OUT_OF_STOCK_VALUES = new Set(["OutOfStock", "SoldOut", "Discontinued"]);

function readTitle(body: string): string {
  return body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "";
}

/**
 * Structured-data verdict. Product pages also list related products, so the
 * page counts as sold out only when every availability on it is out of stock.
 */
function readSchemaAvailability(body: string): "in_stock" | "out_of_stock" | null {
  const values = [...body.matchAll(SCHEMA_AVAILABILITY_PATTERN)].map((match) => match[1]);
  if (!values.length) return null;
  return values.every((value) => OUT_OF_STOCK_VALUES.has(value)) ? "out_of_stock" : "in_stock";
}

/** True when the request for a deep link ended on the site's home page. */
function redirectedToHome(requestedUrl: string, finalUrl: string | null): boolean {
  if (!finalUrl) return false;
  try {
    const requested = new URL(requestedUrl);
    const final = new URL(finalUrl);
    const sameSite = requested.hostname.replace(/^www\./, "") === final.hostname.replace(/^www\./, "");
    return sameSite && requested.pathname.length > 1 && (final.pathname === "/" || final.pathname === "");
  } catch {
    return false;
  }
}

export function classifyFetchedPage(page: FetchedPage): AvailabilityCheck {
  if (page.status === null) return { outcome: "unknown", detail: "request_failed" };
  if (GONE_STATUSES.has(page.status)) return { outcome: "removed", detail: `http_${page.status}` };
  // 401/403/429/5xx and anything else unusual: blocked or broken, not gone.
  if (page.status < 200 || page.status >= 300) return { outcome: "unknown", detail: `http_${page.status}` };

  const title = readTitle(page.body);
  if (CHALLENGE_TITLE_PATTERN.test(title)) return { outcome: "unknown", detail: "challenge_page" };
  if (redirectedToHome(page.requestedUrl, page.finalUrl)) return { outcome: "removed", detail: "redirected_home" };
  if (NOT_FOUND_TITLE_PATTERN.test(title)) return { outcome: "removed", detail: "not_found_title" };
  if (REMOVED_TEXT_PATTERN.test(page.body)) return { outcome: "removed", detail: "removed_notice" };
  if (readSchemaAvailability(page.body) === "out_of_stock") return { outcome: "sold_out", detail: "schema_out_of_stock" };

  return { outcome: "available", detail: "ok" };
}
