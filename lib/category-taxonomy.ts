import { normalizeCategoryText as newNormalizeCategoryText } from "./normalization";

export type CategoryNode = {
  id: string;
  label: string;
  aliases: string[];
  keywords: string[];
  children?: CategoryNode[];
  sourceHints?: string[];
  priority?: number;
};

export type CategoryMatch = {
  category: CategoryNode;
  breadcrumbs: CategoryNode[];
  depth: number;
  matchType: "category" | "alias" | "keyword";
  matchedTerm: string;
};

export type ExpandedTaxonomyQuery = {
  query: string;
  normalizedQuery: string;
  matches: CategoryMatch[];
  terms: string[];
  label: string | null;
  isBroadCategory: boolean;
};

export const CATEGORY_TAXONOMY: CategoryNode[] = [
  {
    id: "vehicles",
    label: "Vasıta",
    aliases: ["vasıta", "vasita", "araç", "arac", "taşıt", "tasit"],
    keywords: ["araba", "otomobil", "oto", "motosiklet", "motor", "scooter", "suv", "pickup"],
    priority: 95,
    children: [
      node("vehicles.car", "Otomobil", ["araba", "oto"], ["otomobil", "araç", "arac", "volkswagen", "bmw", "mercedes", "audi", "ford", "renault", "fiat", "toyota", "honda", "opel", "peugeot", "hyundai", "kia"]),
      node("vehicles.suv", "Arazi / SUV / Pickup", ["suv", "pickup", "arazi aracı", "arazi araci"], ["jeep", "4x4", "dacia duster", "range rover"]),
      node("vehicles.motorcycle", "Motosiklet", ["motosiklet", "motor"], ["scooter", "vespa", "enduro", "naked", "chopper", "yamaha", "honda motor"]),
      node("vehicles.minivan", "Minivan / Panelvan", ["minivan", "panelvan"], ["doblo", "connect", "transporter", "caddy"]),
      node("vehicles.commercial", "Ticari Araç", ["ticari araç", "ticari arac"], ["kamyonet", "minibüs", "minibus", "panelvan"]),
      node("vehicles.electric", "Elektrikli Araç", ["elektrikli araç", "elektrikli arac"], ["tesla", "togg", "elektrikli oto"]),
      node("vehicles.rental", "Kiralık Araç", ["kiralık araç", "kiralik arac"], ["rent a car", "günlük araç", "gunluk arac"]),
      node("vehicles.boat", "Deniz Aracı", ["deniz aracı", "deniz araci"], ["tekne", "yat", "bot", "jetski"]),
      node("vehicles.caravan", "Karavan", ["karavan"], ["çekme karavan", "cekme karavan", "motokaravan"]),
      node("vehicles.classic", "Klasik Araç", ["klasik araç", "klasik arac"], ["klasik oto", "antika araba"]),
      node("vehicles.damaged", "Hasarlı Araç", ["hasarlı araç", "hasarli arac"], ["pert", "kazalı", "kazali", "ağır hasarlı", "agir hasarli"]),
      node("vehicles.accessories", "Araç Aksesuarları", ["araç aksesuar", "arac aksesuar"], ["jant", "lastik", "far", "tampon", "oto teyp"]),
      node("vehicles.motorcycle-equipment", "Motosiklet Ekipmanları", ["motosiklet ekipman"], ["kask", "mont", "eldiven", "dizlik"]),
    ],
  },
  {
    id: "real-estate",
    label: "Emlak",
    aliases: ["emlak", "gayrimenkul"],
    keywords: ["ev", "daire", "konut", "villa", "rezidans", "kiralık", "kiralik", "satılık", "satilik", "arsa", "tarla", "işyeri", "isyeri", "ofis", "dükkan", "dukkan", "mağaza", "magaza"],
    priority: 92,
    children: [
      node("real-estate.home", "Konut", ["ev", "konut"], ["daire", "villa", "rezidans", "apart", "yazlık", "yazlik"]),
      node("real-estate.rental-home", "Kiralık Konut", ["kiralık ev", "kiralik ev", "kiralık konut", "kiralik konut"], ["kiralık daire", "kiralik daire", "apart"]),
      node("real-estate.sale-home", "Satılık Konut", ["satılık ev", "satilik ev", "satılık konut", "satilik konut"], ["satılık daire", "satilik daire", "villa"]),
      node("real-estate.land", "Arsa", ["arsa"], ["tarla", "bağ", "bag", "bahçe", "bahce", "imar"]),
      node("real-estate.workplace", "İş Yeri", ["işyeri", "isyeri", "iş yeri", "is yeri"], ["ofis", "dükkan", "dukkan", "mağaza", "magaza", "depo"]),
      node("real-estate.daily-rental", "Günlük Kiralık", ["günlük kiralık", "gunluk kiralik"], ["apart", "villa kiralık", "villa kiralik"]),
      node("real-estate.projects", "Konut Projeleri", ["konut projesi"], ["sıfır daire", "sifir daire", "proje"]),
      node("real-estate.building", "Komple Bina", ["komple bina"], ["bina", "apartman"]),
      node("real-estate.timeshare", "Devre Mülk", ["devre mülk", "devre mulk"], ["tatil hakkı", "tatil hakki"]),
      node("real-estate.touristic", "Turistik Tesis", ["turistik tesis"], ["otel", "pansiyon", "butik otel"]),
      node("real-estate.field-garden", "Tarla / Bağ / Bahçe", ["tarla", "bağ", "bag", "bahçe", "bahce"], ["hobi bahçesi", "hobi bahcesi"]),
    ],
  },
  {
    id: "shopping",
    label: "İkinci El ve Sıfır Alışveriş",
    aliases: ["alışveriş", "alisveris", "ikinci el", "sıfır", "sifir", "elektronik", "ev eşyası", "ev esyasi"],
    keywords: ["telefon", "bilgisayar", "tablet", "kamera", "tv", "konsol", "mobilya", "beyaz eşya", "beyaz esya"],
    priority: 90,
    children: [
      node("shopping.phone", "Cep Telefonu", ["telefon", "cep telefonu", "akıllı telefon", "akilli telefon", "smartphone"], ["iphone", "apple", "samsung", "galaxy", "xiaomi", "redmi", "poco", "oppo", "vivo", "honor", "huawei", "realme", "general mobile"], ["telefon"]),
      node("shopping.phone-accessories", "Cep Telefonu Aksesuarları", ["telefon aksesuar"], ["kılıf", "kilif", "şarj", "sarj", "powerbank", "ekran koruyucu"]),
      node("shopping.computer", "Bilgisayar", ["bilgisayar", "pc", "oyuncu bilgisayarı", "oyuncu bilgisayari"], ["laptop", "notebook", "macbook", "imac", "masaüstü", "masaustu", "gaming pc", "lenovo", "thinkpad", "ideapad", "asus", "hp", "dell", "acer", "monster", "msi", "victus", "pavilion"]),
      node("shopping.computer-parts", "Bilgisayar Parçaları", ["bilgisayar parçası", "bilgisayar parcasi", "ekran kartı", "ekran karti"], ["işlemci", "islemci", "anakart", "ram", "ssd", "hdd", "kasa", "psu", "güç kaynağı", "guc kaynagi", "soğutucu", "sogutucu", "fan", "intel", "amd", "ryzen", "i3", "i5", "i7", "i9", "rtx", "gtx", "rx", "nvidia", "geforce", "radeon"]),
      node("shopping.tablet", "Tablet", ["tablet"], ["ipad", "galaxy tab", "tab s", "lenovo tab", "huawei matepad", "xiaomi pad"]),
      node("shopping.camera", "Fotoğraf / Kamera", ["fotoğraf", "fotograf", "kamera"], ["canon", "nikon", "sony alpha", "fujifilm", "gopro", "lens", "dslr", "mirrorless"]),
      node("shopping.tv-audio", "TV / Görüntü / Ses", ["tv", "televizyon", "ses sistemi"], ["smart tv", "oled", "qled", "led tv", "monitor", "monitör", "monitor", "soundbar", "hoparlör", "hoparlor", "kulaklık", "kulaklik", "airpods", "buds", "jbl", "sony", "marshall"]),
      node("shopping.home-electronics", "Ev Elektroniği", ["ev elektroniği", "ev elektronigi"], ["robot süpürge", "robot supurge", "akıllı ev", "akilli ev"]),
      node("shopping.small-appliances", "Elektrikli Ev Aletleri", ["elektrikli ev aletleri"], ["süpürge", "supurge", "robot süpürge", "robot supurge", "ütü", "utu", "kahve makinesi", "blender", "tost makinesi", "airfryer", "mikrodalga"]),
      node("shopping.white-goods", "Beyaz Eşya", ["beyaz eşya", "beyaz esya"], ["buzdolabı", "buzdolabi", "çamaşır makinesi", "camasir makinesi", "bulaşık makinesi", "bulasik makinesi", "kurutma makinesi", "fırın", "firin", "ocak", "derin dondurucu"]),
      node("shopping.furniture", "Mobilya", ["mobilya"], ["koltuk", "masa", "sandalye", "yatak", "dolap", "sehpa"]),
      node("shopping.decoration", "Ev Dekorasyon", ["dekorasyon"], ["halı", "hali", "perde", "avize", "ayna"]),
      node("shopping.garden-diy", "Bahçe / Yapı Market", ["bahçe", "bahce", "yapı market", "yapi market"], ["matkap", "hırdavat", "hirdavat", "çim biçme", "cim bicme"]),
      node("shopping.clothing", "Giyim / Aksesuar", ["giyim", "aksesuar"], ["mont", "ayakkabı", "ayakkabi", "elbise", "çanta", "canta", "sneaker"]),
      node("shopping.watch", "Saat", ["saat"], ["kol saati", "akıllı saat", "akilli saat", "apple watch", "galaxy watch"]),
      node("shopping.jewelry", "Takı / Mücevher", ["takı", "taki", "mücevher", "mucevher"], ["yüzük", "yuzuk", "kolye", "bileklik", "küpe", "kupe"]),
      node("shopping.parent-baby", "Anne / Bebek", ["bebek", "anne bebek"], ["bebek arabası", "bebek arabasi", "mama sandalyesi", "beşik", "besik", "oto koltuğu", "oto koltugu"]),
      node("shopping.toys", "Oyuncak", ["oyuncak"], ["lego", "puzzle", "figür", "figur", "akülü araba", "akulu araba"]),
      node("shopping.hobby", "Hobi", ["hobi"], ["drone", "maket", "koleksiyon", "kamp"]),
      node("shopping.game-console", "Oyun / Konsol", ["oyun konsolu", "konsol", "playstation"], ["ps5", "ps4", "xbox", "series s", "series x", "nintendo", "switch", "dualsense"], ["playstation", "konsol"]),
      node("shopping.gaming-gear", "Oyuncu Donanımları", ["oyuncu ekipmanı", "oyuncu ekipmani"], ["gaming mouse", "mekanik klavye", "kulaklık", "kulaklik", "monitör", "monitor"]),
      node("shopping.sport-outdoor", "Spor / Outdoor", ["spor", "outdoor"], ["bisiklet", "koşu bandı", "kosu bandi", "dambıl", "dambil", "fitness", "kamp"]),
      node("shopping.books-media", "Kitap / Dergi / Film", ["kitap", "dergi", "film"], ["roman", "ders kitabı", "ders kitabi", "çizgi roman", "cizgi roman", "dvd"]),
      node("shopping.music", "Müzik Aletleri", ["müzik aleti", "muzik aleti"], ["gitar", "piyano", "keman", "bateri", "amfi", "org"]),
      node("shopping.personal-care", "Kişisel Bakım / Kozmetik", ["kişisel bakım", "kisisel bakim", "kozmetik"], ["parfüm", "parfum", "saç kurutma", "sac kurutma", "tıraş", "tiras"]),
      node("shopping.medical", "Medikal Ürünler", ["medikal"], ["tekerlekli sandalye", "hasta yatağı", "hasta yatagi", "tansiyon aleti"]),
      node("shopping.kickscooter", "Kickscooter", ["kickscooter", "elektrikli scooter"], ["scooter", "xiaomi scooter"]),
      node("shopping.bicycle", "Bisiklet", ["bisiklet"], ["dağ bisikleti", "dag bisikleti", "yol bisikleti", "bmx"]),
      node("shopping.collectibles", "Koleksiyon", ["koleksiyon"], ["plak", "pul", "antik", "figür", "figur", "kart"]),
      node("shopping.office", "Ofis / Kırtasiye", ["ofis", "kırtasiye", "kirtasiye"], ["yazıcı", "yazici", "masa", "ofis sandalyesi"]),
      node("shopping.smart-watch", "Akıllı Saat", ["akıllı saat", "akilli saat"], ["apple watch", "galaxy watch", "huawei watch", "amazfit", "garmin"]),
      node("shopping.headphones", "Kulaklık", ["kulaklık", "kulaklik", "headphone"], ["airpods", "airpods pro", "galaxy buds", "jbl", "sony wh", "marshall", "anker"]),
      node("shopping.monitor", "Monitör", ["monitör", "monitor"], ["gaming monitor", "oyuncu monitörü", "oyuncu monitoru", "144hz", "165hz", "240hz", "oled monitor"]),
      node("shopping.network", "Modem / Ağ Ürünleri", ["modem", "ağ ürünü", "ag urunu"], ["router", "wifi", "mesh", "access point", "switch", "tp link", "keenetic"]),
      node("shopping.printer", "Yazıcı / Tarayıcı", ["yazıcı", "yazici", "tarayıcı", "tarayici"], ["lazer yazıcı", "lazer yazici", "inkjet", "epson", "canon printer", "hp yazıcı"]),
      node("shopping.security-camera", "Güvenlik Kamera", ["güvenlik kamera", "guvenlik kamera"], ["ip kamera", "kamera kayıt", "kamera kayit", "nvr", "dvr", "xiaomi kamera"]),
      node("shopping.air-conditioner", "Klima / Isıtma", ["klima", "ısıtma", "isitma"], ["split klima", "mobil klima", "kombi", "ısıtıcı", "isitici", "vantilatör", "vantilator"]),
      node("shopping.tools", "El Aletleri", ["el aleti", "el aletleri"], ["matkap", "şarjlı matkap", "sarjli matkap", "hilti", "testere", "taşlama", "taslama"]),
      node("shopping.pet-supplies", "Evcil Hayvan Ürünleri", ["evcil hayvan ürünü", "evcil hayvan urunu"], ["kedi maması", "kedi mamasi", "köpek maması", "kopek mamasi", "tasma", "kedi kumu"]),
    ],
  },
  {
    id: "parts-accessories",
    label: "Yedek Parça / Aksesuar / Donanım",
    aliases: ["yedek parça", "yedek parca", "aksesuar", "donanım", "donanim"],
    keywords: ["jant", "lastik", "far", "tampon", "ekran kartı", "ekran karti", "ram", "ssd"],
    children: [
      node("parts.auto-equipment", "Otomotiv Ekipmanları", ["otomotiv ekipman", "oto ekipman"], ["jant", "lastik", "far", "tampon", "oto teyp", "multimedya", "park sensörü", "park sensoru"]),
      node("parts.motorcycle-equipment", "Motosiklet Ekipmanları", ["motosiklet ekipman"], ["kask", "mont", "eldiven", "dizlik", "çanta", "canta", "intercom"]),
      node("parts.boat-equipment", "Deniz Aracı Ekipmanları", ["deniz aracı ekipman", "deniz araci ekipman"], ["tekne motoru", "can yeleği", "can yelegi", "çapa", "capa", "marine"]),
      node("parts.computer-hardware", "Bilgisayar Donanımı", ["bilgisayar donanım", "bilgisayar donanim"], ["ekran kartı", "ekran karti", "işlemci", "islemci", "anakart", "ram", "ssd", "hdd", "psu"]),
      node("parts.phone-parts", "Telefon Yedek Parça", ["telefon yedek parça", "telefon yedek parca"], ["iphone ekran", "batarya", "kamera", "şarj soketi", "sarj soketi", "kasa"]),
      node("parts.home-appliance-parts", "Beyaz Eşya Yedek Parça", ["beyaz eşya yedek parça", "beyaz esya yedek parca"], ["buzdolabı motoru", "camasir kart", "rezistans", "pompa"]),
    ],
  },
  {
    id: "industrial",
    label: "İş Makineleri ve Sanayi",
    aliases: ["iş makinesi", "is makinesi", "iş makineleri", "is makineleri", "sanayi"],
    keywords: ["forklift", "jeneratör", "jenerator", "kompresör", "kompresor", "tarım makinesi", "tarim makinesi"],
    children: [
      node("industrial.agriculture", "Tarım Makineleri", ["tarım makineleri", "tarim makineleri"], ["traktör", "traktor", "pulluk", "biçerdöver", "bicerdöver", "bicerdover"]),
      node("industrial.machinery", "İş Makineleri", ["iş makinesi", "is makinesi"], ["kepçe", "kepce", "ekskavatör", "ekskavator", "vinç", "vinc"]),
      node("industrial.equipment", "Sanayi Ekipmanları", ["sanayi ekipmanı", "sanayi ekipmani"], ["cnc", "pres", "torna"]),
      node("industrial.energy", "Elektrik / Enerji", ["enerji", "elektrik"], ["trafo", "panel", "solar"]),
      node("industrial.forklift", "Forklift", ["forklift"], ["istif makinesi", "transpalet"]),
      node("industrial.generator", "Jeneratör", ["jeneratör", "jenerator"], ["benzinli jeneratör", "dizel jeneratör"]),
      node("industrial.compressor", "Kompresör", ["kompresör", "kompresor"], ["hava kompresörü", "hava kompresoru"]),
    ],
  },
  {
    id: "life-services",
    label: "Diğer / Yaşam / Hizmetler",
    aliases: ["hizmet", "yaşam", "yasam", "diğer", "diger"],
    keywords: ["özel ders", "ozel ders", "usta", "yardımcı", "yardimci", "iş ilanı", "is ilani"],
    children: [
      node("life-services.private-lesson", "Özel Ders", ["özel ders", "ozel ders"], ["matematik", "ingilizce", "öğretmen", "ogretmen"]),
      node("life-services.services", "Ustalar ve Hizmetler", ["usta", "hizmet"], ["tesisat", "nakliye", "boya", "tamir", "temizlik", "montaj"]),
      node("life-services.helpers", "Yardımcı Arayanlar", ["yardımcı", "yardimci"], ["bakıcı", "bakici", "temizlikçi", "temizlikci", "hasta bakıcı", "hasta bakici"]),
      node("life-services.jobs", "İş İlanları", ["iş ilanı", "is ilani"], ["eleman", "personel", "part time", "tam zamanlı", "tam zamanli"]),
      node("life-services.event", "Etkinlik / Organizasyon", ["organizasyon", "etkinlik"], ["düğün", "dugun", "fotoğrafçı", "fotografci"]),
      node("life-services.course", "Kurs / Eğitim", ["kurs", "eğitim", "egitim"], ["yazılım kursu", "yazilim kursu", "dil kursu"]),
    ],
  },
  {
    id: "animals",
    label: "Hayvanlar Alemi",
    aliases: ["hayvan", "hayvanlar", "pet"],
    keywords: ["kedi", "köpek", "kopek", "kuş", "kus", "akvaryum", "mama"],
    children: [
      node("animals.pets", "Evcil Hayvanlar", ["evcil hayvan"], ["kedi", "köpek", "kopek", "tavşan", "tavsan"]),
      node("animals.fish", "Akvaryum Balıkları", ["akvaryum", "balık", "balik"], ["japon balığı", "japon baligi", "lepistes"]),
      node("animals.bird", "Kuş", ["kuş", "kus"], ["muhabbet kuşu", "muhabbet kusu", "papağan", "papagan"]),
      node("animals.cat", "Kedi", ["kedi"], ["british", "scottish", "tekir"]),
      node("animals.dog", "Köpek", ["köpek", "kopek"], ["golden", "labrador", "poodle"]),
      node("animals.supplies", "Hayvan Ürünleri / Mama / Aksesuar", ["hayvan ürünü", "hayvan urunu", "mama"], ["kedi maması", "kopek maması", "tasma", "akvaryum filtre"]),
    ],
  },
];

