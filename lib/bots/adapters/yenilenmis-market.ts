import "server-only";

import { fetchCommerceListings } from "@/lib/bots/adapters/commerce";

export const YENILENMIS_MARKET_CATEGORY_URL =
  "https://www.yenilenmismarket.com/";

export function fetchYenilenmisMarketListings(
  categoryUrl = YENILENMIS_MARKET_CATEGORY_URL,
  limit = 10,
) {
  return fetchCommerceListings(categoryUrl, limit, {
    sourceName: "Yenilenmiş Market",
    sourceType: "refurbished_marketplace",
    category: "yenilenmiş cihaz",
    defaultCondition: "Yenilenmiş",
    allowedHosts: ["yenilenmismarket.com", "www.yenilenmismarket.com"],
  });
}
