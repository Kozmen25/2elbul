import { describe, expect, it } from "vitest";
import { classifyFetchedPage, type FetchedPage } from "./classify";

const URL_ = "https://www.easycep.com/urun/iphone-13-128gb-123";

function page(overrides: Partial<FetchedPage>): FetchedPage {
  return { requestedUrl: URL_, status: 200, finalUrl: URL_, body: "<title>iPhone 13</title>", ...overrides };
}

describe("classifyFetchedPage", () => {
  it("treats 404 and 410 as removed", () => {
    expect(classifyFetchedPage(page({ status: 404 })).outcome).toBe("removed");
    expect(classifyFetchedPage(page({ status: 410 })).outcome).toBe("removed");
  });

  it("never treats blocks, errors or failed requests as gone", () => {
    for (const status of [401, 403, 429, 500, 503]) {
      expect(classifyFetchedPage(page({ status })).outcome).toBe("unknown");
    }
    expect(classifyFetchedPage(page({ status: null })).outcome).toBe("unknown");
    expect(classifyFetchedPage(page({ body: "<title>Just a moment...</title>" })).outcome).toBe("unknown");
  });

  it("detects a deep link that ended on the home page", () => {
    const result = classifyFetchedPage(page({ finalUrl: "https://easycep.com/" }));
    expect(result).toEqual({ outcome: "removed", detail: "redirected_home" });
  });

  it("detects soft 404 titles and removal notices", () => {
    expect(classifyFetchedPage(page({ body: "<title>Sayfa Bulunamadı</title>" })).outcome).toBe("removed");
    expect(
      classifyFetchedPage(page({ body: "<title>İlan</title><p>Bu ilan yayından kaldırılmıştır.</p>" })).outcome,
    ).toBe("removed");
  });

  it("does not mistake model names or seller text for a dead page", () => {
    expect(classifyFetchedPage(page({ body: "<title>Peugeot 404 1975</title>" })).outcome).toBe("available");
    expect(classifyFetchedPage(page({ body: "<title>Robot süpürge</title>" })).outcome).toBe("available");
    expect(
      classifyFetchedPage(page({ body: "<title>iPhone</title><p>İlan satıldı mı diye sormayın, yayında.</p>" })).outcome,
    ).toBe("available");
  });

  it("reads sold out from structured data only when every offer is out of stock", () => {
    const soldOut = '<script type="application/ld+json">{"offers":{"availability":"https://schema.org/OutOfStock"}}</script>';
    expect(classifyFetchedPage(page({ body: soldOut })).outcome).toBe("sold_out");
    const mixed = `${soldOut}<script>{"availability":"InStock"}</script>`;
    expect(classifyFetchedPage(page({ body: mixed })).outcome).toBe("available");
  });
});