export const normalizeCategoryText = newNormalizeCategoryText;

export function findCategoryMatches(query: string): CategoryMatch[] {
  const normalizedQuery = normalizeCategoryText(query);
  if (!normalizedQuery) return [];

  return flattenTaxonomy(CATEGORY_TAXONOMY)
    .map(({ node: category, breadcrumbs, depth }) => {
      const label = normalizeCategoryText(category.label);
      const id = normalizeCategoryText(category.id);
      const alias = category.aliases.find(
        (value) => normalizeCategoryText(value) === normalizedQuery,
      );
      const keyword = category.keywords.find(
        (value) => normalizeCategoryText(value) === normalizedQuery,
      );

      if (label === normalizedQuery || id === normalizedQuery) {
        return { category, breadcrumbs, depth, matchType: "category" as const, matchedTerm: category.label };
      }
      if (alias) {
        return { category, breadcrumbs, depth, matchType: "alias" as const, matchedTerm: alias };
      }
      if (keyword) {
        return { category, breadcrumbs, depth, matchType: "keyword" as const, matchedTerm: keyword };
      }
      return null;
    })
    .filter((match): match is CategoryMatch => match !== null)
    .sort((a, b) => matchRank(a) - matchRank(b));
}

export function expandQueryByTaxonomy(query: string): ExpandedTaxonomyQuery {
  const normalizedQuery = normalizeCategoryText(query);
  const matches = findCategoryMatches(query);
  const termMap = new Map<string, string>();

  addTerm(termMap, query);
  const bestMatch = matches[0] ?? null;

  if (bestMatch) {
    if (bestMatch.matchType === "keyword") {
      addTerm(termMap, bestMatch.category.label);
      for (const alias of bestMatch.category.aliases) addTerm(termMap, alias);
      for (const hint of bestMatch.category.sourceHints ?? []) addTerm(termMap, hint);
    } else {
      addNodeDeepTerms(termMap, bestMatch.category);
    }
  }

  return {
    query: query.trim().replace(/\s+/g, " "),
    normalizedQuery,
    matches,
    terms: [...termMap.values()],
    label: getSearchIntentLabel(query),
    isBroadCategory: isBroadCategoryQuery(query),
  };
}

