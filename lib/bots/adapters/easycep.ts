import "server-only";

import { load, type CheerioAPI } from "cheerio";
import {
  absoluteUrl,
  cleanText,
  elementAttribute,
  elementText,
  extractMetaImages,
  extractImageUrls,
  normalizeCondition,
  normalizePrice,
  safeFetchHtml,
  type HtmlRootLike,
} from "@/lib/bots/html-utils";
import type { BotAdapterListing } from "@/lib/bots/types";

export const EASYCEP_PHONE_CATEGORY_URL =
  "https://easycep.com/kategori/cep-telefonu-1";

type JsonLdProduct = {
  "@type"?: string;
  name?: string;
  image?: unknown;
  url?: string;
  offers?: {
    price?: string | number;
    url?: string;
  };
};

export async function fetchEasyCepListings(
  categoryUrl = EASYCEP_PHONE_CATEGORY_URL,
  limit = 10,
) {
  const response = await safeFetchHtml(categoryUrl);
  return parseEasyCepCategoryHtml(
    response.html,
    response.finalUrl,
    Math.min(Math.max(limit, 1), 1000),
  );
}

export function parseEasyCepCategoryHtml(
  html: string,
  pageUrl: string,
  limit = 10,
): BotAdapterListing[] {
  const $ = load(html);
  const maxItems = Math.min(Math.max(limit, 1), 1000);
  const listings = parseJsonLdProducts($, pageUrl, maxItems);
  return listings.slice(0, maxItems);
}

export function parseEasyCepProductPage(
  root: HtmlRootLike,
  pageUrl: string,
): BotAdapterListing {
  const productName = elementText(root, [
    "h1",
    "[data-testid='product-title']",
    ".product-title",
    "[itemprop='name']",
  ]);
  const priceText = elementText(root, [
    "[data-testid='product-price']",
    ".product-price",
    ".price",
    "[itemprop='price']",
  ]);
  const priceAttribute = elementAttribute(
    root,
    ["[itemprop='price']"],
    "content",
  );
  const price = normalizePrice(priceAttribute || priceText);
  const canonicalUrl = absoluteUrl(
    pageUrl,
    elementAttribute(root, ["link[rel='canonical']"], "href") || pageUrl,
  );
  const imageUrls = extractImageUrls(
    root,
    [
      "[data-testid='product-gallery'] img",
      ".product-gallery img",
      ".swiper-slide img",
      "[itemprop='image']",
      "meta[property='og:image']",
    ],
    pageUrl,
  );

  if (!productName) throw new Error("EasyCep ürün adı bulunamadı.");
  if (!Number.isFinite(price)) throw new Error("EasyCep fiyatı bulunamadı.");

  return {
    product_name: productName,
    title: productName,
    price,
    city: "Türkiye",
    source: "EasyCep",
    url: canonicalUrl ?? pageUrl,
    condition: normalizeCondition(
      elementText(root, [
        "[data-testid='product-condition']",
        ".product-condition",
        ".grade",
      ]) || "Yenilenmiş",
    ),
    image_url: imageUrls[0] ?? null,
    image_urls: imageUrls,
    status: "pending",
  };
}

function parseJsonLdProducts($: CheerioAPI, pageUrl: string, limit: number) {
  const listings: BotAdapterListing[] = [];

  $("script[type='application/ld+json']").each((_, element) => {
    if (listings.length >= limit) return;
    try {
      const data = JSON.parse($(element).text()) as {
        "@type"?: string;
        itemListElement?: JsonLdProduct[];
      };
      if (data["@type"] !== "ItemList" || !Array.isArray(data.itemListElement)) {
        return;
      }

      for (const item of data.itemListElement) {
        if (listings.length >= limit || item["@type"] !== "Product") break;
        const listing = toEasyCepListing(item, pageUrl);
        if (listing) listings.push(listing);
      }
    } catch {
      // A malformed JSON-LD block should not prevent DOM or other blocks parsing.
    }
  });

  if (listings.length) return deduplicateByUrl(listings);

  const metaImages = extractMetaImages($, pageUrl);
  $("[itemtype*='Product']").each((_, element) => {
    if (listings.length >= limit) return;
    const card = $(element);
    const title = cleanText(
      card.find("[itemprop='name'], h2, h3").first().text(),
    );
    const price = normalizePrice(
      card.find("[itemprop='price']").attr("content") ||
        card.find("[itemprop='price'], .price").first().text(),
    );
    const url = absoluteUrl(
      pageUrl,
      card.find("a[href]").first().attr("href"),
    );
    const imageUrl = absoluteUrl(
      pageUrl,
      card.find("img").first().attr("data-src") ||
        card.find("img").first().attr("src"),
    );
    if (!title || !url || !Number.isFinite(price)) return;
    listings.push(
      createListing(title, price, url, imageUrl ? [imageUrl] : metaImages),
    );
  });

  return deduplicateByUrl(listings);
}

function toEasyCepListing(product: JsonLdProduct, pageUrl: string) {
  const title = cleanText(product.name);
  const price = normalizePrice(product.offers?.price);
  const url = absoluteUrl(pageUrl, product.url || product.offers?.url);
  if (!title || !url || !Number.isFinite(price)) return null;

  return createListing(title, price, url, normalizeImages(product.image, pageUrl));
}

function createListing(
  title: string,
  price: number,
  url: string,
  imageUrls: string[],
): BotAdapterListing {
  return {
    product_name: deriveProductName(title),
    title,
    price,
    city: "Türkiye",
    source: "EasyCep",
    url,
    condition: "Yenilenmiş",
    image_url: imageUrls[0] ?? null,
    image_urls: imageUrls,
    status: "pending",
  };
}

function normalizeImages(value: unknown, pageUrl: string) {
  const candidates = Array.isArray(value) ? value : [value];
  return [
    ...new Set(
      candidates
        .map((item) =>
          typeof item === "string"
            ? item
            : item && typeof item === "object" && "contentUrl" in item
              ? String(item.contentUrl)
              : "",
        )
        .map((item) => absoluteUrl(pageUrl, item))
        .filter((item): item is string => Boolean(item)),
    ),
  ];
}

function deriveProductName(title: string) {
  return cleanText(title)
    .replace(/^Yenilenmiş\s+/i, "")
    .replace(/^Apple\s+(?=iPhone)/i, "")
    .replace(/\s+\d+\s*(?:GB|TB)\b.*$/i, "")
    .replace(/\biPhone\b/i, "iPhone")
    .trim();
}

function deduplicateByUrl(listings: BotAdapterListing[]) {
  return [...new Map(listings.map((listing) => [listing.url, listing])).values()];
}
