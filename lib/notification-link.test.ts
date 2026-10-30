import { describe, expect, it } from "vitest";
import { getNotificationLink } from "@/lib/notification-link";

describe("getNotificationLink", () => {
  it("prefers the product slug", () => {
    expect(
      getNotificationLink({ type: "price_drop", metadata: { product_slug: "iphone-13", product_id: 7 } }, "/x"),
    ).toBe("/product/iphone-13");
  });

  it("falls back to the product id for older notifications", () => {
    expect(getNotificationLink({ type: "price_alert", metadata: { product_id: 7 } }, "/x")).toBe("/product/7");
  });

  it("opens the search for saved-search notifications", () => {
    expect(getNotificationLink({ type: "new_listing", metadata: { query: "iphone 13" } }, "/x")).toBe(
      "/search?q=iphone%2013",
    );
  });

  it("uses the fallback when nothing is known, including listing-only notifications", () => {
    expect(getNotificationLink({ type: "price_alert", metadata: { listing_id: 3 } }, "/bildirimler")).toBe("/bildirimler");
    expect(getNotificationLink({ type: "system", metadata: null }, "#")).toBe("#");
  });
});