export function getCategoryBreadcrumbs(categoryId: string) {
  const match = flattenTaxonomy(CATEGORY_TAXONOMY).find(
    ({ node }) => node.id === categoryId,
  );
  return match?.breadcrumbs.map((node) => node.label) ?? [];
}

export function getSearchIntentLabel(query: string) {
  const match = findCategoryMatches(query)[0];
  if (!match) return null;
  const label = match.category.label;
  return `${label} kategorisindeki ilgili ${match.category.id.startsWith("real-estate") ? "ilanlar" : "ürünler"} gösteriliyor.`;
}

export function isBroadCategoryQuery(query: string) {
  const match = findCategoryMatches(query)[0];
  if (!match) return false;
  return match.depth <= 1 && match.matchType !== "keyword";
}

export function getExpandedSearchTerms(query: string) {
  return expandQueryByTaxonomy(query).terms;
}

function node(
  id: string,
  label: string,
  aliases: string[],
  keywords: string[],
  sourceHints: string[] = [],
  children: CategoryNode[] = [],
): CategoryNode {
  return { id, label, aliases, keywords, sourceHints, children };
}

function addNodeDeepTerms(termMap: Map<string, string>, category: CategoryNode) {
  addTerm(termMap, category.label);
  for (const alias of category.aliases) addTerm(termMap, alias);
  for (const keyword of category.keywords) addTerm(termMap, keyword);
  for (const child of category.children ?? []) addNodeDeepTerms(termMap, child);
}

function addTerm(termMap: Map<string, string>, term: string) {
  const normalized = normalizeCategoryText(term);
  if (normalized) termMap.set(normalized, normalized);
}

function flattenTaxonomy(
  nodes: CategoryNode[],
  breadcrumbs: CategoryNode[] = [],
): Array<{ node: CategoryNode; breadcrumbs: CategoryNode[]; depth: number }> {
  return nodes.flatMap((node) => {
    const nextBreadcrumbs = [...breadcrumbs, node];
    return [
      { node, breadcrumbs: nextBreadcrumbs, depth: breadcrumbs.length },
      ...flattenTaxonomy(node.children ?? [], nextBreadcrumbs),
    ];
  });
}

function matchRank(match: CategoryMatch) {
  const typeRank =
    match.matchType === "category" ? 0 : match.matchType === "alias" ? 1 : 2;
  return typeRank * 100 + match.depth;
}
