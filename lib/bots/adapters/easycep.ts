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
  };
}
