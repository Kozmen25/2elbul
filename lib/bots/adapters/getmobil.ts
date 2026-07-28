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
  sleep,
  type HtmlRootLike,
} from "@/lib/bots/html-utils";
import type { BotAdapterListing } from "@/lib/bots/types";

export const GETMOBIL_PHONE_CATEGORY_URL =
  "https://getmobil.com/satin-al/cep-telefonu/";
export const GETMOBIL_WATCH_CATEGORY_URL =
  "https://getmobil.com/satin-al/akilli-saat-ve-bileklik/akilli-saat/";
export const GETMOBIL_COMPUTER_CATEGORY_URL =
  "https://getmobil.com/satin-al/bilgisayar-tablet/";
export const GETMOBIL_ACCESSORY_CATEGORY_URL =
  "https://getmobil.com/satin-al/aksesuar/";

export const GETMOBIL_CATEGORY_URLS: Record<string, string> = {
  [GETMOBIL_PHONE_CATEGORY_URL]: "Cep Telefonu",
  [GETMOBIL_WATCH_CATEGORY_URL]: "Akıllı Saat",
  [GETMOBIL_COMPUTER_CATEGORY_URL]: "Bilgisayar ve Tablet",
  [GETMOBIL_ACCESSORY_CATEGORY_URL]: "Aksesuar",
};

type JsonLdProduct = {
  "@type"?: string;
  name?: string;
  image?: unknown;
  url?: string;
  offers?: {
    price?: string | number;
    url?: string;
  };
  hasVariant?: JsonLdProduct[];
};

type JsonLdListItem = {
  "@type"?: string;
  item?: JsonLdProduct;
};

export async function fetchGetmobilListings(
  categoryUrl = GETMOBIL_PHONE_CATEGORY_URL,
  limit = 10,
) {
  const category = GETMOBIL_CATEGORY_URLS[categoryUrl] ?? null;
  // Fetch page 1 first
  const response = await safeFetchHtml(categoryUrl);
  const allListings = parseGetmobilCategoryHtml(
    response.html,
    response.finalUrl,
    Math.min(Math.max(limit, 1), 1000),
    category,
  );

  // Try subsequent pages — iterate until limit or no more pages
  const maxPages = 20;
  const delayBetweenPages = 1500;
  for (let page = 2; page <= maxPages; page++) {
    await sleep(delayBetweenPages);
    const pageUrl = `${categoryUrl}?sayfa=${page}`;
    try {
      const pageResponse = await safeFetchHtml(pageUrl);
      const pageListings = parseGetmobilCategoryHtml(
        pageResponse.html,
        pageResponse.finalUrl,
        limit,
      );
      if (pageListings.length === 0) break;
      allListings.push(...pageListings);
      if (allListings.length >= limit) break;
    } catch {
      break;
    }
  }

  // Dedup across all pages before returning
  return deduplicateByUrl(allListings).slice(0, limit);
}

export function parseGetmobilCategoryHtml(
  html: string,
  pageUrl: string,
  limit = 10,
  category: string | null = null,
): BotAdapterListing[] {
  const $ = load(html);
  const maxItems = Math.min(Math.max(limit, 1), 1000);
  const listings = parseJsonLdProducts($, pageUrl, maxItems, category);
  return listings.slice(0, maxItems);
}

export function parseGetmobilProductPage(
  root: HtmlRootLike,
  pageUrl: string,
  category: string | null = null,
): BotAdapterListing {
  const productName = elementText(root, [
    "h1",
    "[data-testid='product-name']",
    ".product-name",
    "[itemprop='name']",
  ]);
  const priceText = elementText(root, [
    "[data-testid='sale-price']",
    ".sale-price",
    ".product-price",
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
      "[data-testid='product-images'] img",
      ".product-images img",
      ".product-gallery img",
      ".swiper-slide img",
      "[itemprop='image']",
      "meta[property='og:image']",
    ],
    pageUrl,
  );

  if (!productName) throw new Error("Getmobil ürün adı bulunamadı.");
  if (!Number.isFinite(price)) throw new Error("Getmobil fiyatı bulunamadı.");

  return {
    product_name: productName,
    title: productName,
    price,
    city: "Türkiye",
    source: "Getmobil",
    url: canonicalUrl ?? pageUrl,
    condition: normalizeCondition(
      elementText(root, [
        "[data-testid='device-condition']",
        ".device-condition",
        ".grade",
      ]) || "Yenilenmiş",
    ),
    image_url: imageUrls[0] ?? null,
    image_urls: imageUrls,
    status: "pending",
    category,
  };
}

