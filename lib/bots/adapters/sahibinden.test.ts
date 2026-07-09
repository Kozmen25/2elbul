import { vi } from "vitest";
vi.mock("server-only", () => ({}));

import { describe, expect, it } from "vitest";
import {
  extractBrandModel,
  isCloudflareBlocked,
  parseRelativeDate,
  parseSahibindenCategoryHtml,
} from "./sahibinden";

function makeSampleHtml(
  overrides?: Partial<{
    items: string;
    cloudflare: boolean;
  }>,
): string {
  if (overrides?.cloudflare) {
    return `<!DOCTYPE html><html><head><title>Just a moment...</title></head><body>
    <script nonce="abc">window._cf_chl_opt = {cRay: "abc123"};</script>
    <noscript><span id="challenge-error-text">Enable JavaScript and cookies to continue</span></noscript>
    </body></html>`;
  }

  const items =
    overrides?.items ??
    `
    <tr data-id="12345" class="searchResultsItem">
      <td class="classifiedTitle">
        <a href="/ilan/12345/iphone-13-128-gb">iPhone 13 128 GB</a>
      </td>
      <td class="searchResultsPriceValue">25.000 TL</td>
      <td class="searchResultsLocation">İstanbul</td>
      <td class="searchResultsDate">Bugün</td>
      <td><img data-src="https://i.sahibinden.com/iphone13.jpg" alt="iphone 13" /></td>
    </tr>
    <tr data-id="67890" class="searchResultsItem">
      <td class="classifiedTitle">
        <a href="/ilan/67890/samsung-galaxy-s24">Samsung Galaxy S24 256 GB</a>
      </td>
      <td class="searchResultsPriceValue">30.000 TL</td>
      <td class="searchResultsLocation">Ankara</td>
      <td class="searchResultsDate">Dün</td>
      <td><img data-src="https://i.sahibinden.com/s24.jpg" alt="s24" /></td>
    </tr>
    <tr data-id="11111" class="searchResultsItem">
      <td class="classifiedTitle">
        <a href="/ilan/11111/xiaomi-redmi-note-13">Xiaomi Redmi Note 13 128 GB</a>
      </td>
      <td class="searchResultsPriceValue">15.000 TL</td>
      <td class="searchResultsLocation">İzmir</td>
      <td class="searchResultsDate">3 gün önce</td>
      <td><img data-src="https://i.sahibinden.com/redmi13.jpg" alt="redmi" /></td>
    </tr>
  `;

  return `<!DOCTYPE html>
<html><head><title>Cep Telefonu</title></head><body>
<div id="container">
  <table>
    <tbody>
      ${items}
    </tbody>
  </table>
</div>
</body></html>`;
}

describe("isCloudflareBlocked", () => {
  it("detects Cloudflare challenge page", () => {
    const html = makeSampleHtml({ cloudflare: true });
    expect(isCloudflareBlocked(html)).toBe(true);
  });

  it("returns false for normal page", () => {
    const html = makeSampleHtml();
    expect(isCloudflareBlocked(html)).toBe(false);
  });

  it("detects by cf_chl_opt marker alone", () => {
    const html = `<html><body><script>window.__cf_chl_opt={};</script></body></html>`;
    expect(isCloudflareBlocked(html)).toBe(true);
  });

  it("detects by challenge-platform path", () => {
    const html = `<html><body><script src="/cdn-cgi/challenge-platform/abc"></script></body></html>`;
    expect(isCloudflareBlocked(html)).toBe(true);
  });

  it("detects by Just a moment title", () => {
    const html = `<html><head><title>Just a moment...</title></head><body></body></html>`;
    expect(isCloudflareBlocked(html)).toBe(true);
  });
});

