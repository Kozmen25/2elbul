import { normalizeConditionText } from "@/lib/listing-condition";
import { normalizeSearchText } from "@/lib/normalization";

// Is this the SAME physical item posted on two platforms?
//
// This is deliberately not the score-based engine in this folder: that one
// rates how similar two titles are and cannot tell "iPhone 13 128GB" from
// "iPhone 13 256GB" (71 vs 74 points). Merging two different items into one
// group is much worse than missing a duplicate, so this is a short list of
// explicit rules and ALL of them must hold. Each rule is an equality of a
// fact read from the listing, never a similarity score, except the title
// overlap which only confirms what the facts already say.

export type IdentityListing = {
  id: string;
  title: string;
  price: number;
  source: string;
  city?: string | null;
  condition?: string | null;
};

/** Cross-posted copies carry (almost) the same asking price. */
export const MAX_PRICE_DIFFERENCE_PERCENT = 3;

/** Share of meaningful title words the two titles have in common. */
export const MIN_TITLE_OVERLAP = 0.6;

const CAPACITY_PATTERN = /^\d+(gb|tb)$/;

/** Model suffixes: "S23" and "S23 Ultra" are different items. */
const VARIANT_WORDS = new Set([
  "pro", "max", "mini", "plus", "ultra", "fe", "lite", "se", "air", "note", "neo", "gt", "flip", "fold", "xl", "slim",
]);

const COLOR_WORDS = new Set([
  "siyah", "beyaz", "mavi", "kirmizi", "yesil", "mor", "pembe", "gri", "grisi", "gumus", "altin", "gold", "turuncu",
  "sari", "lacivert", "bordo", "bej", "titanyum", "uzay", "black", "white", "blue", "red", "green", "purple",
  "pink", "gray", "grey", "silver", "graphite", "midnight", "starlight",
]);

/** Marketing and condition words that say nothing about which item it is. */
const NOISE_WORDS = new Set([
  "temiz", "kutulu", "acil", "firsat", "garantili", "garanti", "sorunsuz", "hasarsiz", "orijinal", "faturali", "fatura",
  "cihaz", "telefon", "cep", "satilik", "satiliktir", "ikinci", "el", "yeni", "sifir", "gibi", "az", "kullanilmis",
  "kullanilmistir", "uygun", "fiyat", "fiyati", "tl", "ilk", "sahibinden", "degisim", "olmaz", "net", "pazarlik",
  "payi", "var", "yok", "hasar", "kaydi", "tam", "calisir", "kusursuz", "bakimli", "masrafsiz", "ram", "ile", "ve",
  "bir", "cok", "iyi", "refurbished", "yenilenmis",
]);

const TURKISH_ASCII: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };

function foldToken(token: string): string {
  return token
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıöşüâîû]/g, (char) => TURKISH_ASCII[char] ?? char)
    .replace(/[^a-z0-9]/g, "");
}

type Fingerprint = {
  capacities: Set<string>;
  colors: Set<string>;
  variants: Set<string>;
  /** Words left after removing capacities, colors, variants and noise. */
  words: Set<string>;
  conditionClass: "new" | "refurbished" | "used";
  city: string;
};

function conditionClassOf(condition: string | null | undefined): Fingerprint["conditionClass"] {
  const normalized = normalizeConditionText(condition);
  if (normalized === "Sıfır") return "new";
  if (normalized === "Yenilenmiş") return "refurbished";
  return "used";
}

export function fingerprintListing(listing: IdentityListing): Fingerprint {
  const capacities = new Set<string>();
  const colors = new Set<string>();
  const variants = new Set<string>();
  const words = new Set<string>();

  for (const raw of normalizeSearchText(listing.title).split(/\s+/)) {
    const token = foldToken(raw);
    if (!token) continue;
    if (CAPACITY_PATTERN.test(token)) capacities.add(token);
    else if (COLOR_WORDS.has(token)) colors.add(token);
    else if (VARIANT_WORDS.has(token)) variants.add(token);
    else if (!NOISE_WORDS.has(token)) words.add(token);
  }

  return {
    capacities,
    colors,
    variants,
    words,
    conditionClass: conditionClassOf(listing.condition),
    city: foldToken(listing.city ?? ""),
  };
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((value) => b.has(value));
}

function overlap(a: Set<string>, b: Set<string>): number {
  const union = new Set([...a, ...b]);
  if (union.size === 0) return 1;
  let shared = 0;
  for (const word of a) if (b.has(word)) shared += 1;
  return shared / union.size;
}

export type IdentityVerdict = { same: true } | { same: false; reason: string };

/**
 * Both listings must already belong to the same product. Every rule below has
 * to hold; the first one that fails is reported (useful in the admin view).
 */
export function compareListingIdentity(
  a: IdentityListing,
  b: IdentityListing,
  fingerprints?: { a: Fingerprint; b: Fingerprint },
): IdentityVerdict {
  if (a.source === b.source) return { same: false, reason: "Aynı kaynak" };

  const lowest = Math.min(a.price, b.price);
  if (!(lowest > 0)) return { same: false, reason: "Geçersiz fiyat" };
  if ((Math.abs(a.price - b.price) / lowest) * 100 > MAX_PRICE_DIFFERENCE_PERCENT) {
    return { same: false, reason: "Fiyat farklı" };
  }

  const fa = fingerprints?.a ?? fingerprintListing(a);
  const fb = fingerprints?.b ?? fingerprintListing(b);

  if (fa.conditionClass !== fb.conditionClass) return { same: false, reason: "Ürün durumu farklı" };
  if (fa.city && fb.city && fa.city !== fb.city) return { same: false, reason: "Şehir farklı" };
  // A capacity ("128gb") present in only one title is "unknown", not "equal".
  if (!sameSet(fa.capacities, fb.capacities)) return { same: false, reason: "Depolama/RAM farklı veya belirsiz" };
  if (fa.colors.size > 0 && fb.colors.size > 0 && !sameSet(fa.colors, fb.colors)) {
    return { same: false, reason: "Renk farklı" };
  }
  if (!sameSet(fa.variants, fb.variants)) return { same: false, reason: "Model varyantı farklı" };
  if (overlap(fa.words, fb.words) < MIN_TITLE_OVERLAP) return { same: false, reason: "Başlıklar yeterince benzemiyor" };

  return { same: true };
}
