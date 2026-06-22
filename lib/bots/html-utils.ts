import type { ListingCondition } from "@/lib/listings";

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

export function normalizePrice(text: string | null | undefined) {
  const raw = String(text ?? "").trim();
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

export function elementText(
  root: HtmlRootLike,
  selectors: string[],
) {
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
