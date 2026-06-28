import "server-only";

import { createHash } from "crypto";
import { load, type CheerioAPI } from "cheerio";
import {
  absoluteUrl,
  cleanText,
  extractMetaImages,
  normalizeCondition,
  normalizePrice,
  safeFetchHtml,
  sleep,
  validateImageUrls,
} from "@/lib/bots/html-utils";
import type { BotAdapterListing } from "@/lib/bots/types";

type CommerceAdapterConfig = {
  sourceName: string;
  sourceType: string;
  category: string;
  defaultCondition?: string;
  allowedHosts: string[];
  cardSelectors?: string[];
};

type JsonLdProduct = {
  "@type"?: string | string[];
  name?: string;
  description?: string;
  image?: unknown;
  url?: string;
  sku?: string;
  mpn?: string;
  brand?: string | { name?: string };
  color?: string;
  category?: string;
  offers?: {
    price?: string | number;
    lowPrice?: string | number;
    highPrice?: string | number;
    url?: string;
    seller?: { name?: string };
  };
  hasVariant?: JsonLdProduct[];
  itemListElement?: Array<JsonLdProduct | { item?: JsonLdProduct }>;
};

export async function fetchCommerceListings(
  categoryUrl: string,
  limit: number,
  config: CommerceAdapterConfig,
) {
  const response = await safeFetchHtml(categoryUrl, {
    timeoutMs: 15_000,
    retries: 2,
    retryDelayMs: 900,
  });
  await sleep(250);
  return parseCommerceHtml(
    response.html,
    response.finalUrl,
    Math.min(Math.max(limit, 1), 1000),
    config,
  );
}

export async function parseCommerceHtml(
  html: string,
  pageUrl: string,
  limit: number,
  config: CommerceAdapterConfig,
) {
  const $ = load(html);
  const candidates = [
    ...parseJsonLdProducts($, pageUrl, config),
    ...parseDomCards($, pageUrl, config),
  ];
  const unique = deduplicateByUrl(candidates).slice(0, limit);
  const validated: BotAdapterListing[] = [];

  for (const candidate of unique) {
    const rawImages = [
      ...new Set(
        candidate.image_urls.filter(Boolean).length
          ? candidate.image_urls.filter(Boolean)
          : candidate.image_url
            ? [candidate.image_url]
            : [],
      ),
    ];
    if (!rawImages.length) continue;

    let imageUrls = await validateImageUrls(rawImages, {
      delayMs: 80,
      maxImages: 8,
    });
    if (!imageUrls.length) {
      imageUrls = rawImages.slice(0, 8);
    }

    validated.push({
      ...candidate,
      image_url: imageUrls[0] ?? null,
      image_urls: imageUrls,
    });
  }

  return validated;
}

function parseJsonLdProducts(
  $: CheerioAPI,
  pageUrl: string,
  config: CommerceAdapterConfig,
) {
  const listings: BotAdapterListing[] = [];

  $("script[type='application/ld+json']").each((_, element) => {
    try {
      for (const object of collectJsonLdObjects(JSON.parse($(element).text()))) {
        for (const product of extractProducts(object as JsonLdProduct)) {
          const listing = toListing(product, pageUrl, config);
          if (listing) listings.push(listing);
        }
      }
    } catch {
      // Keep parsing other JSON-LD blocks and DOM cards.
    }
  });

  return listings;
}

function parseDomCards(
  $: CheerioAPI,
  pageUrl: string,
  config: CommerceAdapterConfig,
) {
  const listings: BotAdapterListing[] = [];
  const metaImages = extractMetaImages($, pageUrl);
  const selectors =
    config.cardSelectors ??
    [
      "[itemtype*='Product']",
      "[data-test-id*='product']",
      "[data-testid*='product']",
      ".product, .product-card, .product-item, .prd, .plp-product",
      "li:has(a[href]):has(img)",
    ];

  for (const selector of selectors) {
    $(selector).each((_, element) => {
      const card = $(element);
      const title = cleanText(
        card
          .find("[itemprop='name'], h2, h3, .title, .product-title, [class*='title']")
          .first()
          .text(),
      );
      const price = normalizePrice(
        card.find("[itemprop='price']").attr("content") ||
          card
            .find(
              "[class*='price'], [data-test-id*='price'], [data-testid*='price']",
            )
            .first()
            .text(),
      );
      const url = absoluteUrl(pageUrl, card.find("a[href]").first().attr("href"));
      const imageUrl = extractCheerioImageUrl($, card.find("img").first(), pageUrl);

      if (!title || !url || !isAllowedHost(url, config.allowedHosts)) return;
      if (!Number.isFinite(price)) return;

      const imageUrls = imageUrl ? [imageUrl, ...metaImages] : metaImages;
      listings.push(
        createListing({
          title,
          price,
          url,
          images: imageUrls,
          description: cleanText(card.text()).slice(0, 500) || null,
          config,
        }),
      );
    });
    if (listings.length) break;
  }

  return listings;
}

