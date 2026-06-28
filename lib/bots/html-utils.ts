import type { ListingCondition } from "@/lib/listings";
import type { CheerioAPI } from "cheerio";

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (compatible; 2ElBulBot/1.0; +https://2elbul.com)";

export type HtmlElementLike = {
  textContent?: string | null;
  getAttribute(name: string): string | null;
  querySelector?(selector: string): HtmlElementLike | null;
  querySelectorAll?(selector: string): ArrayLike<HtmlElementLike>;
};

export type HtmlRootLike = HtmlElementLike & {
  querySelector(selector: string): HtmlElementLike | null;
  querySelectorAll(selector: string): ArrayLike<HtmlElementLike>;
};

export function absoluteUrl(baseUrl: string, src: string | null | undefined) {
  const value = src?.trim();
  if (!value || value.startsWith("data:") || value.startsWith("javascript:")) {
    return null;
  }

  try {
    const url = new URL(value, baseUrl);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

export function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractMetaImages($: CheerioAPI, baseUrl: string) {
  const images = new Set<string>();
  $(
    "meta[property='og:image'], meta[property='og:image:url'], meta[name='twitter:image'], meta[name='twitter:image:src']",
  ).each((_, element) => {
    const url = absoluteUrl(baseUrl, $(element).attr("content"));
    if (url) images.add(url);
  });
  return [...images];
}

export async function safeFetchHtml(
  url: string,
  options: {
    timeoutMs?: number;
    userAgent?: string;
    maxBytes?: number;
    retries?: number;
    retryDelayMs?: number;
  } = {},
) {
  const parsedUrl = new URL(url);
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Kaynak adresi HTTP veya HTTPS olmalıdır.");
  }

  const timeoutMs = options.timeoutMs ?? 15_000;
  const maxBytes = options.maxBytes ?? 5_000_000;
  const retries = options.retries ?? 1;
  const retryDelayMs = options.retryDelayMs ?? 700;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(parsedUrl, {
        cache: "no-store",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.7",
          "User-Agent": options.userAgent ?? DEFAULT_USER_AGENT,
        },
      });

      if (!response.ok) {
        throw new Error(`Kaynak HTTP ${response.status} yanıtı verdi.`);
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (
        contentType &&
        !contentType.includes("text/html") &&
        !contentType.includes("application/xhtml+xml")
      ) {
        throw new Error(`Beklenmeyen içerik türü: ${contentType}`);
      }

      const contentLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(contentLength) && contentLength > maxBytes) {
        throw new Error("Kaynak HTML yanıtı izin verilen boyutu aşıyor.");
      }

      const html = await response.text();
      if (Buffer.byteLength(html, "utf8") > maxBytes) {
        throw new Error("Kaynak HTML yanıtı izin verilen boyutu aşıyor.");
      }

      return {
        html,
        finalUrl: response.url || parsedUrl.toString(),
        status: response.status,
      };
    } catch (error) {
      lastError =
        error instanceof Error && error.name === "AbortError"
          ? new Error(`Kaynak isteği ${timeoutMs} ms içinde tamamlanamadı.`)
          : error;
      if (attempt < retries) await sleep(retryDelayMs * (attempt + 1));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}

export function extractImageUrl(
  element: HtmlElementLike | null | undefined,
  baseUrl = "",
) {
  if (!element) return null;

  const srcset =
    element.getAttribute("srcset") || element.getAttribute("data-srcset");
  const srcsetCandidate = srcset
    ?.split(",")
    .map((candidate) => candidate.trim().split(/\s+/)[0])
    .filter(Boolean)
    .at(-1);
  const value =
    element.getAttribute("data-zoom-image") ||
    element.getAttribute("data-large-image") ||
    element.getAttribute("data-original") ||
    element.getAttribute("data-src") ||
    element.getAttribute("data-lazy-src") ||
    srcsetCandidate ||
    element.getAttribute("src") ||
    element.getAttribute("content");

  return absoluteUrl(baseUrl, value);
}

export function extractImageUrls(
  root: HtmlRootLike,
  selectors: string[],
  baseUrl: string,
) {
  const urls = new Set<string>();
  for (const selector of selectors) {
    for (const element of Array.from(root.querySelectorAll(selector))) {
      const url = extractImageUrl(element, baseUrl);
      if (url) urls.add(url);
    }
  }
  return [...urls];
}

export async function validateImageUrls(
  urls: string[],
  options: { timeoutMs?: number; delayMs?: number; maxImages?: number } = {},
) {
  const valid: string[] = [];
  const seen = new Set<string>();
  const maxImages = options.maxImages ?? 8;

  for (const url of urls) {
    if (valid.length >= maxImages) break;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    if (await isValidImageUrl(url, options.timeoutMs ?? 5000)) {
      valid.push(url);
    }
    if (options.delayMs) await sleep(options.delayMs);
  }

  return valid;
}

export function normalizePrice(text: unknown) {
  const raw = cleanText(text);
  if (!raw) return Number.NaN;

  const cleaned = raw.replace(/[^\d,.-]/g, "");
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(?:\.\d{3})+$/.test(cleaned)
      ? cleaned.replace(/\./g, "")
      : cleaned;
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? value : Number.NaN;
}

export function normalizeCondition(
  text: string | null | undefined,
): ListingCondition {
  const value = String(text ?? "").toLocaleLowerCase("tr-TR");
  if (value.includes("yenilen") || value.includes("refurb")) {
    return "Yenilenmiş";
  }
  if (value.includes("sıfır") || value === "yeni") return "Sıfır";
  if (value.includes("yeni gibi")) return "Yeni gibi";
  if (value.includes("çok iyi")) return "Çok iyi";
  if (value.includes("iyi")) return "İyi";
  if (value.includes("kullanılmış")) return "Kullanılmış";
  return "İkinci El";
}

export function elementText(root: HtmlRootLike, selectors: string[]) {
  for (const selector of selectors) {
    const value = root.querySelector(selector)?.textContent?.trim();
    if (value) return value;
  }
  return "";
}

export function elementAttribute(
  root: HtmlRootLike,
  selectors: string[],
  attribute: string,
) {
  for (const selector of selectors) {
    const value = root.querySelector(selector)?.getAttribute(attribute)?.trim();
    if (value) return value;
  }
  return "";
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isValidImageUrl(url: string, timeoutMs: number) {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(parsed, {
        method: "HEAD",
        cache: "no-store",
        signal: controller.signal,
        headers: { "User-Agent": DEFAULT_USER_AGENT },
      });
      if (!response.ok) return false;
      const contentType = response.headers.get("content-type") ?? "";
      return contentType.toLowerCase().startsWith("image/");
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return false;
  }
}
