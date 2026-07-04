export type SearchCategoryNode = {
  slug: string;
  name: string;
  synonyms?: string[];
  keywords?: string[];
  children?: SearchCategoryNode[];
};

export type SearchIntentTerm = {
  term: string;
  weight: number;
  reason: "original" | "category" | "synonym" | "keyword" | "child";
};

export type SearchIntent = {
  query: string;
  normalizedQuery: string;
  matchedCategories: Array<{
    slug: string;
    name: string;
    depth: number;
  }>;
  terms: SearchIntentTerm[];
  isBroadCategory: boolean;
};

export const SEARCH_CATEGORY_TREE: SearchCategoryNode[] = [
  {
    slug: "vasita",
    name: "Vasıta",
    synonyms: ["vasita", "araç", "arac", "taşıt", "tasit"],
    keywords: [
      "araba",
      "otomobil",
      "oto",
      "motosiklet",
      "motor",
      "scooter",
      "kamyonet",
      "minivan",
      "ticari araç",
    ],
    children: [
      keywordCategory("otomobil", "Otomobil", ["araba", "oto", "sedan", "hatchback", "suv"]),
      keywordCategory("motosiklet", "Motosiklet", ["motor", "scooter", "enduro", "naked"]),
      keywordCategory("ticari-arac", "Ticari Araç", ["kamyonet", "panelvan", "minibüs", "minibus"]),
    ],
  },
  {
    slug: "emlak",
    name: "Emlak",
    synonyms: ["gayrimenkul", "ev", "konut"],
    keywords: ["konut", "daire", "villa", "arsa", "işyeri", "isyeri", "ofis", "dükkan", "dukkan"],
    children: [
      keywordCategory("konut", "Konut", ["daire", "ev", "villa", "rezidans"]),
      keywordCategory("arsa", "Arsa", ["tarla", "imar", "bahçe", "bahce"]),
      keywordCategory("isyeri", "İşyeri", ["ofis", "dükkan", "dukkan", "mağaza", "magaza"]),
    ],
  },
  {
    slug: "ikinci-el-ve-sifir-alisveris",
    name: "İkinci El ve Sıfır Alışveriş",
    synonyms: ["alışveriş", "alisveris", "ikinci el", "sıfır", "sifir", "ürün", "urun"],
    keywords: ["telefon", "bilgisayar", "tablet", "kamera", "tv", "konsol", "mobilya"],
    children: [
      {
        slug: "cep-telefonu",
        name: "Cep Telefonu",
        synonyms: ["telefon", "cep telefonu", "akıllı telefon", "akilli telefon", "smartphone"],
        keywords: ["iphone", "samsung", "galaxy", "xiaomi", "redmi", "poco", "oppo", "vivo", "honor", "realme", "huawei"],
      },
      {
        slug: "bilgisayar",
        name: "Bilgisayar",
        synonyms: ["pc", "dizüstü", "dizustu", "bilgisayar"],
        keywords: ["laptop", "notebook", "macbook", "lenovo", "asus", "hp", "dell", "acer", "monster", "msi", "işlemci", "islemci", "ekran kartı", "ekran karti", "rtx", "gtx", "rx", "nvidia", "amd"],
      },
      {
        slug: "tablet",
        name: "Tablet",
        synonyms: ["tablet bilgisayar"],
        keywords: ["ipad", "galaxy tab", "lenovo tab", "huawei matepad", "xiaomi pad"],
      },
      {
        slug: "fotograf-kamera",
        name: "Fotoğraf & Kamera",
        synonyms: ["fotoğraf", "fotograf", "kamera", "foto kamera"],
        keywords: ["canon", "nikon", "sony alpha", "fujifilm", "gopro", "lens", "dslr", "mirrorless"],
      },
      {
        slug: "tv-ses-sistemleri",
        name: "TV & Ses Sistemleri",
        synonyms: ["tv", "televizyon", "ses sistemi", "ses sistemleri"],
        keywords: ["smart tv", "oled", "qled", "led tv", "soundbar", "hoparlör", "hoparlor", "amfi", "lg tv", "samsung tv"],
      },
      {
        slug: "beyaz-esya",
        name: "Beyaz Eşya",
        synonyms: ["beyaz eşya", "beyaz esya"],
        keywords: ["buzdolabı", "buzdolabi", "çamaşır makinesi", "camasir makinesi", "bulaşık makinesi", "bulasik makinesi", "fırın", "firin", "kurutma makinesi", "klima"],
      },
      keywordCategory("ev-elektronigi", "Ev Elektroniği", ["robot süpürge", "robot supurge", "ütü", "utu", "airfryer", "kahve makinesi", "süpürge", "supurge"]),
      {
        slug: "oyun-konsol",
        name: "Oyun & Konsol",
        synonyms: ["oyun konsolu", "konsol", "oyun"],
        keywords: ["ps5", "ps4", "playstation", "xbox", "nintendo", "switch", "dualshock", "dualsense"],
      },
      keywordCategory("giyim", "Giyim", ["mont", "ayakkabı", "ayakkabi", "elbise", "çanta", "canta", "sneaker"]),
      keywordCategory("bebek-cocuk", "Bebek & Çocuk", ["bebek arabası", "bebek arabasi", "oyuncak", "mama sandalyesi", "beşik", "besik"]),
      keywordCategory("spor", "Spor", ["bisiklet", "koşu bandı", "kosu bandi", "dambıl", "dambil", "fitness", "kamp"]),
      keywordCategory("hobi", "Hobi", ["lego", "drone", "maket", "oyun", "koleksiyon"]),
      keywordCategory("muzik-aletleri", "Müzik Aletleri", ["gitar", "piyano", "keman", "bateri", "amfi", "org"]),
      keywordCategory("kitap", "Kitap", ["roman", "ders kitabı", "ders kitabi", "çizgi roman", "cizgi roman"]),
      keywordCategory("koleksiyon", "Koleksiyon", ["plak", "pul", "antik", "figür", "figur", "kart"]),
      keywordCategory("saat", "Saat", ["kol saati", "akıllı saat", "akilli saat", "apple watch", "galaxy watch"]),
      keywordCategory("taki", "Takı", ["yüzük", "yuzuk", "kolye", "bileklik", "küpe", "kupe"]),
      keywordCategory("mobilya", "Mobilya", ["koltuk", "masa", "sandalye", "yatak", "dolap", "sehpa"]),
      keywordCategory("bahce-yapi-market", "Bahçe & Yapı Market", ["matkap", "çim biçme", "cim bicme", "bahçe", "bahce", "alet", "hırdavat", "hirdavat"]),
    ],
  },
  keywordCategory("yedek-parca", "Yedek Parça", ["yedek parça", "yedek parca", "jant", "lastik", "far", "tampon", "motor parçası", "motor parcasi"]),
  keywordCategory("is-makineleri", "İş Makineleri", ["kepçe", "kepce", "forklift", "traktör", "traktor", "vinç", "vinc", "ekskavatör", "ekskavator"]),
  keywordCategory("ustalar-hizmetler", "Ustalar ve Hizmetler", ["usta", "tesisat", "nakliye", "boya", "tamir", "temizlik", "montaj"]),
  keywordCategory("ozel-ders", "Özel Ders", ["özel ders", "ozel ders", "matematik", "ingilizce", "öğretmen", "ogretmen", "kurs"]),
  keywordCategory("is-ilanlari", "İş İlanları", ["iş", "is", "eleman", "personel", "part time", "tam zamanlı", "tam zamanli"]),
  keywordCategory("yardimci-arayanlar", "Yardımcı Arayanlar", ["bakıcı", "bakici", "yardımcı", "yardimci", "temizlikçi", "temizlikci", "hasta bakıcı", "hasta bakici"]),
  keywordCategory("hayvanlar-alemi", "Hayvanlar Alemi", ["kedi", "köpek", "kopek", "kuş", "kus", "akvaryum", "mama", "pet"]),
];

