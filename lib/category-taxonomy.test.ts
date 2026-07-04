import { describe, expect, it } from "vitest";
import {
  expandQueryByTaxonomy,
  findCategoryMatches,
  getCategoryBreadcrumbs,
  getExpandedSearchTerms,
  getSearchIntentLabel,
  isBroadCategoryQuery,
  normalizeCategoryText,
} from "./category-taxonomy";

describe("category taxonomy engine", () => {
  it("normalizes Turkish category text", () => {
    expect(normalizeCategoryText("Beyaz Eşya")).toBe("beyaz esya");
    expect(normalizeCategoryText("İş Makinesi")).toBe("is makinesi");
  });

  it("expands phone category but keeps iphone focused", () => {
    expect(getExpandedSearchTerms("telefon")).toEqual(
      expect.arrayContaining(["iphone", "samsung", "xiaomi"]),
    );

    const iphoneTerms = getExpandedSearchTerms("iphone");
    expect(iphoneTerms).toEqual(expect.arrayContaining(["iphone", "telefon"]));
    expect(iphoneTerms).not.toContain("samsung");
    expect(iphoneTerms).not.toContain("xiaomi");
  });

  it("expands computer and computer part intents", () => {
    expect(getExpandedSearchTerms("bilgisayar")).toEqual(
      expect.arrayContaining(["laptop", "macbook", "pc"]),
    );
    expect(getExpandedSearchTerms("ekran kartı")).toEqual(
      expect.arrayContaining(["rtx", "gtx", "rx"]),
    );
  });

  it("expands white goods and tv intents", () => {
    expect(getExpandedSearchTerms("beyaz eşya")).toEqual(
      expect.arrayContaining([
        "buzdolabi",
        "camasir makinesi",
        "bulasik makinesi",
      ]),
    );
    expect(getExpandedSearchTerms("tv")).toEqual(
      expect.arrayContaining(["televizyon", "smart tv", "oled", "qled"]),
    );
  });

  it("expands vehicle and real estate intents", () => {
    expect(getExpandedSearchTerms("araba")).toEqual(
      expect.arrayContaining(["otomobil", "arac", "oto"]),
    );
    expect(getExpandedSearchTerms("motosiklet")).toEqual(
      expect.arrayContaining(["motor", "scooter"]),
    );
    expect(getExpandedSearchTerms("emlak")).toEqual(
      expect.arrayContaining(["konut", "arsa", "isyeri"]),
    );
    expect(getExpandedSearchTerms("kiralık ev")).toEqual(
      expect.arrayContaining(["kiralik konut"]),
    );
  });

  it("expands industrial, baby, animal and console intents safely", () => {
    expect(getExpandedSearchTerms("iş makinesi")).toEqual(
      expect.arrayContaining(["forklift", "jenerator", "kompresor"]),
    );
    expect(getExpandedSearchTerms("bebek")).toEqual(
      expect.arrayContaining(["bebek arabasi", "anne bebek"]),
    );
    expect(getExpandedSearchTerms("hayvan")).toEqual(
      expect.arrayContaining(["kedi", "kopek", "kus"]),
    );

    const ps5Terms = getExpandedSearchTerms("ps5");
    expect(ps5Terms).toEqual(expect.arrayContaining(["playstation", "konsol"]));
    expect(ps5Terms).not.toContain("xbox");
  });

  it("returns breadcrumbs, labels and broad query flags", () => {
    const match = findCategoryMatches("kiralık ev")[0];

    expect(match?.category.id).toBe("real-estate.rental-home");
    expect(getCategoryBreadcrumbs("real-estate.rental-home")).toEqual([
      "Emlak",
      "Kiralık Konut",
    ]);
    expect(getSearchIntentLabel("emlak")).toBe(
      "Emlak kategorisindeki ilgili ilanlar gösteriliyor.",
    );
    expect(isBroadCategoryQuery("emlak")).toBe(true);
    expect(isBroadCategoryQuery("iphone")).toBe(false);
  });

  it("returns a structured expansion object", () => {
    const expanded = expandQueryByTaxonomy("oyuncu bilgisayarı");

    expect(expanded.label).toBe(
      "Bilgisayar kategorisindeki ilgili ürünler gösteriliyor.",
    );
    expect(expanded.terms).toEqual(expect.arrayContaining(["gaming pc", "laptop"]));
  });
});
