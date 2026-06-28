import "server-only";

import { fetchCommerceListings } from "@/lib/bots/adapters/commerce";

export const HEPSIBURADA_RENEWED_CATEGORY_URL =
  "https://www.hepsiburada.com/ara?q=yenilenmi%C5%9F";

export function fetchHepsiburadaRenewedListings(
  categoryUrl = HEPSIBURADA_RENEWED_CATEGORY_URL,
  limit = 10,
) {
  return fetchCommerceListings(categoryUrl, limit, {
    sourceName: "Hepsiburada Yenilenmiş",
    sourceType: "refurbished_marketplace",
    category: "yenilenmiş cihaz",
    defaultCondition: "Yenilenmiş",
    allowedHosts: ["hepsiburada.com", "www.hepsiburada.com"],
  });
}
