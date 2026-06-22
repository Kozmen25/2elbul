import "server-only";

import {
  absoluteUrl,
  elementAttribute,
  elementText,
  extractImageUrls,
  normalizeCondition,
  normalizePrice,
  type HtmlRootLike,
} from "@/lib/bots/html-utils";
import type { BotAdapterListing } from "@/lib/bots/types";

export function parseGetmobilProductPage(
  root: HtmlRootLike,
  pageUrl: string,
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
  };
}
