import { formatCurrencyTRY, formatNumberTR } from "@/lib/formatters";
import type { MarketIntelligence } from "@/lib/market-intelligence";
import { calculateMarketStats } from "@/lib/price-insights";

// Search-facing copy for the landing pages (model, category, brand, city).
// Titles follow how people actually search ("iPhone 15 ikinci el fiyatları"),
// descriptions and FAQ answers quote live numbers so every page is unique.

const SITE_NAME = "2ElBul";

/** A page with fewer listings than this is thin content: kept reachable but not indexed. */
export const MIN_INDEXABLE_LISTING_COUNT = 1;

export type LandingKind = "product" | "category" | "brand" | "city";

/** Live market numbers a landing page is written from. */
export type LandingPriceSnapshot = {
  listingCount: number;
  sourceCount: number;
  minPrice: number | null;
  maxPrice: number | null;
  averagePrice: number | null;
};

export type LandingFaqItem = {
  question: string;
  answer: string;
};

export type FaqPageJsonLd = {
  "@context": "https://schema.org";
  "@type": "FAQPage";
  "@id": string;
  mainEntity: Array<{
    "@type": "Question";
    name: string;
    acceptedAnswer: { "@type": "Answer"; text: string };
  }>;
};

const MONTH_FORMATTER = new Intl.DateTimeFormat("tr-TR", {
  month: "long",
  year: "numeric",
  timeZone: "Europe/Istanbul",
});

/** "Ekim 2026": the freshness label shown in titles and headings. */
export function formatSeoPeriod(date: Date): string {
  const label = MONTH_FORMATTER.format(date);
  return label.charAt(0).toLocaleUpperCase("tr-TR") + label.slice(1);
}

export function isIndexableSnapshot(snapshot: Pick<LandingPriceSnapshot, "listingCount">): boolean {
  return snapshot.listingCount >= MIN_INDEXABLE_LISTING_COUNT;
}

export function snapshotFromMarketIntelligence(
  marketIntelligence: Pick<MarketIntelligence, "priceAnalysis" | "marketSummary">,
): LandingPriceSnapshot {
  return {
    listingCount: marketIntelligence.marketSummary.totalListingCount,
    sourceCount: marketIntelligence.marketSummary.sourceCount,
    minPrice: marketIntelligence.priceAnalysis.minPrice,
    maxPrice: marketIntelligence.priceAnalysis.maxPrice,
    averagePrice: marketIntelligence.priceAnalysis.averagePrice,
  };
}

/** Snapshot from a model's own listings; uses the same price statistics the product page shows. */
export function snapshotFromListings(
  listings: ReadonlyArray<{ price: number; source: string }>,
): LandingPriceSnapshot {
  const stats = calculateMarketStats(listings.map((listing) => listing.price));
  return {
    listingCount: listings.length,
    sourceCount: new Set(listings.map((listing) => listing.source)).size,
    minPrice: stats?.lowest ?? null,
    maxPrice: stats?.highest ?? null,
    averagePrice: stats?.average ?? null,
  };
}

/** The search phrase a page targets, e.g. "iPhone 15 ikinci el fiyatları". */
export function buildLandingKeyword(kind: LandingKind, name: string): string {
  switch (kind) {
    case "product":
      return `${name} ikinci el fiyatları`;
    case "category":
    case "brand":
      return `ikinci el ${name} fiyatları`;
    case "city":
      return `${name} ikinci el ilanları`;
  }
}

export function buildLandingTitle(kind: LandingKind, name: string, now: Date): string {
  const period = formatSeoPeriod(now);
  switch (kind) {
    case "product":
      return `${name} İkinci El Fiyatları (${period}) | ${SITE_NAME}`;
    case "category":
      return `İkinci El ${name} Fiyatları ve İlanları (${period}) | ${SITE_NAME}`;
    case "brand":
      return `İkinci El ${name} Fiyatları (${period}) | ${SITE_NAME}`;
    case "city":
      return `${name} İkinci El İlanları ve Fiyatları (${period}) | ${SITE_NAME}`;
  }
}

function hasPrices(snapshot: LandingPriceSnapshot): snapshot is LandingPriceSnapshot & {
  minPrice: number;
  maxPrice: number;
} {
  return (
    snapshot.listingCount > 0 &&
    typeof snapshot.minPrice === "number" &&
    snapshot.minPrice > 0 &&
    typeof snapshot.maxPrice === "number" &&
    snapshot.maxPrice > 0
  );
}

