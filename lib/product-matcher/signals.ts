import type { ICategoryResolver } from "@/lib/taxonomy/integration";
import {
  extractBrand,
  isBareIphoneModel,
  isBareSamsungModel,
} from "@/lib/normalization";
import {
  compactModelSuffix,
  normalizeCapacity,
  normalizeProductTitle,
} from "./helpers";
import type { ProductSignals } from "./types";

const storageValues = ["64", "128", "256", "512", "1024", "1"];
const colors = [
  "siyah",
  "beyaz",
  "mavi",
  "kirmizi",
  "yesil",
  "mor",
  "pembe",
  "gri",
  "gumus",
  "altin",
  "gold",
  "black",
  "white",
  "blue",
  "red",
  "green",
  "purple",
  "pink",
  "gray",
  "grey",
  "silver",
];

export function extractProductSignals(
  title: string,
  resolver?: ICategoryResolver,
): ProductSignals {
  const normalized = normalizeProductTitle(title);
  const tokens = normalized.split(" ").filter(Boolean);
  const brand = extractBrand(normalized);
  const model = detectModel(normalized, tokens, brand);
  const storage = detectStorage(normalized, tokens);
  const ram = detectRam(normalized);
  const color = detectColor(tokens);
  const category = resolver
    ? resolver.resolveSync(title).categoryLabel
    : detectCategory(normalized, brand);
  const keyParts = [brand, model, storage, ram && category !== "Telefon" ? ram : null].filter(Boolean);
  const normalizedKey = keyParts.length
    ? keyParts.join("-").replace(/[^a-z0-9]+/g, "-")
    : normalized.replace(/\s+/g, "-");

  return {
    brand,
    model,
    storage,
    ram,
    color,
    category,
    normalizedKey,
  };
}

export function generateProductKey(title: string) {
  return extractProductSignals(title).normalizedKey;
}

function detectModel(
  normalized: string,
  tokens: string[],
  brand: string | null,
) {
  const iphone = normalized.match(
    /\b(?:iphone\s*)?(1[1-6])\s*(pro\s*max|pro|plus|mini)?\b/,
  );
  if ((brand === "apple" || isBareIphoneModel(normalized)) && iphone) {
    return ["iphone", iphone[1], compactModelSuffix(iphone[2])]
      .filter(Boolean)
      .join("-");
  }

  const samsung = normalized.match(
    /\b(?:samsung\s*)?(?:galaxy\s*)?((?:s|a|m)\d{2}(?:\s*ultra|\s*plus|\s*fe)?|z\s*(?:fold|flip)\s*\d?)\b/,
  );
  if (
    (brand === "samsung" ||
      normalized.includes("galaxy") ||
      isBareSamsungModel(normalized)) &&
    samsung
  ) {
    return `galaxy-${samsung[1].replace(/\s+/g, "-")}`;
  }

  const ipad = normalized.match(/\bipad\s*(\d+|air|pro|mini)?(?:\s*nesil)?\b/);
  if (ipad) return ["ipad", ipad[1]].filter(Boolean).join("-");

  const macbook = normalized.match(/\bmacbook\s*(air|pro)?\s*(m\d)?\b/);
  if (macbook) return ["macbook", macbook[1], macbook[2]].filter(Boolean).join("-");

  return tokens.slice(0, 4).join("-");
}

function detectStorage(normalized: string, tokens: string[]) {
  const explicit = normalized.match(/\b(\d{2,4}gb|\d+tb)\b/);
  if (explicit) return normalizeCapacity(explicit[1]);

  const bare = tokens.find((token) => storageValues.includes(token));
  return bare ? normalizeCapacity(`${bare}${bare === "1" ? "tb" : "gb"}`) : null;
}

function detectRam(normalized: string) {
  const match = normalized.match(/\b(\d{1,3})\s*(?:gb)?\s*ram\b/);
  return match ? `${match[1]}gb` : null;
}

function detectColor(tokens: string[]) {
  return tokens.find((token) => colors.includes(token)) ?? null;
}

function detectCategory(normalized: string, brand: string | null) {
  if (
    brand === "apple" &&
    (normalized.includes("iphone") || isBareIphoneModel(normalized))
  ) {
    return "Telefon";
  }
  if (brand === "samsung" && /\b(galaxy|s\d{2}|a\d{2})\b/.test(normalized)) {
    return "Telefon";
  }
  if (normalized.includes("ipad") || normalized.includes("tablet")) return "Tablet";
  if (normalized.includes("macbook") || normalized.includes("laptop")) {
    return "Laptop";
  }
  if (normalized.includes("playstation") || normalized.includes("ps5")) {
    return "Oyun Konsolu";
  }
  if (normalized.includes("rtx") || normalized.includes("ekran karti")) {
    return "Ekran Kartı";
  }
  return null;
}