export function resolveSearchIntent(query: string): SearchIntent {
  const trimmedQuery = query.trim().replace(/\s+/g, " ");
  const normalizedQuery = normalizeSearchIntentText(trimmedQuery);
  const termMap = new Map<string, SearchIntentTerm>();
  const matchedCategories: SearchIntent["matchedCategories"] = [];

  addTerm(termMap, trimmedQuery, 100, "original");
  if (!normalizedQuery) {
    return {
      query: trimmedQuery,
      normalizedQuery,
      matchedCategories,
      terms: [...termMap.values()],
      isBroadCategory: false,
    };
  }

  for (const entry of flattenCategories(SEARCH_CATEGORY_TREE)) {
    const directNames = [
      entry.category.name,
      entry.category.slug,
      ...(entry.category.synonyms ?? []),
    ];
    const directMatch = directNames.some(
      (value) => normalizeSearchIntentText(value) === normalizedQuery,
    );

    if (directMatch) {
      matchedCategories.push({
        slug: entry.category.slug,
        name: entry.category.name,
        depth: entry.depth,
      });
      addCategoryTerms(termMap, entry.category, entry.depth);
      continue;
    }

    const keywordMatch = (entry.category.keywords ?? []).some(
      (value) => normalizeSearchIntentText(value) === normalizedQuery,
    );
    if (keywordMatch) {
      addTerm(termMap, trimmedQuery, 100, "original");
      addTerm(termMap, entry.category.name, 45, "category");
    }
  }

  return {
    query: trimmedQuery,
    normalizedQuery,
    matchedCategories,
    terms: [...termMap.values()].sort((a, b) => b.weight - a.weight),
    isBroadCategory: matchedCategories.some((category) => category.depth <= 1),
  };
}