function toListing(
  product: JsonLdProduct,
  pageUrl: string,
  config: CommerceAdapterConfig,
) {
  const variant = product.hasVariant?.find((item) => {
    const url = absoluteUrl(pageUrl, item.url || item.offers?.url);
    const price = normalizePrice(item.offers?.price ?? item.offers?.lowPrice);
    return url && Number.isFinite(price);
  });
  const title = cleanText(product.name || variant?.name);
  const price = normalizePrice(
    product.offers?.price ??
      product.offers?.lowPrice ??
      variant?.offers?.price ??
      variant?.offers?.lowPrice,
  );
  const oldPrice = normalizePrice(product.offers?.highPrice);
  const url = absoluteUrl(
    pageUrl,
    product.url || product.offers?.url || variant?.url || variant?.offers?.url,
  );
  const images = normalizeImages(
    [product.image, variant?.image].filter(Boolean),
    pageUrl,
  );

  if (!title || !url || !isAllowedHost(url, config.allowedHosts)) return null;
  if (!Number.isFinite(price)) return null;

  return createListing({
    title,
    price,
    oldPrice: Number.isFinite(oldPrice) ? oldPrice : null,
    url,
    images,
    externalId: cleanText(product.sku || product.mpn),
    brand:
      typeof product.brand === "string"
        ? product.brand
        : cleanText(product.brand?.name),
    color: cleanText(product.color),
    sellerName: cleanText(product.offers?.seller?.name),
    description: cleanText(product.description),
    category: cleanText(product.category),
    config,
  });
}

function createListing({
  title,
  price,
  oldPrice = null,
  url,
  images,
  externalId,
  brand,
  color,
  sellerName,
  description,
  category,
  config,
}: {
  title: string;
  price: number;
  oldPrice?: number | null;
  url: string;
  images: string[];
  externalId?: string;
  brand?: string;
  color?: string;
  sellerName?: string;
  description?: string | null;
  category?: string;
  config: CommerceAdapterConfig;
}): BotAdapterListing {
  const specs = inferSpecs(title);
  const productName = deriveProductName(title, specs);

  return {
    external_id: externalId || createExternalId(url),
    product_name: productName,
    title,
    price,
    old_price: oldPrice,
    city: "Türkiye",
    source: config.sourceName,
    url,
    condition: normalizeCondition(config.defaultCondition ?? "Yenilenmiş"),
    description: description || null,
    image_url: images[0] ?? null,
    image_urls: images,
    brand: brand || specs.brand,
    model: specs.model,
    storage: specs.storage,
    ram: specs.ram,
    color: color || specs.color,
    warranty: specs.warranty,
    seller_name: sellerName || config.sourceName,
    source_type: config.sourceType,
    category: category || config.category || specs.category,
    status: "pending",
  };
}