describe("parseSahibindenCategoryHtml", () => {
  it("parses listing items from HTML", () => {
    const html = makeSampleHtml();
    const listings = parseSahibindenCategoryHtml(html, "https://www.sahibinden.com/cep-telefonu", 10);

    expect(listings).toHaveLength(3);
    expect(listings[0]).toMatchObject({
      title: "iPhone 13 128 GB",
      price: 25000,
      city: "İstanbul",
      source: "Sahibinden",
      brand: "iPhone",
      model: "13 128 GB",
    });
    expect(listings[1]).toMatchObject({
      title: "Samsung Galaxy S24 256 GB",
      price: 30000,
      city: "Ankara",
      brand: "Samsung",
      model: "Galaxy S24 256 GB",
    });
    expect(listings[2]).toMatchObject({
      title: "Xiaomi Redmi Note 13 128 GB",
      price: 15000,
      city: "İzmir",
      brand: "Xiaomi",
      model: "Redmi Note 13 128 GB",
    });
  });

  it("respects the limit parameter", () => {
    const html = makeSampleHtml();
    const listings = parseSahibindenCategoryHtml(html, "https://www.sahibinden.com/cep-telefonu", 2);
    expect(listings).toHaveLength(2);
  });

  it("skips items without valid price", () => {
    const html = makeSampleHtml({
      items: `
      <tr data-id="12345" class="searchResultsItem">
        <td class="classifiedTitle"><a href="/ilan/12345/iphone-13">iPhone 13</a></td>
        <td class="searchResultsPriceValue">Belirtilmemiş</td>
        <td class="searchResultsLocation">İstanbul</td>
        <td class="searchResultsDate">Bugün</td>
        <td><img data-src="https://i.sahibinden.com/iphone13.jpg" /></td>
      </tr>`,
    });
    const listings = parseSahibindenCategoryHtml(html, "https://www.sahibinden.com/cep-telefonu", 10);
    expect(listings).toHaveLength(0);
  });

  it("skips items without title or url", () => {
    const html = makeSampleHtml({
      items: `
      <tr data-id="12345" class="searchResultsItem">
        <td class="classifiedTitle"></td>
        <td class="searchResultsPriceValue">25.000 TL</td>
        <td class="searchResultsLocation">İstanbul</td>
        <td class="searchResultsDate">Bugün</td>
        <td><img data-src="https://i.sahibinden.com/iphone13.jpg" /></td>
      </tr>`,
    });
    const listings = parseSahibindenCategoryHtml(html, "https://www.sahibinden.com/cep-telefonu", 10);
    expect(listings).toHaveLength(0);
  });

  it("deduplicates by url", () => {
    const html = makeSampleHtml({
      items: `
      <tr data-id="12345" class="searchResultsItem">
        <td class="classifiedTitle"><a href="/ilan/12345/iphone-13">iPhone 13</a></td>
        <td class="searchResultsPriceValue">25.000 TL</td>
        <td class="searchResultsLocation">İstanbul</td>
        <td class="searchResultsDate">Bugün</td>
        <td><img data-src="https://i.sahibinden.com/iphone13.jpg" /></td>
      </tr>
      <tr data-id="12345" class="searchResultsItem">
        <td class="classifiedTitle"><a href="/ilan/12345/iphone-13">iPhone 13</a></td>
        <td class="searchResultsPriceValue">25.000 TL</td>
        <td class="searchResultsLocation">İstanbul</td>
        <td class="searchResultsDate">Bugün</td>
        <td><img data-src="https://i.sahibinden.com/iphone13.jpg" /></td>
      </tr>`,
    });
    const listings = parseSahibindenCategoryHtml(html, "https://www.sahibinden.com/cep-telefonu", 10);
    expect(listings).toHaveLength(1);
  });

  it("handles empty HTML gracefully", () => {
    const listings = parseSahibindenCategoryHtml("", "https://www.sahibinden.com/cep-telefonu", 10);
    expect(listings).toHaveLength(0);
  });
});