export function scoreSearchResult(
  intent: SearchIntent,
  input: { title?: string | null; productName?: string | null },
) {
  const haystack = normalizeSearchIntentText(
    `${input.productName ?? ""} ${input.title ?? ""}`,
  );
  if (!haystack) return 0;

  let score = 0;
  for (const term of intent.terms) {
    const normalizedTerm = normalizeSearchIntentText(term.term);
    if (!normalizedTerm) continue;
    if (haystack === normalizedTerm) score += term.weight + 30;
    else if (haystack.includes(normalizedTerm)) score += term.weight;
  }

  return score;
}

export function normalizeSearchIntentText(value: string) {
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
    .trim()
    .replace(/\s+/g, " ");
}

function keywordCategory(
  slug: string,
  name: string,
  keywords: string[],
): SearchCategoryNode {
  return {
    slug,
    name,
    synonyms: [name],
    keywords,
  };
}

function addCategoryTerms(
  termMap: Map<string, SearchIntentTerm>,
  category: SearchCategoryNode,
  depth: number,
) {
  addTerm(termMap, category.name, 85 - depth * 5, "category");
  for (const synonym of category.synonyms ?? []) {
    addTerm(termMap, synonym, 78 - depth * 5, "synonym");
  }
  for (const keyword of category.keywords ?? []) {
    addTerm(termMap, keyword, 62 - depth * 4, "keyword");
  }
  for (const child of category.children ?? []) {
    addTerm(termMap, child.name, 58 - depth * 4, "child");
    for (const synonym of child.synonyms ?? []) {
      addTerm(termMap, synonym, 54 - depth * 4, "child");
    }
    for (const keyword of child.keywords ?? []) {
      addTerm(termMap, keyword, 50 - depth * 4, "child");
    }
  }
}

function addTerm(
  termMap: Map<string, SearchIntentTerm>,
  term: string,
  weight: number,
  reason: SearchIntentTerm["reason"],
) {
  const normalized = normalizeSearchIntentText(term);
  if (!normalized) return;
  const existing = termMap.get(normalized);
  if (!existing || existing.weight < weight) {
    termMap.set(normalized, { term: normalized, weight, reason });
  }
}

function flattenCategories(
  categories: SearchCategoryNode[],
  depth = 0,
): Array<{ category: SearchCategoryNode; depth: number }> {
  return categories.flatMap((category) => [
    { category, depth },
    ...flattenCategories(category.children ?? [], depth + 1),
  ]);
}