function inferSpecs(title: string) {
  const storage = title.match(/\b(\d{2,4}\s?(?:GB|TB))\b/i)?.[1] ?? null;
  const ram =
    title.match(/\b(\d{1,3}\s?GB)\s*(?:RAM|Ram|ram)\b/)?.[1] ??
    title.match(/\b(\d{1,3})\/\d{2,4}\s?GB\b/)?.[1]?.concat("GB") ??
    null;
  const warranty =
    title.match(/\b(\d+\s?(?:ay|yıl)\s?garanti\w*)\b/i)?.[1] ?? null;
  const knownBrands = [
    "Apple",
    "iPhone",
    "Samsung",
    "Xiaomi",
    "Huawei",
    "Oppo",
    "Realme",
    "Lenovo",
    "Asus",
    "HP",
    "Dell",
    "MSI",
    "Sony",
    "PlayStation",
    "Nvidia",
    "RTX",
  ];
  const brand =
    knownBrands.find((item) =>
      title.toLocaleLowerCase("tr-TR").includes(item.toLocaleLowerCase("tr-TR")),
    ) ?? null;
  const color =
    title.match(/\b(siyah|beyaz|mavi|yeşil|kırmızı|mor|pembe|gri|gold|gümüş)\b/i)
      ?.[1] ?? null;
  const category = inferCategory(title);
  const model = cleanText(
    title
      .replace(/\b\d{1,4}\s?(?:GB|TB)\b/gi, "")
      .replace(/\b\d+\s?(?:ay|yıl)\s?garanti\w*\b/gi, "")
      .replace(/\b(RAM|ram)\b/g, ""),
  );

  return { brand, model, storage, ram, color, warranty, category };
}

function inferCategory(title: string) {
  const value = title.toLocaleLowerCase("tr-TR");
  if (value.includes("ipad") || value.includes("tablet")) return "tablet";
  if (value.includes("watch") || value.includes("saat")) return "akıllı saat";
  if (value.includes("macbook") || value.includes("laptop") || value.includes("notebook")) {
    return "bilgisayar";
  }
  if (value.includes("rtx") || value.includes("ekran kart")) return "ekran kartı";
  if (value.includes("playstation") || value.includes("ps5") || value.includes("xbox")) {
    return "oyun konsolu";
  }
  return "telefon";
}

function deriveProductName(
  title: string,
  specs: ReturnType<typeof inferSpecs>,
) {
  return cleanText(
    specs.model
      .replace(/^Yenilenmiş\s+/i, "")
      .replace(/\s+-\s+.*$/, "")
      .replace(/\s{2,}/g, " "),
  );
}

function normalizeImages(values: unknown[], pageUrl: string) {
  return [
    ...new Set(
      values
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
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

function extractCheerioImageUrl(
  $: CheerioAPI,
  image: ReturnType<CheerioAPI>,
  pageUrl: string,
) {
  const srcset = image.attr("srcset") || image.attr("data-srcset");
  const srcsetCandidate = srcset
    ?.split(",")
    .map((candidate) => candidate.trim().split(/\s+/)[0])
    .filter(Boolean)
    .at(-1);
  const value =
    image.attr("data-zoom-image") ||
    image.attr("data-large-image") ||
    image.attr("data-original") ||
    image.attr("data-src") ||
    image.attr("data-lazy-src") ||
    srcsetCandidate ||
    image.attr("src") ||
    image.attr("content");

  return absoluteUrl(pageUrl, value);
}

function extractProducts(value: JsonLdProduct): JsonLdProduct[] {
  const type = value["@type"];
  const types = Array.isArray(type) ? type : [type];
  const products: JsonLdProduct[] = [];

  if (types.some((item) => item === "Product" || item === "ProductGroup")) {
    products.push(value);
  }

  if (Array.isArray(value.itemListElement)) {
    for (const item of value.itemListElement) {
      const product = isItemWrapper(item) ? item.item : item;
      if (product) products.push(...extractProducts(product));
    }
  }

  return products;
}

function isItemWrapper(
  value: JsonLdProduct | { item?: JsonLdProduct },
): value is { item?: JsonLdProduct } {
  return "item" in value;
}

function collectJsonLdObjects(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(collectJsonLdObjects);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const graph = Array.isArray(record["@graph"])
    ? record["@graph"].flatMap(collectJsonLdObjects)
    : [];
  return [record, ...graph];
}

function isAllowedHost(value: string, hosts: string[]) {
  try {
    const url = new URL(value);
    return hosts.some(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
    );
  } catch {
    return false;
  }
}

function createExternalId(url: string) {
  return createHash("sha1").update(url.trim().toLowerCase()).digest("hex");
}

function deduplicateByUrl(listings: BotAdapterListing[]) {
  return [...new Map(listings.map((listing) => [listing.url, listing])).values()];
}
