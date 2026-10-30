import { normalizeCategoryText } from "@/lib/normalization";

/**
 * Synonym Registry — product-type equivalence groups for search expansion.
 *
 * Registry Pattern: curated synonym groups map equivalent Turkish/English
 * product-type terms (laptop ↔ notebook ↔ dizüstü) without expanding brands.
 *
 * Used by the search query-expansion pipeline. Does not author product truth.
 */

export type SynonymGroup = {
  id: string;
  /** Preferred display / canonical term (normalized on register). */
  canonical: string;
  /** Equivalent terms including the canonical form. */
  terms: string[];
};

export type SynonymExpansionResult = {
  /** All unique expanded terms (tokens + group members). */
  terms: string[];
  /** Multi-token phrase variants (e.g. "asus notebook" → "asus laptop"). */
  phraseVariants: string[];
  /** Matched synonym group ids. */
  matchedGroupIds: string[];
};

const MAX_PHRASE_VARIANTS = 12;

/** Curated product-type synonym groups for the Turkish second-hand market. */
export const DEFAULT_SYNONYM_GROUPS: SynonymGroup[] = [
  {
    id: "laptop",
    canonical: "laptop",
    terms: [
      "laptop",
      "notebook",
      "dizustu",
      "dizüstü",
      "dizustu bilgisayar",
      "dizüstü bilgisayar",
      "laptop bilgisayar",
      "notebook bilgisayar",
      "portable computer",
    ],
  },
  {
    id: "desktop",
    canonical: "masaustu",
    terms: [
      "masaustu",
      "masaüstü",
      "desktop",
      "masaüstü bilgisayar",
      "masaustu bilgisayar",
      "pc kasa",
      "all in one",
      "all-in-one",
    ],
  },
  {
    id: "computer",
    canonical: "bilgisayar",
    terms: [
      "bilgisayar",
      "pc",
      "computer",
      "bilgisayar sistemi",
      "oyuncu bilgisayari",
      "oyuncu bilgisayarı",
      "gaming pc",
      "gamer pc",
    ],
  },
  {
    id: "phone",
    canonical: "telefon",
    terms: [
      "telefon",
      "cep telefonu",
      "akilli telefon",
      "akıllı telefon",
      "smartphone",
      "mobile phone",
      "cep tel",
    ],
  },
  {
    id: "tablet",
    canonical: "tablet",
    terms: ["tablet", "tablet pc", "android tablet"],
  },
  {
    id: "tv",
    canonical: "tv",
    terms: [
      "tv",
      "televizyon",
      "smart tv",
      "televizyon ekrani",
      "televizyon ekranı",
    ],
  },
  {
    id: "monitor",
    canonical: "monitor",
    terms: [
      "monitor",
      "monitör",
      "ekran monitor",
      "bilgisayar monitörü",
      "bilgisayar monitoru",
      "gaming monitor",
      "oyuncu monitörü",
      "oyuncu monitoru",
    ],
  },
  {
    id: "headphones",
    canonical: "kulaklik",
    terms: [
      "kulaklik",
      "kulaklık",
      "headphone",
      "headphones",
      "earbuds",
      "kulak ici",
      "kulak içi",
      "bluetooth kulaklik",
      "bluetooth kulaklık",
    ],
  },
  {
    id: "watch",
    canonical: "saat",
    terms: [
      "saat",
      "kol saati",
      "akilli saat",
      "akıllı saat",
      "smartwatch",
      "smart watch",
    ],
  },
  {
    id: "console",
    canonical: "konsol",
    terms: [
      "konsol",
      "oyun konsolu",
      "game console",
      "oyun konsol",
      "gaming console",
    ],
  },
  {
    id: "car",
    canonical: "otomobil",
    terms: ["otomobil", "araba", "oto", "binek arac", "binek araç"],
  },
  {
    id: "motorcycle",
    canonical: "motosiklet",
    terms: ["motosiklet", "motor", "motosiklet motor"],
  },
  {
    id: "gpu",
    canonical: "ekran karti",
    terms: [
      "ekran karti",
      "ekran kartı",
      "gpu",
      "graphics card",
      "ekran kart",
      "vga",
    ],
  },
  {
    id: "cpu",
    canonical: "islemci",
    terms: ["islemci", "işlemci", "cpu", "processor"],
  },
  {
    id: "fridge",
    canonical: "buzdolabi",
    terms: ["buzdolabi", "buzdolabı", "refrigerator", "fridge"],
  },
  {
    id: "washer",
    canonical: "camasir makinesi",
    terms: [
      "camasir makinesi",
      "çamaşır makinesi",
      "washing machine",
      "camasir",
    ],
  },
  {
    id: "dishwasher",
    canonical: "bulasik makinesi",
    terms: [
      "bulasik makinesi",
      "bulaşık makinesi",
      "dishwasher",
      "bulasik",
    ],
  },
  {
    id: "vacuum",
    canonical: "supurge",
    terms: [
      "supurge",
      "süpürge",
      "vacuum",
      "robot supurge",
      "robot süpürge",
    ],
  },
  {
    id: "camera",
    canonical: "kamera",
    terms: ["kamera", "fotograf makinesi", "fotoğraf makinesi", "dslr", "mirrorless"],
  },
  {
    id: "bike",
    canonical: "bisiklet",
    terms: ["bisiklet", "bicycle", "bike", "dag bisikleti", "dağ bisikleti"],
  },
];

class SynonymRegistry {
  private readonly groups = new Map<string, SynonymGroup>();
  /** normalized term → group id */
  private readonly termIndex = new Map<string, string>();
  /** Longest multi-token phrases first for greedy matching. */
  private phrases: Array<{ normalized: string; groupId: string; tokenCount: number }> =
    [];

