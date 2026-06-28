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
  const normalized = normalizePublicCleanupText(name);
  if (!normalized) return false;
  return blockedTerms.some((term) => normalized.includes(term));
}

export function isPublicDemoListing(listing: PublicListingLike) {
  const source = normalizePublicCleanupText(listing.source);
  const url = normalizePublicCleanupText(listing.url);
  const title = normalizePublicCleanupText(listing.title);
  const productName = normalizePublicCleanupText(listing.productName);

  if (blockedSources.includes(source)) return true;
  if (url.includes("demo.2elbul.com")) return true;

  return [title, productName].some((value) =>
    blockedTerms.some((term) => value.includes(term)),
  );
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
