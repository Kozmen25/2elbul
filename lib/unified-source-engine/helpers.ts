export function normalizeSearchText(value: string): string {
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
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function createDeterministicExternalId(
  source: string,
  url: string,
  title: string,
): string {
  return `${source}-${normalizeSearchText(url || title).replace(/\s+/g, "-")}`.slice(
    0,
    180,
  );
}

export function deriveBrand(title: string): string | null {
  const normalizedTitle = normalizeSearchText(title);
  if (
    normalizedTitle.includes("iphone") ||
    normalizedTitle.includes("apple")
  ) {
    return "Apple";
  }
  if (normalizedTitle.includes("samsung")) return "Samsung";
  if (normalizedTitle.includes("xiaomi")) return "Xiaomi";
  if (normalizedTitle.includes("huawei")) return "Huawei";
  if (normalizedTitle.includes("oppo")) return "Oppo";
  if (normalizedTitle.includes("realme")) return "Realme";
  return null;
}