  register(group: SynonymGroup): void {
    const canonical = normalizeCategoryText(group.canonical);
    if (!canonical) return;

    const normalizedTerms = [
      ...new Set(
        group.terms
          .map((term) => normalizeCategoryText(term))
          .filter((term): term is string => Boolean(term)),
      ),
    ];

    if (!normalizedTerms.includes(canonical)) {
      normalizedTerms.unshift(canonical);
    }

    const stored: SynonymGroup = {
      id: group.id,
      canonical,
      terms: normalizedTerms,
    };

    this.groups.set(stored.id, stored);

    for (const term of normalizedTerms) {
      // Prefer first registration; do not overwrite with a later group.
      if (!this.termIndex.has(term)) {
        this.termIndex.set(term, stored.id);
      }
    }

    this.rebuildPhrases();
  }

  registerBulk(groups: SynonymGroup[]): void {
    for (const group of groups) {
      this.register(group);
    }
  }

  getGroup(id: string): SynonymGroup | undefined {
    return this.groups.get(id);
  }

  findGroupByTerm(term: string): SynonymGroup | undefined {
    const groupId = this.termIndex.get(normalizeCategoryText(term));
    return groupId ? this.groups.get(groupId) : undefined;
  }

  /** Expand a single token to its synonym group members (or itself). */
  expandToken(token: string): string[] {
    const normalized = normalizeCategoryText(token);
    if (!normalized) return [];

    const group = this.findGroupByTerm(normalized);
    if (!group) return [normalized];
    return [...group.terms];
  }

  /**
   * Expand a full query:
   * 1) longest phrase matches → whole group terms
   * 2) remaining unmatched tokens → per-token synonym expansion
   * 3) phrase variants for compound queries (brand + product-type)
   */
  expandQuery(query: string): SynonymExpansionResult {
    const normalizedQuery = normalizeCategoryText(query);
    if (!normalizedQuery) {
      return { terms: [], phraseVariants: [], matchedGroupIds: [] };
    }

    const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
    const termMap = new Map<string, string>();
    const matchedGroupIds = new Set<string>();
    const covered = new Array<boolean>(tokens.length).fill(false);

    addUnique(termMap, normalizedQuery);

    // Greedy longest-phrase matching over the token sequence.
    for (const phrase of this.phrases) {
      const phraseTokens = phrase.normalized.split(/\s+/).filter(Boolean);
      if (phraseTokens.length === 0) continue;

      for (let i = 0; i <= tokens.length - phraseTokens.length; i++) {
        if (covered.slice(i, i + phraseTokens.length).some(Boolean)) continue;

        const window = tokens.slice(i, i + phraseTokens.length).join(" ");
        if (window !== phrase.normalized) continue;

        covered.fill(true, i, i + phraseTokens.length);
        matchedGroupIds.add(phrase.groupId);
        const group = this.groups.get(phrase.groupId);
        if (group) {
          for (const term of group.terms) addUnique(termMap, term);
        }
      }
    }

    // Expand uncovered single tokens.
    for (let i = 0; i < tokens.length; i++) {
      if (covered[i]) continue;
      const group = this.findGroupByTerm(tokens[i] ?? "");
      if (!group) continue;
      matchedGroupIds.add(group.id);
      covered[i] = true;
      for (const term of group.terms) addUnique(termMap, term);
    }

    const phraseVariants = buildPhraseVariants(tokens, (token) => {
      const group = this.findGroupByTerm(token);
      return group ? group.terms : [token];
    });

    for (const variant of phraseVariants) addUnique(termMap, variant);

    return {
      terms: [...termMap.values()],
      phraseVariants,
      matchedGroupIds: [...matchedGroupIds],
    };
  }

  private rebuildPhrases(): void {
    const phrases: Array<{ normalized: string; groupId: string; tokenCount: number }> =
      [];

    for (const group of this.groups.values()) {
      for (const term of group.terms) {
        const tokenCount = term.split(/\s+/).filter(Boolean).length;
        if (tokenCount < 2) continue;
        phrases.push({
          normalized: term,
          groupId: group.id,
          tokenCount,
        });
      }
    }

    phrases.sort((a, b) => b.tokenCount - a.tokenCount || b.normalized.length - a.normalized.length);
    this.phrases = phrases;
  }
}

function addUnique(map: Map<string, string>, term: string): void {
  const normalized = normalizeCategoryText(term);
  if (normalized) map.set(normalized, normalized);
}

/**
 * Build limited phrase variants by substituting one expandable token at a time.
 * Avoids combinatorial explosion for multi-synonym queries.
 */
function buildPhraseVariants(
  tokens: string[],
  expand: (token: string) => string[],
): string[] {
  if (tokens.length < 2) return [];

  const variants: string[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) continue;
    const alternatives = expand(token).filter((alt) => alt !== token);
    if (alternatives.length === 0) continue;

    for (const alt of alternatives) {
      const next = [...tokens];
      next[i] = alt;
      const phrase = next.join(" ");
      if (seen.has(phrase)) continue;
      seen.add(phrase);
      variants.push(phrase);
      if (variants.length >= MAX_PHRASE_VARIANTS) return variants;
    }
  }

  return variants;
}

let singleton: SynonymRegistry | null = null;

export function createSynonymRegistry(
  groups: SynonymGroup[] = DEFAULT_SYNONYM_GROUPS,
): SynonymRegistry {
  const registry = new SynonymRegistry();
  registry.registerBulk(groups);
  return registry;
}

export function getSynonymRegistry(): SynonymRegistry {
  if (!singleton) {
    singleton = createSynonymRegistry();
  }
  return singleton;
}

/** Test helper — resets the singleton so suites stay isolated. */
export function resetSynonymRegistryForTests(): void {
  singleton = null;
}
