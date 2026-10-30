import { describe, expect, it } from "vitest";
import { TR_CITIES, foldTurkish, isTrCity, searchCities } from "./cities";
import { DRAFT_STORAGE_KEY, isEmptyDraft, parseDraft, serializeDraft } from "./draft";
import { MAX_LISTING_PRICE, formatTlInput, parseTlPrice } from "./price";
import { rankProducts, tokenizeTitle } from "./product-match";
import { detectSourceFromHost, normalizeListingUrl, urlMatchesSource } from "./url";
import { cleanTitle, listingWarnings, validateListingSubmission, validateStep, type ListingSubmissionInput } from "./validation";

const valid: ListingSubmissionInput = {
  productId: "3",
  title: "Kutulu iPhone 13 128 GB",
  price: "25.000",
  city: "İstanbul",
  source: "Sahibinden",
  condition: "İkinci El",
  url: "https://www.sahibinden.com/ilan/iphone-13-123?utm_source=x#foto",
};

describe("cities", () => {
  it("has the 81 provinces without duplicates", () => {
    expect(TR_CITIES).toHaveLength(81);
    expect(new Set(TR_CITIES).size).toBe(81);
  });

  it("only accepts real provinces", () => {
    expect(isTrCity("İstanbul")).toBe(true);
    expect(isTrCity("Istanbul")).toBe(false);
    expect(isTrCity("Gotham")).toBe(false);
  });

  it("searches ignoring Turkish letters and case, prefix matches first", () => {
    expect(foldTurkish("İSTANBUL")).toBe("istanbul");
    expect(searchCities("istan")[0]).toBe("İstanbul");
    expect(searchCities("IZMIR")).toEqual(["İzmir"]);
    expect(searchCities("ağ")[0]).toBe("Ağrı");
    expect(searchCities("an")[0]).toBe("Ankara");
    expect(searchCities("zzz")).toEqual([]);
    expect(searchCities("")).toHaveLength(81);
  });
});

describe("parseTlPrice", () => {
  it("reads Turkish and plain formats", () => {
    const cases: [string, number][] = [
      ["25000", 25000], ["25.000", 25000], ["25.000,50", 25000.5], ["1.234.567", 1234567], ["25,5", 25.5],
      ["25.5", 25.5], ["₺25.000", 25000], ["25.000 TL", 25000], [" 25 000 ", 25000], ["0,99", 0.99],
    ];
    for (const [input, expected] of cases) expect(parseTlPrice(input), input).toBe(expected);
  });

  it("rejects junk, zero, negatives, malformed separators and absurd values", () => {
    for (const input of ["", "abc", "0", "0,00", "-5", "1.2.3", "25,000,5", "25,555", "12a", String(MAX_LISTING_PRICE + 1)]) {
      expect(parseTlPrice(input), input).toBeNull();
    }
    expect(parseTlPrice(String(MAX_LISTING_PRICE))).toBe(MAX_LISTING_PRICE);
  });
});

describe("formatTlInput", () => {
  it("groups thousands while typing and keeps a decimal comma", () => {
    expect(formatTlInput("25000")).toBe("25.000");
    expect(formatTlInput("1234567")).toBe("1.234.567");
    expect(formatTlInput("1234,5")).toBe("1.234,5");
    expect(formatTlInput("1234,567")).toBe("1.234,56");
    expect(formatTlInput(",5")).toBe("0,5");
    expect(formatTlInput("a1b2")).toBe("12");
    expect(formatTlInput("007")).toBe("7");
    expect(formatTlInput("")).toBe("");
  });

  it("round-trips through parseTlPrice", () => {
    expect(parseTlPrice(formatTlInput("1234567"))).toBe(1234567);
  });
});

describe("normalizeListingUrl", () => {
  it("strips tracking parameters and the fragment, keeps real ones", () => {
    const result = normalizeListingUrl("https://WWW.Sahibinden.com/ilan/x-1?id=5&utm_source=a&fbclid=b#foto");
    expect(result).toEqual({ ok: true, url: "https://www.sahibinden.com/ilan/x-1?id=5", host: "www.sahibinden.com" });
  });

  it("rejects non-web, credentialed, local and address-only links", () => {
    for (const value of ["", "sahibinden.com/ilan", "ftp://x.com/a", "javascript:alert(1)", "https://user:pw@x.com/a", "http://localhost:3000/a", "http://127.0.0.1/a", "http://[::1]/a", "https://intranet/a", "https://printer.local/a"]) {
      expect(normalizeListingUrl(value).ok, value).toBe(false);
    }
  });
});