const GENERATED_PREFIX = "ikinci el";

/**
 * Sentence-case only the words we generate: names keep their own casing
 * ("iPhone 15" must not become "İPhone 15").
 */
function capitalize(text: string): string {
  return text.startsWith(GENERATED_PREFIX)
    ? text.charAt(0).toLocaleUpperCase("tr-TR") + text.slice(1)
    : text;
}

/** Visible heading for a landing page section, e.g. "İkinci el Telefon fiyatları". */
export function buildLandingHeading(kind: LandingKind, name: string): string {
  return capitalize(buildLandingKeyword(kind, name));
}

function formatPriceRange(minPrice: number, maxPrice: number): string {
  return minPrice === maxPrice
    ? formatCurrencyTRY(minPrice)
    : `${formatCurrencyTRY(minPrice)} ile ${formatCurrencyTRY(maxPrice)} arasında`;
}

function formatSourceCount(sourceCount: number): string {
  return sourceCount > 1 ? `${formatNumberTR(sourceCount)} platformdan` : "";
}

/** Meta description: the price range and listing count first, then what the page offers. */
export function buildLandingDescription(
  kind: LandingKind,
  name: string,
  snapshot: LandingPriceSnapshot,
): string {
  const keyword = capitalize(buildLandingKeyword(kind, name));

  if (!hasPrices(snapshot)) {
    return `${keyword}: şu an yayında ilan yok. ${SITE_NAME} farklı platformlardaki ilanları toplar; yeni ilanlar geldikçe fiyat aralığı ve piyasa analizi burada güncellenir.`;
  }

  const sources = formatSourceCount(snapshot.sourceCount);
  const listingText = `${sources ? `${sources} ` : ""}${formatNumberTR(snapshot.listingCount)} ilan`;
  const average =
    snapshot.averagePrice && snapshot.averagePrice > 0
      ? `, ortalama ${formatCurrencyTRY(snapshot.averagePrice)}`
      : "";
  const offer =
    kind === "product"
      ? "En ucuz ilanlar, fiyat geçmişi ve fırsat analizi."
      : "En ucuz ilanlar, popüler modeller ve fırsatlar.";

  return `${keyword} ${formatPriceRange(snapshot.minPrice, snapshot.maxPrice)}${average}. ${listingText} karşılaştırıldı. ${offer}`;
}

/** Visible summary paragraph that mirrors the meta description in full sentences. */
export function buildLandingIntro(
  kind: LandingKind,
  name: string,
  snapshot: LandingPriceSnapshot,
  now: Date,
): string {
  const period = formatSeoPeriod(now);
  const keyword = buildLandingKeyword(kind, name);

  if (!hasPrices(snapshot)) {
    return `${period} itibarıyla ${keyword} için yayında ilan bulunmuyor. ${SITE_NAME} ikinci el platformlarını düzenli olarak tarar; yeni ilan geldiğinde fiyat aralığı ve ortalama burada otomatik güncellenir.`;
  }

  const sources = formatSourceCount(snapshot.sourceCount);
  const average =
    snapshot.averagePrice && snapshot.averagePrice > 0
      ? ` Piyasa ortalaması ${formatCurrencyTRY(snapshot.averagePrice)}.`
      : "";

  return `${period} itibarıyla ${keyword} ${formatPriceRange(snapshot.minPrice, snapshot.maxPrice)}. Bu aralık ${sources ? `${sources} toplanan ` : ""}${formatNumberTR(snapshot.listingCount)} güncel ilana dayanıyor; aynı ilan birden fazla sitede yayındaysa bir kez sayılır.${average}`;
}

