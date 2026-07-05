import type {
  NormalizedListing,
  SearchInput,
  SourceAdapter,
} from "@/lib/source-adapters/types";
import {
  extractBrand,
  formatBrandDisplayName,
} from "@/lib/normalization";

export const mockSourceAdapter: SourceAdapter = {
  slug: "mock",
  async search(input) {
    const cleanQuery = input.query.trim() || "ikinci el urun";
    const normalized = slugify(input.normalizedQuery || cleanQuery);
    const sourceSlug = slugify(input.sourceSlug || "mock");
    const sourceName = "Test Kaynağı";
    const basePrice = getDeterministicBasePrice(normalized);
    const count = Math.min(Math.max(input.limit ?? 3, 1), 3);

    return Array.from({ length: count }, (_, index): NormalizedListing => {
      const number = index + 1;
      const price = basePrice + index * 750;
      return {
        externalId: `search-${sourceSlug}-${normalized}-${number}`,
        title: `${cleanQuery} için test ilanı ${number}`,
        price,
        url: `https://demo.2elbul.com/search/${sourceSlug}/${normalized}-${number}`,
        imageUrl: "/products/placeholder.svg",
        city: ["İstanbul", "Ankara", "İzmir"][index] ?? "Türkiye",
        sourceName,
        category: inferCategory(cleanQuery),
        brand: inferBrand(cleanQuery),
        model: cleanQuery,
        rawData: {
          adapter: "mock",
          sourceType: "test",
          query: input.query,
          normalizedQuery: input.normalizedQuery,
          generatedAt: new Date().toISOString(),
        },
      };
    });
  },
};

function getDeterministicBasePrice(value: string) {
  const hash = [...value].reduce(
    (total, char) => total + char.charCodeAt(0),
    0,
  );
  return 3500 + (hash % 30) * 500;
}

function inferCategory(query: string) {
  const text = query.toLocaleLowerCase("tr-TR");
  if (text.includes("iphone") || text.includes("samsung")) return "Telefon";
  if (text.includes("ps5") || text.includes("playstation")) return "Oyun Konsolu";
  if (text.includes("rtx")) return "Ekran Kartı";
  if (text.includes("macbook") || text.includes("laptop")) return "Laptop";
  if (text.includes("ipad") || text.includes("tablet")) return "Tablet";
  return "Genel";
}

function inferBrand(query: string) {
  return formatBrandDisplayName(extractBrand(query));
}

function slugify(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "arama";
}
