import { LISTING_CONDITIONS, type ListingCondition } from "@/lib/listings";

// Single source of truth for turning free-text "condition"/"durum" values
// (from admin imports, bot scrapers, or hand-entered payloads) into the
// canonical 7-value ListingCondition enum. Previously three different
// implementations existed (lib/import/adapters.ts, lib/bots/html-utils.ts,
// and a dead one in lib/duplicate-engine/helpers.ts) with different rules
// and, in one case, a different value set entirely — they now all delegate
// here so a given input string always normalizes the same way everywhere.

const EXACT_ALIASES: Record<string, ListingCondition> = {
  sıfır: "Sıfır",
  sifir: "Sıfır",
  yeni: "Sıfır",
  "yeni gibi": "Yeni gibi",
  "çok iyi": "Çok iyi",
  "cok iyi": "Çok iyi",
  iyi: "İyi",
  "ikinci el": "İkinci El",
  "2. el": "İkinci El",
  "2.el": "İkinci El",
  kullanılmış: "Kullanılmış",
  kullanilmis: "Kullanılmış",
  yenilenmiş: "Yenilenmiş",
  yenilenmis: "Yenilenmiş",
  refurbished: "Yenilenmiş",
};

/** Ordered so more specific substrings are tested before looser ones. */
const SUBSTRING_RULES: Array<{ includes: string[]; condition: ListingCondition }> = [
  { includes: ["yenilen", "refurb"], condition: "Yenilenmiş" },
  { includes: ["sıfır", "sifir"], condition: "Sıfır" },
  { includes: ["yeni gibi"], condition: "Yeni gibi" },
  { includes: ["çok iyi", "cok iyi"], condition: "Çok iyi" },
  { includes: ["kullanılmış", "kullanilmis"], condition: "Kullanılmış" },
  { includes: ["2. el", "2.el", "ikinci el"], condition: "İkinci El" },
  { includes: ["iyi"], condition: "İyi" },
];

/**
 * Normalizes a free-text condition string to the canonical ListingCondition
 * enum. Falls back to "İkinci El" (the safest default — never overstates
 * quality as "Sıfır"/"Yenilenmiş") when nothing matches.
 */
export function normalizeConditionText(
  text: string | null | undefined,
): ListingCondition {
  const value = String(text ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR");
  if (!value) return "İkinci El";

  const exact = EXACT_ALIASES[value];
  if (exact) return exact;

  for (const rule of SUBSTRING_RULES) {
    if (rule.includes.some((needle) => value.includes(needle))) {
      return rule.condition;
    }
  }

  return "İkinci El";
}

export function isKnownListingCondition(value: string): value is ListingCondition {
  return (LISTING_CONDITIONS as string[]).includes(value);
}

// "İkinci El" and "Kullanılmış" both mean "used" — they're kept as distinct
// enum values (different sources/UIs phrase it differently) but should not
// be scored as a hard condition *conflict* the way "Sıfır" vs "İkinci El"
// should. Used by the duplicate-listing scorer.
const CONDITION_EQUIVALENCE_GROUPS: ListingCondition[][] = [
  ["İkinci El", "Kullanılmış"],
];

export function conditionsAreEquivalent(
  a: ListingCondition | string,
  b: ListingCondition | string,
): boolean {
  if (a === b) return true;
  return CONDITION_EQUIVALENCE_GROUPS.some(
    (group) => group.includes(a as ListingCondition) && group.includes(b as ListingCondition),
  );
}