function parseJsonLdProducts($: CheerioAPI, pageUrl: string, limit: number, category: string | null = null) {
  const listings: BotAdapterListing[] = [];

  $("script[type='application/ld+json']").each((_, element) => {
    if (listings.length >= limit) return;
    try {
      const parsed = JSON.parse($(element).text()) as unknown;
      for (const data of collectJsonLdObjects(parsed)) {
        if (
          data["@type"] !== "ItemList" ||
          !Array.isArray(data.itemListElement)
        ) {
          continue;
        }

        for (const listItem of data.itemListElement as JsonLdListItem[]) {
          if (listings.length >= limit) break;
          const product = listItem.item;
          if (
            !product ||
            !["Product", "ProductGroup"].includes(product["@type"] ?? "")
          ) {
            continue;
          }
          const listing = toGetmobilListing(product, pageUrl, category);
          if (listing) listings.push(listing);
        }
      }
    } catch {
      // Continue with other JSON-LD blocks or the DOM fallback.
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
    if (
      !title ||
      !url ||
      !isGetmobilProductUrl(url) ||
      !imageUrl ||
      !Number.isFinite(price)
    ) {
      return;
    }
	    listings.push(
	      createListing(title, price, url, [imageUrl, ...metaImages], category),
	    );
  });

  return deduplicateByUrl(listings);
}

function toGetmobilListing(product: JsonLdProduct, pageUrl: string, category: string | null = null) {
  const variant = product.hasVariant?.find((item) => {
    const price = normalizePrice(item.offers?.price);
    const url = absoluteUrl(pageUrl, item.url || item.offers?.url);
    return Number.isFinite(price) && Boolean(url);
  });
  const title = cleanText(product.name || variant?.name);
  const price = normalizePrice(product.offers?.price ?? variant?.offers?.price);
  const url = absoluteUrl(
    pageUrl,
    product.url ||
      product.offers?.url ||
      variant?.url ||
      variant?.offers?.url,
  );
  const imageUrls = [
    ...new Set([
      ...normalizeImages(product.image, pageUrl),
      ...normalizeImages(variant?.image, pageUrl),
    ]),
  ];
  if (
    !title ||
    !url ||
    !isGetmobilProductUrl(url) ||
    !imageUrls.length ||
    !Number.isFinite(price)
  ) {
    return null;
  }

  return createListing(title, price, url, imageUrls, category);
}

function createListing(
  title: string,
  price: number,
  url: string,
  imageUrls: string[],
  category: string | null = null,
): BotAdapterListing {
  return {
    product_name: deriveProductName(title),
    title,
    price,
    city: "Türkiye",
    source: "Getmobil",
    url,
    condition: "Yenilenmiş",
    image_url: imageUrls[0] ?? null,
    image_urls: imageUrls,
    status: "pending",
    category,
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
            : item && typeof item === "object"
              ? "contentUrl" in item
                ? String(item.contentUrl)
                : "url" in item
                  ? String(item.url)
                  : ""
              : "",
        )
        .map((item) => absoluteUrl(pageUrl, item))
        .filter((item): item is string => Boolean(item)),
    ),
  ];
}

function collectJsonLdObjects(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.flatMap(collectJsonLdObjects);
  }
  if (!value || typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  const graph = Array.isArray(record["@graph"])
    ? record["@graph"].flatMap(collectJsonLdObjects)
    : [];
  return [record, ...graph];
}

function isGetmobilProductUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      (url.hostname === "getmobil.com" ||
        url.hostname.endsWith(".getmobil.com")) &&
      url.pathname.startsWith("/satin-al/")
    );
  } catch {
    return false;
  }
}

function deriveProductName(title: string) {
  return cleanText(title)
    .replace(/^Yenilenmiş\s+/i, "")
    .replace(/^Apple\s+(?=iPhone)/i, "")
    .replace(/\s+-\s+\d+\s*(?:GB|TB)\b.*$/i, "")
    .replace(/\biPhone\b/i, "iPhone")
    .trim();
}

function deduplicateByUrl(listings: BotAdapterListing[]) {
  return [...new Map(listings.map((listing) => [listing.url, listing])).values()];
}