describe("source matching", () => {
  it("matches a link to its marketplace, subdomains included", () => {
    expect(urlMatchesSource("www.sahibinden.com", "Sahibinden")).toBe(true);
    expect(urlMatchesSource("m.sahibinden.com", "Sahibinden")).toBe(true);
    expect(urlMatchesSource("notsahibinden.com", "Sahibinden")).toBe(false);
    expect(urlMatchesSource("www.letgo.com", "Sahibinden")).toBe(false);
  });

  it("detects the marketplace from a link", () => {
    expect(detectSourceFromHost("www.hepsiburada.com")).toBe("Hepsiburada Yenilenmiş");
    expect(detectSourceFromHost("www.facebook.com")).toBe("Facebook Marketplace");
    expect(detectSourceFromHost("example.org")).toBeNull();
  });
});

describe("validation", () => {
  it("accepts a complete submission and normalises it", () => {
    const result = validateListingSubmission(valid);
    expect(result.ok && result.value).toEqual({
      productId: 3, title: "Kutulu iPhone 13 128 GB", price: 25000, city: "İstanbul", source: "Sahibinden", condition: "İkinci El",
      url: "https://www.sahibinden.com/ilan/iphone-13-123",
    });
    expect(result.ok && result.warnings).toEqual({});
  });

  it("reports every problem at once", () => {
    const result = validateListingSubmission({ productId: "", title: "kısa", price: "abc", city: "Gotham", source: "x", condition: "y", url: "nope" });
    expect(!result.ok && Object.keys(result.errors).sort()).toEqual(["city", "condition", "price", "productId", "source", "title", "url"]);
  });

  it("validates one wizard step at a time", () => {
    expect(Object.keys(validateStep(0, { ...valid, productId: "" }))).toEqual(["productId"]);
    expect(validateStep(0, { ...valid, title: "" })).toEqual({});
    expect(Object.keys(validateStep(1, { ...valid, title: "", price: "0" })).sort()).toEqual(["price", "title"]);
  });

  it("collapses whitespace in titles and rejects a pasted link as title", () => {
    expect(cleanTitle("  iPhone   13 \n 128 GB ")).toBe("iPhone 13 128 GB");
    expect(validateStep(1, { ...valid, title: "https://www.sahibinden.com/ilan/1" }).title).toContain("bağlantı değil");
    expect(validateStep(1, { ...valid, title: "x".repeat(161) }).title).toContain("160");
  });

  it("warns, without blocking, when the link does not match the chosen site", () => {
    const mismatch = { ...valid, source: "Letgo" };
    expect(listingWarnings(mismatch).url).toContain("Letgo");
    expect(validateListingSubmission(mismatch).ok).toBe(true);
    expect(listingWarnings(valid)).toEqual({});
  });
});

describe("product matching", () => {
  const products = [
    { id: "1", name: "iPhone 13", category: "Telefon" },
    { id: "2", name: "iPhone 13 Pro", category: "Telefon" },
    { id: "3", name: "Samsung Galaxy S23", category: "Telefon" },
    { id: "4", name: "PlayStation 5", category: "Oyun Konsolu" },
  ];

  it("tokenizes titles ignoring case, Turkish letters and punctuation", () => {
    expect(tokenizeTitle("Kutulu iPhone-13, 128GB!")).toEqual(["kutulu", "iphone", "13", "128gb"]);
  });

  it("ranks the most specific full match first", () => {
    expect(rankProducts("Kutulu iPhone 13 128 GB", products).map((p) => p.id)).toEqual(["1", "2"]);
    expect(rankProducts("iPhone 13 Pro 256", products)[0].id).toBe("2");
  });

  it("returns nothing when no word matches or the title is empty", () => {
    expect(rankProducts("Buzdolabı", products)).toEqual([]);
    expect(rankProducts("", products)).toEqual([]);
  });
});

describe("draft", () => {
  it("round-trips a draft", () => {
    const raw = serializeDraft(valid, "iPhone 13", 1000);
    expect(parseDraft(raw, 2000)).toEqual({ input: valid, productName: "iPhone 13", savedAt: 1000 });
  });

  it("ignores missing, broken, empty and week-old drafts", () => {
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft("{not json")).toBeNull();
    expect(parseDraft(JSON.stringify({ input: valid }))).toBeNull();
    expect(parseDraft(serializeDraft({ ...valid, productId: "", title: "", price: "", city: "", source: "", condition: "", url: "" }, "", 1000), 2000)).toBeNull();
    expect(parseDraft(serializeDraft(valid, "x", 0), 8 * 24 * 60 * 60 * 1000)).toBeNull();
  });

  it("keeps only known string fields", () => {
    const parsed = parseDraft(JSON.stringify({ input: { ...valid, price: 5, evil: "x" }, productName: 7, savedAt: 1000 }), 2000);
    expect(parsed?.input.price).toBe("");
    expect(parsed?.input).not.toHaveProperty("evil");
    expect(parsed?.productName).toBe("");
  });

  it("knows an empty draft and has a stable storage key", () => {
    expect(isEmptyDraft({ ...valid, productId: "", title: " ", price: "", city: "", source: "", condition: "", url: "" })).toBe(true);
    expect(DRAFT_STORAGE_KEY).toBe("listingDraft:v1");
  });
});
