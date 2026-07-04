import { describe, expect, it } from "vitest";
import {
  resolveSearchIntent,
  scoreSearchResult,
  SEARCH_CATEGORY_TREE,
} from "./search-intent";

function termsFor(query: string) {
  return resolveSearchIntent(query).terms.map((term) => term.term);
}

describe("search intent category tree", () => {
  it("contains Sahibinden-like top level categories", () => {
    const names = SEARCH_CATEGORY_TREE.map((category) => category.name);

    expect(names).toEqual(
      expect.arrayContaining([
        "Vasıta",
        "Emlak",
        "İkinci El ve Sıfır Alışveriş",
        "Yedek Parça",
        "İş Makineleri",
        "Ustalar ve Hizmetler",
        "Özel Ders",
        "İş İlanları",
        "Yardımcı Arayanlar",
        "Hayvanlar Alemi",
      ]),
    );
  });

  it("expands phone searches into common brands", () => {
    const terms = termsFor("telefon");

    expect(terms).toEqual(expect.arrayContaining(["iphone", "samsung", "xiaomi"]));
  });

  it("expands computer searches into laptop and notebook terms", () => {
    const terms = termsFor("bilgisayar");

    expect(terms).toEqual(expect.arrayContaining(["laptop", "macbook", "notebook"]));
  });

  it("expands game console searches", () => {
    const terms = termsFor("oyun konsolu");

    expect(terms).toEqual(
      expect.arrayContaining(["ps5", "xbox", "playstation"]),
    );
  });

  it("expands white goods searches", () => {
    const terms = termsFor("beyaz eşya");

    expect(terms).toEqual(
      expect.arrayContaining(["buzdolabi", "camasir makinesi"]),
    );
  });

  it("expands tv searches", () => {
    const terms = termsFor("tv");

    expect(terms).toEqual(
      expect.arrayContaining(["televizyon", "smart tv", "oled"]),
    );
  });

  it("expands vehicle and real estate top categories", () => {
    expect(termsFor("vasıta")).toEqual(
      expect.arrayContaining(["araba", "motosiklet"]),
    );
    expect(termsFor("emlak")).toEqual(
      expect.arrayContaining(["konut", "arsa", "isyeri"]),
    );
  });

  it("keeps specific iphone search focused", () => {
    const intent = resolveSearchIntent("iphone");
    const terms = intent.terms.map((term) => term.term);

    expect(terms[0]).toBe("iphone");
    expect(terms).not.toContain("samsung");
    expect(terms).not.toContain("xiaomi");
  });

  it("scores relevant broad category results higher", () => {
    const intent = resolveSearchIntent("telefon");
    const iphoneScore = scoreSearchResult(intent, {
      title: "iPhone 13 128 GB temiz",
      productName: "iPhone 13",
    });
    const tableScore = scoreSearchResult(intent, {
      title: "Ahşap yemek masası",
      productName: "Mobilya",
    });

    expect(iphoneScore).toBeGreaterThan(tableScore);
  });
});
