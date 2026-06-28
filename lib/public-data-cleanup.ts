type PublicListingLike = {
  title?: string | null;
  productName?: string | null;
  source?: string | null;
  url?: string | null;
};

const blockedTerms = [
  "demo",
  "test",
  "mock",
  "smoke",
  "sahte",
  "olmayan-bir-urun",
  "sprint",
];

const blockedSources = ["test kaynağı", "test kaynagi", "mock adapter", "demo bot"];

export function isPublicDemoProductName(name: string | null | undefined) {
  return getPublicDemoProductReasons(name).length > 0;
}

export function isPublicDemoListing(listing: PublicListingLike) {
  return getPublicDemoListingReasons(listing).length > 0;
}

export function getPublicDemoProductReasons(name: string | null | undefined) {
  const normalized = normalizePublicCleanupText(name);
  if (!normalized) return [];

  return blockedTerms
    .filter((term) => normalized.includes(term))
    .map((term) => `Ürün adında "${term}" ifadesi var`);
}

export function getPublicDemoListingReasons(listing: PublicListingLike) {
  const source = normalizePublicCleanupText(listing.source);
  const url = normalizePublicCleanupText(listing.url);
  const title = normalizePublicCleanupText(listing.title);
  const productName = normalizePublicCleanupText(listing.productName);
  const reasons: string[] = [];

  if (blockedSources.includes(source)) {
    reasons.push(`Şüpheli kaynak: ${listing.source ?? "bilinmiyor"}`);
  }
  if (url.includes("demo.2elbul.com")) {
    reasons.push("Demo URL alan adı kullanılıyor");
  }

  for (const term of blockedTerms) {
    if (title.includes(term)) {
      reasons.push(`İlan başlığında "${term}" ifadesi var`);
    }
    if (productName.includes(term)) {
      reasons.push(`Ürün adında "${term}" ifadesi var`);
    }
  }

  return [...new Set(reasons)];
}

function normalizePublicCleanupText(value: string | null | undefined) {
  return (value ?? "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .trim();
}
