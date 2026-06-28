import "server-only";

import { fetchCommerceListings } from "@/lib/bots/adapters/commerce";

export const TEKNOSA_RENEWED_CATEGORY_URL =
  "https://www.teknosa.com/arama/?s=yenilenmi%C5%9F";

export function fetchTeknosaRenewedListings(
  categoryUrl = TEKNOSA_RENEWED_CATEGORY_URL,
  limit = 10,
) {
  return fetchCommerceListings(categoryUrl, limit, {
    sourceName: "Teknosa Yenilenmiş",
    sourceType: "refurbished_retailer",
    category: "yenilenmiş cihaz",
    defaultCondition: "Yenilenmiş",
    allowedHosts: ["teknosa.com", "www.teknosa.com"],
  });
}
