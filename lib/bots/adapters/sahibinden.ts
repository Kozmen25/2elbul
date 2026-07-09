import "server-only";

import { load, type CheerioAPI, type Cheerio } from "cheerio";
import {
  absoluteUrl,
  cleanText,
  elementAttribute,
  elementText,
  extractImageUrls,
  normalizePrice,
  safeFetchHtml,
  type HtmlRootLike,
} from "@/lib/bots/html-utils";
import type { BotAdapterListing } from "@/lib/bots/types";

export const SAHIBINDEN_PHONE_CATEGORY_URL =
  "https://www.sahibinden.com/cep-telefonu";

const CLOUDFLARE_MARKERS = [
  "Just a moment...",
  "cf-challenge",
  "challenges.cloudflare.com",
  "__cf_chl_opt",
  "__cf_chl_tk",
  "/cdn-cgi/challenge-platform",
];

export function isCloudflareBlocked(html: string): boolean {
  return CLOUDFLARE_MARKERS.some((marker) => html.includes(marker));
}

export async function fetchSahibindenListings(
  categoryUrl = SAHIBINDEN_PHONE_CATEGORY_URL,
  limit = 10,
) {
  const response = await safeFetchHtml(categoryUrl, {
    source: "sahibinden",
    retries: 2,
    retryDelayMs: 1000,
  });

  if (isCloudflareBlocked(response.html)) {
    throw new Error(
      "Sahibinden Cloudflare koruması nedeniyle erişilemiyor. HTML fixture ile test edin.",
    );
  }

  return parseSahibindenCategoryHtml(
    response.html,
    response.finalUrl,
    Math.min(Math.max(limit, 1), 1000),
  );
}

export function parseSahibindenCategoryHtml(
  html: string,
  pageUrl: string,
  limit = 10,
): BotAdapterListing[] {
  const $ = load(html);
  const maxItems = Math.min(Math.max(limit, 1), 1000);
  const listings: BotAdapterListing[] = [];

  const items = findListingItems($);
  if (!items || items.length === 0) return listings;

  items.each((_idx: number, element: any) => {
    if (listings.length >= maxItems) return false;
    const $item = $(element);
    const listing = extractListing($item, $, pageUrl);
    if (listing) listings.push(listing);
  });

  return deduplicateByUrl(listings);
}

function findListingItems($: CheerioAPI): Cheerio<any> | null {
  const selectors = [
    ".searchResultsItem",
    "[class*='searchResultsItem']",
    ".classifiedItem",
    ".vitrin-item",
    "tr[data-id]",
    "table[class*='search'] tr",
  ];

  for (const selector of selectors) {
    const found = $(selector);
    if (found.length > 0) return found;
  }

  return null;
}

function extractListing(
  $item: Cheerio<any>,
  $: CheerioAPI,
  pageUrl: string,
): BotAdapterListing | null {
  const externalId = $item.attr("data-id") || "";

  const titleEl = $item.find(".classifiedTitle").first();
  const titleLink = titleEl.find("a").first();
  const title = cleanText(titleLink.text() || titleEl.text());
  const urlPath = titleLink.attr("href") || "";

  const url = absoluteUrl(pageUrl, urlPath);
  if (!url || !title) return null;

  const priceText = cleanText(
    $item.find(".searchResultsPriceValue").first().text() ||
      $item.find("[class*='price']").first().text(),
  );
  const price = normalizePrice(priceText);
  if (!Number.isFinite(price)) return null;

  const img = $item.find("img[data-src]").first() || $item.find("img").first();
  const rawImage = img.attr("data-src") || img.attr("src") || "";
  const normalizedImage = absoluteUrl(pageUrl, rawImage);

  const city = cleanText(
    $item.find(".searchResultsLocation").first().text() ||
      $item.find("[class*='location']").first().text(),
  );

  const dateText = cleanText(
    $item.find(".searchResultsDate").first().text() ||
      $item.find("[class*='date']").first().text(),
  );

  const listedAt = parseRelativeDate(dateText);
  const { brand, model } = extractBrandModel(title);

  return {
    external_id: externalId || undefined,
    product_name: title,
    title,
    price,
    city: city || "Türkiye",
    source: "Sahibinden",
    url,
    condition: "İkinci El",
    image_url: normalizedImage || null,
    image_urls: normalizedImage ? [normalizedImage] : [],
    brand: brand || undefined,
    model: model || undefined,
    listed_at: listedAt,
    status: "pending",
  };
}