/** Questions people ask about second-hand prices, answered from live data. */
export function buildLandingFaqItems(
  kind: LandingKind,
  name: string,
  snapshot: LandingPriceSnapshot,
): LandingFaqItem[] {
  const keyword = buildLandingKeyword(kind, name);
  const subject = kind === "city" ? `${name} ilanlarında` : `${name} için`;
  const priced = hasPrices(snapshot);
  const listingText = `${formatNumberTR(snapshot.listingCount)} ilan`;

  const priceQuestion =
    kind === "city" ? `${name} ikinci el fiyatları ne durumda?` : `${capitalize(keyword)} ne kadar?`;
  const priceAnswer = priced
    ? `Şu an ${listingText} üzerinden ${keyword} ${formatPriceRange(snapshot.minPrice, snapshot.maxPrice)}${
        snapshot.averagePrice && snapshot.averagePrice > 0
          ? `; ortalama fiyat ${formatCurrencyTRY(snapshot.averagePrice)}`
          : ""
      }. Rakamlar yeni ilanlarla birlikte güncellenir.`
    : `${capitalize(subject)} şu an yayında ilan yok. Yeni ilanlar geldikçe fiyat aralığı burada güncellenir.`;

  const cheapestAnswer = priced
    ? `${capitalize(subject)} en düşük fiyatlı ilan ${formatCurrencyTRY(snapshot.minPrice)}. Piyasa ortalamasının çok altındaki ilanları "Şüpheli ucuz" olarak işaretliyoruz; satın almadan önce satıcıyı ve ürünü mutlaka kontrol edin.`
    : `${capitalize(subject)} henüz fiyat verisi yok. Fiyat alarmı kurarak uygun ilan geldiğinde haberdar olabilirsiniz.`;

  const sourceAnswer =
    snapshot.sourceCount > 0
      ? `${capitalize(subject)} ${formatNumberTR(snapshot.sourceCount)} farklı platformdaki ilanlar karşılaştırılıyor. Aynı ilan birden fazla sitede yayındaysa tek ilan olarak sayılır, böylece ortalama şişmez.`
      : `${SITE_NAME} farklı ikinci el platformlarındaki ilanları tek yerde toplar ve aynı ilanı birden fazla kez saymaz.`;

  const followAnswer =
    kind === "product"
      ? `İlanlar düzenli olarak taranır ve sayfa birkaç dakikada bir yenilenir. ${name} fiyatı düştüğünde haberdar olmak için ürünü takip edebilir veya hedef fiyatınızla fiyat alarmı kurabilirsiniz.`
      : `İlanlar düzenli olarak taranır ve sayfa birkaç dakikada bir yenilenir. İlgilendiğiniz modelin sayfasından ürünü takip edebilir veya fiyat alarmı kurabilirsiniz.`;

  return [
    { question: priceQuestion, answer: priceAnswer },
    {
      question:
        kind === "city" ? `${name} ilanlarında en ucuz fiyat ne kadar?` : `En ucuz ikinci el ${name} kaç TL?`,
      answer: cheapestAnswer,
    },
    { question: "Fiyatlar hangi platformlardan toplanıyor?", answer: sourceAnswer },
    { question: "Fiyatlar ne sıklıkla güncelleniyor?", answer: followAnswer },
  ];
}

export function buildFaqPageJsonLd(pageUrl: string, items: LandingFaqItem[]): FaqPageJsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${pageUrl}#faq`,
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

/** Path of the all-models price list landing page. */
export const PRICE_LIST_PATH = "/ikinci-el-fiyatlari";

/** Category names quoted in the price list description. */
const PRICE_LIST_DESCRIPTION_CATEGORY_LIMIT = 4;

export function buildPriceListTitle(now: Date): string {
  return `İkinci El Fiyat Listesi (${formatSeoPeriod(now)}) | ${SITE_NAME}`;
}

export function buildPriceListDescription({
  modelCount,
  listingCount,
  categoryNames,
}: {
  modelCount: number;
  listingCount: number;
  categoryNames: string[];
}): string {
  if (modelCount === 0) {
    return `Güncel ikinci el fiyat listesi: ${SITE_NAME} farklı platformlardaki ilanları toplar; ilanlar geldikçe modellerin en düşük ve ortalama fiyatları burada listelenir.`;
  }
  const categories = categoryNames.slice(0, PRICE_LIST_DESCRIPTION_CATEGORY_LIMIT).join(", ");
  return `${formatNumberTR(modelCount)} modelin güncel ikinci el fiyatları: en düşük fiyat, piyasa ortalaması ve ilan sayısı. ${categories ? `${categories} ve daha fazlası; ` : ""}${formatNumberTR(listingCount)} ilandan derlendi.`;
}
