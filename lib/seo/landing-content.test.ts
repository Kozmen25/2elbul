import { describe, expect, it } from "vitest";
import {
  buildFaqPageJsonLd,
  buildLandingDescription,
  buildLandingFaqItems,
  buildLandingHeading,
  buildLandingIntro,
  buildLandingTitle,
  buildPriceListDescription,
  buildPriceListTitle,
  formatSeoPeriod,
  isIndexableSnapshot,
  snapshotFromListings,
  type LandingPriceSnapshot,
} from "./landing-content";

const NOW = new Date("2026-10-03T12:00:00.000Z");

const priced: LandingPriceSnapshot = {
  listingCount: 37,
  sourceCount: 3,
  minPrice: 28500,
  maxPrice: 41000,
  averagePrice: 31200,
};

const empty: LandingPriceSnapshot = {
  listingCount: 0,
  sourceCount: 0,
  minPrice: null,
  maxPrice: null,
  averagePrice: null,
};

describe("formatSeoPeriod", () => {
  it("renders a capitalized Turkish month and year", () => {
    expect(formatSeoPeriod(NOW)).toBe("Ekim 2026");
  });

  it("uses Istanbul time at month boundaries", () => {
    // 22:30 UTC on 31 October is already 1 November in Istanbul (UTC+3).
    expect(formatSeoPeriod(new Date("2026-10-31T22:30:00.000Z"))).toBe("Kasım 2026");
  });
});

describe("buildLandingTitle", () => {
  it("puts the search phrase first for each page type", () => {
    expect(buildLandingTitle("product", "iPhone 15", NOW)).toBe(
      "iPhone 15 İkinci El Fiyatları (Ekim 2026) | 2ElBul",
    );
    expect(buildLandingTitle("category", "Telefon", NOW)).toBe(
      "İkinci El Telefon Fiyatları ve İlanları (Ekim 2026) | 2ElBul",
    );
    expect(buildLandingTitle("brand", "Apple", NOW)).toBe("İkinci El Apple Fiyatları (Ekim 2026) | 2ElBul");
    expect(buildLandingTitle("city", "İzmir", NOW)).toBe(
      "İzmir İkinci El İlanları ve Fiyatları (Ekim 2026) | 2ElBul",
    );
  });
});

describe("buildLandingDescription", () => {
  it("quotes the live price range, average and listing count", () => {
    const description = buildLandingDescription("product", "iPhone 15", priced);
    expect(description).toMatch(/^iPhone 15 ikinci el fiyatları ₺28\.500 ile ₺41\.000 arasında, ortalama ₺31\.200\./);
    expect(description).toContain("3 platformdan 37 ilan");
  });

  it("explains an empty page instead of inventing numbers", () => {
    const description = buildLandingDescription("brand", "MSI", empty);
    expect(description).toContain("şu an yayında ilan yok");
    expect(description).not.toContain("₺");
  });
});

describe("buildLandingIntro", () => {
  it("states the period and the number of listings behind the range", () => {
    const intro = buildLandingIntro("product", "iPhone 15", priced, NOW);
    expect(intro).toContain("Ekim 2026 itibarıyla iPhone 15 ikinci el fiyatları");
    expect(intro).toContain("37 güncel ilana");
  });
});

describe("buildLandingFaqItems", () => {
  it("asks the questions people search for and answers with live numbers", () => {
    const items = buildLandingFaqItems("product", "iPhone 15", priced);
    expect(items.map((item) => item.question)).toEqual([
      "iPhone 15 ikinci el fiyatları ne kadar?",
      "En ucuz ikinci el iPhone 15 kaç TL?",
      "Fiyatlar hangi platformlardan toplanıyor?",
      "Fiyatlar ne sıklıkla güncelleniyor?",
    ]);
    expect(items[1].answer).toContain("₺28.500");
    expect(items[2].answer).toContain("3 farklı platform");
  });

  it("does not quote prices when there are no listings", () => {
    const items = buildLandingFaqItems("category", "Telefon", empty);
    expect(items.every((item) => !item.answer.includes("₺"))).toBe(true);
  });
});

describe("buildLandingHeading", () => {
  it("keeps brand casing and sentence-cases generated phrases", () => {
    expect(buildLandingHeading("product", "iPhone 15")).toBe("iPhone 15 ikinci el fiyatları");
    expect(buildLandingHeading("category", "Telefon")).toBe("İkinci el Telefon fiyatları");
  });
});

describe("isIndexableSnapshot", () => {
  it("indexes only pages with at least one listing", () => {
    expect(isIndexableSnapshot(priced)).toBe(true);
    expect(isIndexableSnapshot(empty)).toBe(false);
  });
});

describe("snapshotFromListings", () => {
  it("counts listings and distinct sources", () => {
    const snapshot = snapshotFromListings([
      { price: 30000, source: "EasyCep" },
      { price: 32000, source: "EasyCep" },
      { price: 28000, source: "Getmobil" },
    ]);
    expect(snapshot).toMatchObject({ listingCount: 3, sourceCount: 2, minPrice: 28000, maxPrice: 32000 });
    expect(snapshot.averagePrice).toBe(30000);
  });

  it("returns empty prices without listings", () => {
    expect(snapshotFromListings([])).toEqual(empty);
  });
});

describe("buildFaqPageJsonLd", () => {
  it("maps FAQ items to schema.org Question entries", () => {
    const jsonLd = buildFaqPageJsonLd("https://2elbul.com/product/iphone-15", [
      { question: "Soru?", answer: "Cevap." },
    ]);
    expect(jsonLd["@type"]).toBe("FAQPage");
    expect(jsonLd["@id"]).toBe("https://2elbul.com/product/iphone-15#faq");
    expect(jsonLd.mainEntity[0]).toEqual({
      "@type": "Question",
      name: "Soru?",
      acceptedAnswer: { "@type": "Answer", text: "Cevap." },
    });
  });
});

describe("price list copy", () => {
  it("builds the title and a data-driven description", () => {
    expect(buildPriceListTitle(NOW)).toBe("İkinci El Fiyat Listesi (Ekim 2026) | 2ElBul");
    expect(
      buildPriceListDescription({
        modelCount: 94,
        listingCount: 1250,
        categoryNames: ["Telefon", "Bilgisayar", "Oyun Konsolu", "TV ve Ses Sistemleri", "Emlak"],
      }),
    ).toBe(
      "94 modelin güncel ikinci el fiyatları: en düşük fiyat, piyasa ortalaması ve ilan sayısı. Telefon, Bilgisayar, Oyun Konsolu, TV ve Ses Sistemleri ve daha fazlası; 1.250 ilandan derlendi.",
    );
  });
});