export function parseRelativeDate(text: string): string | undefined {
  if (!text) return undefined;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const lower = text.toLocaleLowerCase("tr-TR");
  if (lower.includes("bugün")) return today.toISOString();
  if (lower.includes("dün")) {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString();
  }

  const dayMatch = lower.match(/(\d+)\s*g[üi]n\s*önce/);
  if (dayMatch) {
    const d = new Date(today);
    d.setDate(d.getDate() - parseInt(dayMatch[1], 10));
    return d.toISOString();
  }

  const weekMatch = lower.match(/(\d+)\s*hafta\s*önce/);
  if (weekMatch) {
    const d = new Date(today);
    d.setDate(d.getDate() - parseInt(weekMatch[1], 10) * 7);
    return d.toISOString();
  }

  const monthMatch = lower.match(/(\d+)\s*ay\s*önce/);
  if (monthMatch) {
    const d = new Date(today);
    d.setMonth(d.getMonth() - parseInt(monthMatch[1], 10));
    return d.toISOString();
  }

  const dateFormat = lower.match(/(\d{2})[./](\d{2})[./](\d{4})/);
  if (dateFormat) {
    const d = new Date(
      parseInt(dateFormat[3], 10),
      parseInt(dateFormat[2], 10) - 1,
      parseInt(dateFormat[1], 10),
    );
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  return undefined;
}

export function extractBrandModel(title: string): {
  brand?: string;
  model?: string;
} {
  const patterns: [RegExp, string?, string?][] = [
    [/\b(iPhone)\s+(\d+(?:\s*(?:Pro\s*Max|Pro|Plus|Mini|SE))?.*)/i],
    [/\b(Apple)\s+(iPhone\s+.*)/i],
    [/\b(Samsung)\s+(.*)/i],
    [/\b(Xiaomi)\s+(.*)/i],
    [/\b(Huawei)\s+(.*)/i],
    [/\b(Oppo)\s+(.*)/i],
    [/\b(Realme)\s+(.*)/i],
    [/\b(OnePlus|One\s*Plus)\s+(.*)/i],
    [/\b(Google)\s+(Pixel\s+.*)/i],
    [/\b(Sony)\s+(.*)/i],
    [/\b(Nokia)\s+(.*)/i],
    [/\b(LG)\s+(.*)/i],
    [/\b(HTC)\s+(.*)/i],
    [/\b(Motorola)\s+(.*)/i],
    [/\b(ASUS)\s+(.*)/i],
    [/\b(Honor)\s+(.*)/i],
    [/\b(Tecno)\s+(.*)/i],
    [/\b(Infinix)\s+(.*)/i],
    [/\b(General\s*Mobile)\s+(.*)/i],
  ];

  for (const [pattern] of patterns) {
    const match = title.match(pattern);
    if (match) {
      const brandName = match[1].trim();
      const modelRaw = (match[2] || "").trim();
      return { brand: brandName, model: modelRaw || undefined };
    }
  }

  return {};
}

export function parseSahibindenProductPage(
  root: HtmlRootLike,
  pageUrl: string,
): BotAdapterListing {
  const title = elementText(root, [
    "h1",
    "[class*='title'] h1",
    ".classifiedDetailTitle",
  ]);
  const priceText = elementText(root, [
    "[class*='price']",
    ".classifiedInfo .price",
  ]);
  const price = normalizePrice(priceText);

  if (!title || !Number.isFinite(price)) {
    throw new Error("Sahibinden ürün sayfası ayrıştırılamadı.");
  }

  const canonicalUrl =
    absoluteUrl(
      pageUrl,
      elementAttribute(root, ["link[rel='canonical']"], "href") || pageUrl,
    ) ?? pageUrl;

  const city = elementText(root, [
    "[class*='location']",
    ".classifiedInfo [class*='city']",
  ]);

  const imageUrls = extractImageUrls(
    root,
    [
      ".classifiedDetailSlider img",
      "[class*='gallery'] img",
      "[class*='slider'] img",
      "meta[property='og:image']",
    ],
    pageUrl,
  );

  return {
    product_name: title,
    title,
    price,
    city: city || "Türkiye",
    source: "Sahibinden",
    url: canonicalUrl,
    condition: "İkinci El",
    image_url: imageUrls[0] ?? null,
    image_urls: imageUrls,
    status: "pending",
  };
}

function deduplicateByUrl(listings: BotAdapterListing[]) {
  return [
    ...new Map(listings.map((listing) => [listing.url, listing])).values(),
  ];
}
