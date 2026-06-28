import "server-only";

import { fetchCommerceListings } from "@/lib/bots/adapters/commerce";

export const MEDIAMARKT_RENEWED_CATEGORY_URL =
  "https://www.mediamarkt.com.tr/tr/search.html?query=yenilenmi%C5%9F";

export function fetchMediaMarktRenewedListings(
  categoryUrl = MEDIAMARKT_RENEWED_CATEGORY_URL,
  limit = 10,
) {
  return fetchCommerceListings(categoryUrl, limit, {
    sourceName: "MediaMarkt Yenilenmiş",
    sourceType: "refurbished_retailer",
    category: "yenilenmiş cihaz",
    defaultCondition: "Yenilenmiş",
    allowedHosts: ["mediamarkt.com.tr", "www.mediamarkt.com.tr"],
  });
}