describe("extractBrandModel", () => {
  it("extracts iPhone with model", () => {
    expect(extractBrandModel("iPhone 15 Pro Max 256 GB")).toEqual({
      brand: "iPhone",
      model: "15 Pro Max 256 GB",
    });
  });

  it("extracts Samsung with model", () => {
    expect(extractBrandModel("Samsung Galaxy S24 Ultra 512 GB")).toEqual({
      brand: "Samsung",
      model: "Galaxy S24 Ultra 512 GB",
    });
  });

  it("extracts Xiaomi with model", () => {
    expect(extractBrandModel("Xiaomi Redmi Note 13 Pro 256 GB")).toEqual({
      brand: "Xiaomi",
      model: "Redmi Note 13 Pro 256 GB",
    });
  });

  it("extracts Huawei with model", () => {
    expect(extractBrandModel("Huawei P60 Pro")).toEqual({
      brand: "Huawei",
      model: "P60 Pro",
    });
  });

  it("returns empty for unknown brand", () => {
    expect(extractBrandModel("Genel Telefon Modeli")).toEqual({});
  });

  it("extracts Oppo with model", () => {
    expect(extractBrandModel("Oppo Find X5 Pro")).toEqual({
      brand: "Oppo",
      model: "Find X5 Pro",
    });
  });

  it("extracts Google Pixel", () => {
    expect(extractBrandModel("Google Pixel 8 Pro 128 GB")).toEqual({
      brand: "Google",
      model: "Pixel 8 Pro 128 GB",
    });
  });

  it("extracts OnePlus", () => {
    expect(extractBrandModel("OnePlus 12 256 GB")).toEqual({
      brand: "OnePlus",
      model: "12 256 GB",
    });
  });

  it("extracts iPhone with Apple prefix", () => {
    expect(extractBrandModel("Apple iPhone 14 128 GB")).toEqual({
      brand: "iPhone",
      model: "14 128 GB",
    });
  });
});

describe("parseRelativeDate", () => {
  it('parses "Bugün"', () => {
    const result = parseRelativeDate("Bugün");
    expect(result).toBeDefined();
    const d = new Date(result!);
    const today = new Date();
    expect(d.getFullYear()).toBe(today.getFullYear());
    expect(d.getMonth()).toBe(today.getMonth());
    expect(d.getDate()).toBe(today.getDate());
  });

  it('parses "Dün"', () => {
    const result = parseRelativeDate("Dün");
    expect(result).toBeDefined();
    const d = new Date(result!);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(d.getFullYear()).toBe(yesterday.getFullYear());
    expect(d.getMonth()).toBe(yesterday.getMonth());
    expect(d.getDate()).toBe(yesterday.getDate());
  });

  it('parses "3 gün önce"', () => {
    const result = parseRelativeDate("3 gün önce");
    expect(result).toBeDefined();
    const d = new Date(result!);
    const expected = new Date();
    expected.setDate(expected.getDate() - 3);
    expect(d.getFullYear()).toBe(expected.getFullYear());
    expect(d.getMonth()).toBe(expected.getMonth());
    expect(d.getDate()).toBe(expected.getDate());
  });

  it('parses "1 hafta önce"', () => {
    const result = parseRelativeDate("1 hafta önce");
    expect(result).toBeDefined();
    const d = new Date(result!);
    const expected = new Date();
    expected.setDate(expected.getDate() - 7);
    expect(d.getFullYear()).toBe(expected.getFullYear());
    expect(d.getMonth()).toBe(expected.getMonth());
    expect(d.getDate()).toBe(expected.getDate());
  });

  it('parses "2 ay önce"', () => {
    const result = parseRelativeDate("2 ay önce");
    expect(result).toBeDefined();
    const d = new Date(result!);
    const expected = new Date();
    expected.setMonth(expected.getMonth() - 2);
    expect(d.getFullYear()).toBe(expected.getFullYear());
    expect(d.getMonth()).toBe(expected.getMonth());
  });

  it("parses DD.MM.YYYY format", () => {
    const result = parseRelativeDate("15.03.2026");
    expect(result).toBeDefined();
    const d = new Date(result!);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2); // March is 0-indexed
    expect(d.getDate()).toBe(15);
  });

  it("returns undefined for empty input", () => {
    expect(parseRelativeDate("")).toBeUndefined();
  });

  it("handles lowercase input", () => {
    const result = parseRelativeDate("bugün");
    expect(result).toBeDefined();
  });
});
