import { cache } from "react";
import type { ConfidenceLevel } from "@/lib/confidence-engine";
import type { ListingCondition, ListingSource } from "@/lib/listings";
import { isMissingStatusColumn } from "@/lib/listing-status";
import { calculateProductIntelligence } from "@/lib/intelligence-engine";
import { buildMarketIntelligence, type MarketIntelligence, type MarketIntelligenceListing } from "@/lib/market-intelligence";
import { toConfidenceResult, toConfidenceLevel } from "@/lib/market-intelligence/helpers";
import { buildMarketPulse, type MarketPulse, type MarketPulseItem } from "@/lib/market-pulse";
import { formatBrandDisplayName, extractBrand, normalizeSearchText } from "@/lib/normalization";
import { createProductSlug } from "@/lib/product-slug";
import { getAbsoluteUrl } from "@/lib/site-url";
import { isPublicDemoListing, isPublicDemoProductName } from "@/lib/public-data-cleanup";
import { createSupabaseClient } from "@/lib/supabase";
import {
  buildProductDecisionInsight,
  resolveProductDetailDuplicateSummary,
} from "@/lib/product-detail";
import {
  buildOpportunityAnalysis,
  type OpportunityAnalysis,
} from "@/lib/opportunity-engine";
import type { DuplicateBatchSummary } from "@/lib/product-matcher";

export type CategoryRoute = {
  slug: string;
  label: string;
  shortDescription: string;
  longDescription: string;
  matchKeywords: string[];
  excludeKeywords: string[];
};

export type CategoryCatalogEntry = {
  slug: string;
  label: string;
  productCount: number;
  latestListingAt: string | null;
};

export type CategoryProductRecord = {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  createdAt: string | null;
};

export type CategorySearchEventRecord = {
  productId: string | number | null;
  createdAt: string | null;
};

export type CategorySearchDemandRecord = {
  query: string | null;
  normalizedQuery: string | null;
  createdAt: string | null;
};

export type CategoryListingRecord = {
  id: string;
  productId: string;
  productName: string;
  title: string;
  price: number;
  city: string;
  source: ListingSource;
  url: string;
  condition: ListingCondition;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string | null;
  confidenceScore: number | null;
  confidenceLevel: ConfidenceLevel | null;
};

export type CategoryBrandDistributionEntry = {
  brandSlug: string;
  brandName: string;
  productCount: number;
  listingCount: number;
  share: number;
};

export type CategoryFaqItem = {
  question: string;
  answer: string;
};

export type CategoryCollectionPageJsonLd = {
  "@context": "https://schema.org";
  "@type": "CollectionPage";
  name: string;
  description: string;
  url: string;
  about: {
    "@type": "Thing";
    name: string;
  };
  breadcrumb: {
    "@id": string;
  };
};

export type CategoryBreadcrumbJsonLd = {
  "@context": "https://schema.org";
  "@type": "BreadcrumbList";
  "@id": string;
  itemListElement: Array<{
    "@type": "ListItem";
    position: number;
    name: string;
    item: string;
  }>;
};

export type CategoryFaqJsonLd = {
  "@context": "https://schema.org";
  "@type": "FAQPage";
  "@id": string;
  mainEntity: Array<{
    "@type": "Question";
    name: string;
    acceptedAnswer: {
      "@type": "Answer";
      text: string;
    };
  }>;
};

export type CategoryItemListJsonLd = {
  "@context": "https://schema.org";
  "@type": "ItemList";
  "@id": string;
  name: string;
  itemListOrder: "https://schema.org/ItemListOrderDescending";
  itemListElement: Array<{
    "@type": "ListItem";
    position: number;
    name: string;
    url: string;
    item: {
      "@type": "Product";
      name: string;
      url: string;
    };
  }>;
};

export type CategoryJsonLdDocument =
  | CategoryCollectionPageJsonLd
  | CategoryBreadcrumbJsonLd
  | CategoryFaqJsonLd
  | CategoryItemListJsonLd;

export type CategoryPageData = {
  categorySlug: string;
  categoryName: string;
  categoryUrl: string;
  shortDescription: string;
  longDescription: string;
  productCount: number;
  listingCount: number;
  marketIntelligence: MarketIntelligence;
  opportunityAnalysis: OpportunityAnalysis;
  duplicateSummary: DuplicateBatchSummary;
  marketPulse: MarketPulse;
  topOpportunities: MarketPulseItem[];
  popularProducts: MarketPulseItem[];
  latestListings: CategoryListingRecord[];
  brandDistribution: CategoryBrandDistributionEntry[];
  faqItems: CategoryFaqItem[];
  jsonLd: CategoryJsonLdDocument[];
};

export const CATEGORY_ROUTES: CategoryRoute[] = [
  {
    slug: "telefon",
    label: "Telefon",
    shortDescription: "Cep telefonu ikinci el piyasa analizi",
    longDescription:
      "iPhone, Samsung Galaxy, Xiaomi ve diğer akıllı telefonlar için ikinci el fiyat rehberi, fırsat sinyalleri ve kaynak dağılımı.",
    matchKeywords: [
      "telefon",
      "cep telefonu",
      "akilli telefon",
      "smartphone",
      "iphone",
      "samsung galaxy s",
      "samsung galaxy a",
      "samsung galaxy z",
      "xiaomi",
      "redmi",
      "poco",
      "oppo",
      "vivo",
      "honor",
      "huawei",
      "realme",
      "general mobile",
      "oneplus",
      "google pixel",
    ],
    excludeKeywords: ["tablet", "ipad", "watch", "saat", "kulaklik", "airpods", "konsol", "laptop", "bilgisayar"],
  },
  {
    slug: "bilgisayar",
    label: "Bilgisayar",
    shortDescription: "Laptop ve masaüstü bilgisayar ikinci el analizi",
    longDescription:
      "MacBook, laptop, notebook ve masaüstü bilgisayarlar için ikinci el fiyat rehberi, fırsat sinyalleri ve piyasa istihbaratı.",
    matchKeywords: [
      "bilgisayar",
      "laptop",
      "notebook",
      "macbook",
      "imac",
      "masaustu",
      "oyuncu bilgisayari",
      "gaming pc",
      "thinkpad",
      "ideapad",
      "victus",
      "pavilion",
      "monster",
      "asus rog",
      "lenovo",
      "dell",
      "hp laptop",
      "acer",
      "chromebook",
    ],
    excludeKeywords: ["tablet", "ipad", "telefon", "iphone", "konsol", "ekran karti", "ekran kartı", "monitor", "monitoru"],
  },
  {
    slug: "konsol",
    label: "Oyun Konsolu",
    shortDescription: "PlayStation, Xbox ve Nintendo ikinci el analizi",
    longDescription:
      "PlayStation 5, Xbox, Nintendo Switch ve oyun konsolları için ikinci el fiyat rehberi, fırsat sinyalleri ve piyasa istihbaratı.",
    matchKeywords: [
      "konsol",
      "oyun konsolu",
      "playstation",
      "ps5",
      "ps4",
      "xbox",
      "series s",
      "series x",
      "nintendo",
      "switch",
      "dualsense",
      "wii",
    ],
    excludeKeywords: ["telefon", "iphone", "laptop", "bilgisayar", "tablet", "nintendo switch lite joy"],
  },
  {
    slug: "tv-ses",
    label: "TV ve Ses Sistemleri",
    shortDescription: "Televizyon, ses sistemi ve kulaklık ikinci el analizi",
    longDescription:
      "Smart TV, OLED, QLED, soundbar, hoparlör ve kulaklık için ikinci el fiyat rehberi, fırsat sinyalleri ve piyasa istahbaratı.",
    matchKeywords: [
      "tv",
      "televizyon",
      "smart tv",
      "oled",
      "qled",
      "led tv",
      "ses sistemi",
      "soundbar",
      "hoparlor",
      "hoparlör",
      "kulaklik",
      "kulaklık",
      "airpods",
      "galaxy buds",
      "jbl",
      "marshall",
      "monitor",
      "monitoru",
      "ekran",
    ],
    excludeKeywords: ["telefon", "iphone", "laptop", "bilgisayar", "konsol", "playstation", "ps5", "tablet"],
  },
  {
    slug: "arac",
    label: "Araç",
    shortDescription: "Otomobil, motosiklet ve araç ikinci el analizi",
    longDescription:
      "Otomobil, motosiklet, SUV ve ticari araçlar için ikinci el fiyat rehberi, fırsat sinyalleri ve piyasa istihbaratı.",
    matchKeywords: [
      "arac",
      "vasita",
      "otomobil",
      "araba",
      "motosiklet",
      "motor scooter",
      "suv",
      "pickup",
      "minivan",
      "panelvan",
      "ticari arac",
      "elektrikli arac",
      "karavan",
      "klasik arac",
      "hasarli arac",
    ],
    excludeKeywords: ["telefon", "laptop", "emlak", "daire", "arsa", "yedek parca", "ekran karti"],
  },
  {
    slug: "emlak",
    label: "Emlak",
    shortDescription: "Konut, arsa ve iş yeri ikinci el analizi",
    longDescription:
      "Konut, daire, villa, arsa ve iş yerleri için ikinci el fiyat rehberi, fırsat sinyalleri ve piyasa istihbaratı.",
    matchKeywords: [
      "emlak",
      "konut",
      "daire",
      "villa",
      "arsa",
      "tarla",
      "isyeri",
      "is yeri",
      "ofis",
      "dukkan",
      "magaza",
      "kiralik",
      "satilik",
      "rezidans",
      "devre mulk",
    ],
    excludeKeywords: ["arac", "otomobil", "telefon", "laptop", "yedek parca"],
  },
  {
    slug: "yedek-parca",
    label: "Yedek Parça ve Donanım",
    shortDescription: "Otomotiv, telefon ve bilgisayar yedek parça analizi",
    longDescription:
      "Otomotiv ekipmanları, telefon yedek parça, ekran kartı, işlemci ve bilgisayar donanımı için ikinci el fiyat rehberi.",
    matchKeywords: [
      "yedek parca",
      "yedek parça",
      "ekran karti",
      "ekran kartı",
      "islemci",
      "anakart",
      "ram",
      "ssd",
      "hdd",
      "psu",
      "jant",
      "lastik",
      "far",
      "tampon",
      "oto teyp",
      "batarya",
      "sarj soketi",
      "rezistans",
    ],
    excludeKeywords: ["telefon", "iphone", "laptop", "bilgisayar", "arac ", "otomobil", "emlak"],
  },
  {
    slug: "ev-yasam",
    label: "Ev ve Yaşam",
    shortDescription: "Beyaz eşya, mobilya ve ev elektroniği analizi",
    longDescription:
      "Beyaz eşya, mobilya, klima, süpürge, ev elektroniği ve ev dekorasyonu için ikinci el fiyat rehberi ve piyasa istihbaratı.",
    matchKeywords: [
      "beyaz esya",
      "beyaz eşya",
      "mobilya",
      "klima",
      "supurge",
      "süpürge",
      "camasir",
      "çamaşır",
      "bulasik",
      "bulaşık",
      "firin",
      "fırın",
      "ocak",
      "utu",
      "ütü",
      "dekorasyon",
      "hali",
      "halı",
      "perde",
      "avize",
      "buzdolabi",
      "buzdolabı",
      "derin dondurucu",
      "kahve makinesi",
      "blender",
      "airfryer",
      "mikrodalga",
    ],
    excludeKeywords: ["telefon", "iphone", "laptop", "bilgisayar", "konsol", "tv", "arac", "emlak"],
  },
];

const CATEGORY_CATALOG_PAGE_SIZE = 1000;
const CATEGORY_LISTING_BATCH_SIZE = 100;
const SEARCH_LIMIT = 1000;

export function findCategoryRoute(slug: string): CategoryRoute | null {
  const normalized = normalizeCategorySlug(slug);
  if (!normalized) return null;
  return CATEGORY_ROUTES.find((route) => route.slug === normalized) ?? null;
}

export function normalizeCategorySlug(input: string): string {
  return createProductSlug(input);
}

export function matchProductToRoute(
  productName: string,
  productCategory: string | null,
  route: CategoryRoute,
): boolean {
  const normalizedCategory = normalizeSearchText(productCategory ?? "");
  const normalizedName = normalizeSearchText(productName ?? "");

  if (
    route.excludeKeywords.some((keyword) => {
      const normalizedKeyword = normalizeSearchText(keyword);
      return (
        (normalizedCategory && normalizedCategory.includes(normalizedKeyword)) ||
        normalizedName.includes(normalizedKeyword)
      );
    })
  ) {
    return false;
  }

  return route.matchKeywords.some((keyword) => {
    const normalizedKeyword = normalizeSearchText(keyword);
    return (
      (normalizedCategory && normalizedCategory.includes(normalizedKeyword)) ||
      normalizedName.includes(normalizedKeyword)
    );
  });
}

export const getCategoryCatalog = cache(async (): Promise<CategoryCatalogEntry[]> => {
  const supabase = createSupabaseClient();
  if (!supabase) {
    return CATEGORY_ROUTES.map((route) => ({
      slug: route.slug,
      label: route.label,
      productCount: 0,
      latestListingAt: null,
    }));
  }

  const products = await fetchAllProducts(supabase);
  const listings = await fetchAllListingsForCatalog(supabase, products);

  return CATEGORY_ROUTES.map((route) => {
    const routeProducts = products.filter((product) =>
      matchProductToRoute(product.name, product.category, route),
    );
    const routeProductIds = new Set(routeProducts.map((product) => product.id));
    const routeListings = listings.filter((listing) =>
      routeProductIds.has(listing.productId),
    );
    const latestListingAt = routeListings.reduce<string | null>(
      (latest, listing) => chooseLatestTimestamp(latest, listing.updatedAt ?? listing.createdAt),
      null,
    );

    return {
      slug: route.slug,
      label: route.label,
      productCount: routeProducts.length,
      latestListingAt,
    };
  });
});

export const getCategoryPageData = cache(
  async (categorySlug: string): Promise<CategoryPageData | null> => {
    const route = findCategoryRoute(categorySlug);
    if (!route) return null;

    const supabase = createSupabaseClient();
    if (!supabase) {
      return buildEmptyCategoryPageData(route);
    }

    const products = await fetchAllProducts(supabase);
    const categoryProducts = products.filter((product) =>
      matchProductToRoute(product.name, product.category, route),
    );

    const productLookup = new Map(categoryProducts.map((product) => [product.id, product]));
    const productIds = [...productLookup.keys()];
    const listingRows = await fetchCategoryListings(supabase, productIds);
    const searchEvents = await fetchSearchEvents(supabase);
    const searchDemands = await fetchSearchDemands(supabase);
    const listings = buildCategoryListings(listingRows, productLookup);

    if (!categoryProducts.length && !listings.length) {
      return buildEmptyCategoryPageData(route);
    }

    const latestListingAt = getLatestListingTimestamp(listings);
    const categoryUrl = getAbsoluteUrl(`/category/${route.slug}`);
    const duplicateSummary = resolveProductDetailDuplicateSummary(
      listings.map((listing) => ({
        id: listing.id,
        title: listing.title,
        price: listing.price,
        source: listing.source,
        condition: listing.condition,
      })),
    );
    const intelligence = calculateProductIntelligence({
      listings: listings.map((listing) => ({
        price: listing.price,
        createdAt: listing.createdAt,
      })),
    });
    const decisionInsight = buildProductDecisionInsight(
      route.label,
      listings.map((listing) => ({
        id: listing.id,
        productId: listing.productId,
        title: listing.title,
        productName: listing.productName,
        price: listing.price,
        city: listing.city,
        source: listing.source,
        url: listing.url,
        condition: listing.condition,
        imageUrl: listing.imageUrl,
        createdAt: listing.createdAt,
        updatedAt: listing.updatedAt,
      })),
      [],
    );
    const marketIntelligence = buildMarketIntelligence({
      scope: {
        productId: `category-${route.slug}`,
        productName: route.label,
        slug: route.slug,
        url: categoryUrl,
        category: route.label,
        brand: route.label,
      },
      listings: listings.map((listing) => ({
        id: listing.id,
        title: listing.title,
        price: listing.price,
        source: listing.source,
        city: listing.city,
        condition: listing.condition,
        createdAt: listing.createdAt,
        updatedAt: listing.updatedAt,
        productId: listing.productId,
        productName: listing.productName,
        status: "published",
        confidenceScore: listing.confidenceScore,
        confidenceLevel: listing.confidenceLevel,
      })),
      intelligence,
      decisionInsight: {
        confidence: toConfidenceResult(
          decisionInsight.confidence.score,
          decisionInsight.confidence.reasons,
        ),
        smartPrice: decisionInsight.smartPrice,
      },
      duplicateSummary,
      analyzedAt: latestListingAt ?? new Date(),
    });
    const opportunityAnalysis = buildOpportunityAnalysis({
      marketIntelligence,
      intelligence,
      duplicateSummary,
      analyzedAt: marketIntelligence.analysisGeneratedAt,
      latestListingAt,
    });
    const marketPulse = buildMarketPulse({
      products: categoryProducts.map((product) => ({
        id: product.id,
        name: product.name,
      })),
      listings: listings.map((listing) => ({
        productId: listing.productId,
        productName: listing.productName,
        price: listing.price,
        createdAt: listing.createdAt,
      })),
      searches: buildCategorySearches(searchEvents, searchDemands),
    });
    const topOpportunities = marketPulse.topOpportunities.slice(0, 6);
    const popularProducts =
      marketPulse.mostSearchedProducts.length > 0
        ? marketPulse.mostSearchedProducts.slice(0, 6)
        : marketPulse.mostListedProducts.slice(0, 6);
    const latestListings = [...listings]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
          a.productName.localeCompare(b.productName, "tr"),
      )
      .slice(0, 6);
    const brandDistribution = buildBrandDistribution(categoryProducts, listings);
    const faqItems = buildCategoryFaqItems({
      categoryName: route.label,
      shortDescription: route.shortDescription,
      listingCount: marketIntelligence.marketSummary.totalListingCount,
      productCount: categoryProducts.length,
      sourceCount: marketIntelligence.marketSummary.sourceCount,
      marketIntelligence,
      opportunityAnalysis,
    });
    const jsonLd = buildCategoryJsonLd({
      route,
      categoryUrl,
      summary: marketIntelligence.marketSummary.summary,
      faqItems,
      topOpportunities: topOpportunities.length > 0 ? topOpportunities : popularProducts,
    });

    return {
      categorySlug: route.slug,
      categoryName: route.label,
      categoryUrl,
      shortDescription: route.shortDescription,
      longDescription: route.longDescription,
      productCount: categoryProducts.length,
      listingCount: marketIntelligence.marketSummary.totalListingCount,
      marketIntelligence,
      opportunityAnalysis,
      duplicateSummary,
      marketPulse,
      topOpportunities,
      popularProducts,
      latestListings,
      brandDistribution,
      faqItems,
      jsonLd,
    };
  },
);

export function buildEmptyCategoryPageData(route: CategoryRoute): CategoryPageData {
  const categoryUrl = getAbsoluteUrl(`/category/${route.slug}`);
  const emptyIntelligence = calculateProductIntelligence({ listings: [] });
  const emptyDecisionInsight = buildProductDecisionInsight(route.label, [], []);
  const marketIntelligence = buildMarketIntelligence({
    scope: {
      productId: `category-${route.slug}`,
      productName: route.label,
      slug: route.slug,
      url: categoryUrl,
      category: route.label,
      brand: route.label,
    },
    listings: [],
    intelligence: emptyIntelligence,
    decisionInsight: {
      confidence: toConfidenceResult(
        emptyDecisionInsight.confidence.score,
        emptyDecisionInsight.confidence.reasons,
      ),
      smartPrice: emptyDecisionInsight.smartPrice,
    },
    duplicateSummary: resolveProductDetailDuplicateSummary([]),
    analyzedAt: new Date(),
  });
  const opportunityAnalysis = buildOpportunityAnalysis({
    marketIntelligence,
    intelligence: emptyIntelligence,
    duplicateSummary: resolveProductDetailDuplicateSummary([]),
    analyzedAt: marketIntelligence.analysisGeneratedAt,
    latestListingAt: null,
  });
  const emptyPulse = buildMarketPulse({ products: [], listings: [] });
  const faqItems = buildCategoryFaqItems({
    categoryName: route.label,
    shortDescription: route.shortDescription,
    listingCount: 0,
    productCount: 0,
    sourceCount: 0,
    marketIntelligence,
    opportunityAnalysis,
  });
  const jsonLd = buildCategoryJsonLd({
    route,
    categoryUrl,
    summary: marketIntelligence.marketSummary.summary,
    faqItems,
    topOpportunities: [],
  });

  return {
    categorySlug: route.slug,
    categoryName: route.label,
    categoryUrl,
    shortDescription: route.shortDescription,
    longDescription: route.longDescription,
    productCount: 0,
    listingCount: 0,
    marketIntelligence,
    opportunityAnalysis,
    duplicateSummary: resolveProductDetailDuplicateSummary([]),
    marketPulse: emptyPulse,
    topOpportunities: [],
    popularProducts: [],
    latestListings: [],
    brandDistribution: [],
    faqItems,
    jsonLd,
  };
}

export function buildBrandDistribution(
  products: CategoryProductRecord[],
  listings: CategoryListingRecord[],
): CategoryBrandDistributionEntry[] {
  const productBrand = new Map(products.map((product) => [product.id, extractBrand(product.name)]));
  const aggregate = new Map<
    string,
    { productCount: number; listingCount: number }
  >();

  for (const product of products) {
    const brandSlug = productBrand.get(product.id);
    if (!brandSlug) continue;
    const current = aggregate.get(brandSlug) ?? { productCount: 0, listingCount: 0 };
    current.productCount += 1;
    aggregate.set(brandSlug, current);
  }

  for (const listing of listings) {
    const brandSlug = productBrand.get(listing.productId);
    if (!brandSlug) continue;
    const current = aggregate.get(brandSlug) ?? { productCount: 0, listingCount: 0 };
    current.listingCount += 1;
    aggregate.set(brandSlug, current);
  }

  const totalListings = listings.length || 1;

  return [...aggregate.entries()]
    .map(([brandSlug, entry]) => ({
      brandSlug,
      brandName: formatBrandDisplayName(brandSlug) ?? brandSlug,
      productCount: entry.productCount,
      listingCount: entry.listingCount,
      share: roundShare(entry.listingCount / totalListings),
    }))
    .sort(
      (a, b) =>
        b.listingCount - a.listingCount ||
        b.productCount - a.productCount ||
        a.brandName.localeCompare(b.brandName, "tr"),
    )
    .slice(0, 8);
}

export function buildCategoryFaqItems({
  categoryName,
  shortDescription,
  listingCount,
  productCount,
  sourceCount,
  marketIntelligence,
  opportunityAnalysis,
}: {
  categoryName: string;
  shortDescription: string;
  listingCount: number;
  productCount: number;
  sourceCount: number;
  marketIntelligence: MarketIntelligence;
  opportunityAnalysis: OpportunityAnalysis;
}): CategoryFaqItem[] {
  const listingText =
    listingCount > 0
      ? `${listingCount.toLocaleString("tr-TR")} ilan`
      : "henüz yeterli ilan";
  const sourceText =
    sourceCount > 0
      ? `${sourceCount.toLocaleString("tr-TR")} kaynak`
      : "kaynak çeşitliliği oluşmadan";

  return [
    {
      question: `${categoryName} kategori sayfası nasıl hazırlanıyor?`,
      answer: `2ElBul, ${categoryName} kategorisindeki ürünleri ve bu ürünlere bağlı ilanları tek yerde toplar. ${shortDescription.toLowerCase()}. Market Intelligence, Opportunity Engine ve Product Matcher çıktıları birlikte kullanılır.`,
    },
    {
      question: `${categoryName} kategorisinde en iyi fırsatlar nasıl seçiliyor?`,
      answer: `Fırsat skoru, risk seviyesi, confidence ve duplicate yoğunluğu birlikte değerlendirilir. Bu sayfada ${categoryName} için en güçlü sinyaller öne çıkarılır.`,
    },
    {
      question: "Yetersiz veri ne zaman gösterilir?",
      answer: `${categoryName} için ${listingText} oluştuğunda ve yeterli karşılaştırma kurulamadığında güvenli fallback gösterilir; karar notu veri çoğaldıkça otomatik güçlenir.`,
    },
    {
      question: "Kaynak sayısı neden önemli?",
      answer: `${sourceText} analiz yapmak fiyat bandını daha güvenilir hale getirir. ${marketIntelligence.sampleSize.toLocaleString("tr-TR")} ilan üzerinden üretilen kararlar daha dengeli olur.`,
    },
    {
      question: "Bu sayfa SEO için neden uygun?",
      answer: `${categoryName} sayfası kategori bazlı, kanonik ve tekrar üretilebilir bir analiz katmanı sunar. Bu yapı programmatic SEO için ölçeklenebilir bir temel oluşturur.`,
    },
  ];
}

export function buildCategoryJsonLd({
  route,
  categoryUrl,
  summary,
  faqItems,
  topOpportunities,
}: {
  route: CategoryRoute;
  categoryUrl: string;
  summary: string;
  faqItems: CategoryFaqItem[];
  topOpportunities: MarketPulseItem[];
}): CategoryJsonLdDocument[] {
  const breadcrumbId = `${categoryUrl}#breadcrumb`;
  const faqId = `${categoryUrl}#faq`;
  const itemListId = `${categoryUrl}#top-opportunities`;

  const documents: CategoryJsonLdDocument[] = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `${route.label} ikinci el analizi`,
      description: summary,
      url: categoryUrl,
      about: {
        "@type": "Thing",
        name: route.label,
      },
      breadcrumb: {
        "@id": breadcrumbId,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "@id": breadcrumbId,
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Ana Sayfa",
          item: getAbsoluteUrl("/"),
        },
        {
          "@type": "ListItem",
          position: 2,
          name: route.label,
          item: categoryUrl,
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "@id": faqId,
      mainEntity: faqItems.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.answer,
        },
      })),
    },
  ];

  if (topOpportunities.length > 0) {
    documents.push({
      "@context": "https://schema.org",
      "@type": "ItemList",
      "@id": itemListId,
      name: `${route.label} için en iyi fırsatlar`,
      itemListOrder: "https://schema.org/ItemListOrderDescending",
      itemListElement: topOpportunities.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.productName,
        url: getAbsoluteUrl(item.href),
        item: {
          "@type": "Product",
          name: item.productName,
          url: getAbsoluteUrl(item.href),
        },
      })),
    });
  }

  return documents;
}

function buildCategoryListings(
  rows: CategoryListingRow[],
  productLookup: Map<string, CategoryProductRecord>,
): CategoryListingRecord[] {
  return rows
    .map((row) => {
      const productId = row.product_id == null ? null : String(row.product_id);
      if (!productId) return null;

      const product = productLookup.get(productId);
      if (!product || !row.title || !row.city || !row.source || !row.url || !row.condition) {
        return null;
      }

      if (
        isPublicDemoListing({
          title: row.title,
          productName: product.name,
          source: row.source,
          url: row.url,
        })
      ) {
        return null;
      }

      const price = Number(row.price);
      if (!Number.isFinite(price) || price <= 0) return null;

      const confidenceScore = normalizeScore(row.confidence_score);

      return {
        id: String(row.id),
        productId,
        productName: product.name,
        title: String(row.title),
        price,
        city: String(row.city),
        source: row.source as ListingSource,
        url: String(row.url),
        condition: row.condition as ListingCondition,
        imageUrl: row.image_url ? String(row.image_url) : null,
        createdAt: String(row.created_at),
        updatedAt: row.updated_at ? String(row.updated_at) : null,
        confidenceScore,
        confidenceLevel: confidenceScore !== null ? toConfidenceLevel(confidenceScore) : null,
      };
    })
    .filter((listing): listing is CategoryListingRecord => listing !== null);
}

function normalizeScore(value: unknown) {
  if (value == null || value === "") return null;
  const score = typeof value === "number" ? value : Number(value);
  return Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : null;
}

function roundShare(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 1000) / 1000;
}

function chooseLatestTimestamp(current: string | null, candidate: string | null) {
  if (!candidate) return current;
  if (!current) return candidate;

  const currentTime = new Date(current).getTime();
  const candidateTime = new Date(candidate).getTime();
  if (!Number.isFinite(candidateTime)) return current;
  if (!Number.isFinite(currentTime) || candidateTime > currentTime) return candidate;
  return current;
}

function getLatestListingTimestamp(listings: CategoryListingRecord[]) {
  let latest: string | null = null;
  for (const listing of listings) {
    latest = chooseLatestTimestamp(latest, listing.updatedAt ?? listing.createdAt);
  }
  return latest;
}

async function fetchAllProducts(
  supabase: NonNullable<ReturnType<typeof createSupabaseClient>>,
): Promise<CategoryProductRecord[]> {
  const products: CategoryProductRecord[] = [];
  let offset = 0;
  let includeCategory = true;

  while (true) {
    const columns = includeCategory
      ? "id, name, slug, category, created_at"
      : "id, name, slug, created_at";
    const result = await supabase
      .from("products")
      .select(columns)
      .order("id", { ascending: true })
      .range(offset, offset + CATEGORY_CATALOG_PAGE_SIZE - 1);

    if (result.error) {
      if (includeCategory && isMissingProductCategoryColumn(result.error)) {
        includeCategory = false;
        continue;
      }

      console.error("Category product query failed:", result.error);
      return [];
    }

    const rows = (result.data ?? []) as unknown as CategoryProductRow[];
    products.push(
      ...rows
        .filter((row) => !isPublicDemoProductName(String(row.name)))
        .map((row) => ({
          id: String(row.id),
          name: String(row.name),
          slug: row.slug ? String(row.slug) : createProductSlug(String(row.name)),
          category: "category" in row && row.category ? String(row.category) : null,
          createdAt: row.created_at ? String(row.created_at) : null,
        })),
    );

    if (rows.length < CATEGORY_CATALOG_PAGE_SIZE) break;
    offset += CATEGORY_CATALOG_PAGE_SIZE;
  }

  return products;
}

async function fetchCategoryListings(
  supabase: NonNullable<ReturnType<typeof createSupabaseClient>>,
  productIds: string[],
) {
  const listings: CategoryListingRow[] = [];
  for (const chunk of chunkArray(productIds, CATEGORY_LISTING_BATCH_SIZE)) {
    const rows = await fetchCategoryListingBatch(supabase, chunk);
    listings.push(...rows);
  }

  return listings;
}

async function fetchAllListingsForCatalog(
  supabase: NonNullable<ReturnType<typeof createSupabaseClient>>,
  products: CategoryProductRecord[],
) {
  const productIds = products.map((product) => product.id);
  const rows = await fetchCategoryListings(supabase, productIds);
  const productLookup = new Map(products.map((product) => [product.id, product]));
  return buildCategoryListings(rows, productLookup).map((listing) => ({
    productId: listing.productId,
    createdAt: listing.createdAt,
    updatedAt: listing.updatedAt,
  }));
}

async function fetchCategoryListingBatch(
  supabase: NonNullable<ReturnType<typeof createSupabaseClient>>,
  productIds: string[],
) {
  if (!productIds.length) return [];

  let useStatusColumn = true;
  let useUpdatedAtColumn = true;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const columns = [
      "id",
      "product_id",
      "title",
      "price",
      "city",
      "source",
      "url",
      "condition",
      "image_url",
      "created_at",
      "confidence_score",
      ...(useUpdatedAtColumn ? ["updated_at"] : []),
      ...(useStatusColumn ? ["status"] : []),
    ].join(", ");

    let query = supabase.from("listings").select(columns).in("product_id", productIds);
    if (useStatusColumn) {
      query = query.in("status", ["published", "active"]);
    }

    const result = await query;
    if (!result.error) {
      return (result.data ?? []) as unknown as CategoryListingRow[];
    }

    if (useUpdatedAtColumn && isMissingListingUpdatedAtColumn(result.error)) {
      useUpdatedAtColumn = false;
      continue;
    }

    if (useStatusColumn && isMissingStatusColumn(result.error)) {
      useStatusColumn = false;
      continue;
    }

    console.error("Category listing query failed:", result.error);
    return [];
  }

  return [];
}

async function fetchSearchEvents(
  supabase: NonNullable<ReturnType<typeof createSupabaseClient>>,
) {
  const result = await supabase
    .from("search_events")
    .select("product_id, created_at")
    .order("created_at", { ascending: false })
    .limit(SEARCH_LIMIT);

  if (result.error) {
    console.error("Category search events query failed:", result.error);
    return [] as CategorySearchEventRecord[];
  }

  return ((result.data ?? []) as Array<{
    product_id: string | number | null;
    created_at: string | null;
  }>).map((row) => ({
    productId: row.product_id,
    createdAt: row.created_at ? String(row.created_at) : null,
  }));
}

async function fetchSearchDemands(
  supabase: NonNullable<ReturnType<typeof createSupabaseClient>>,
) {
  const result = await supabase
    .from("search_demands")
    .select("query, normalized_query, requested_at")
    .order("requested_at", { ascending: false })
    .limit(SEARCH_LIMIT);

  if (result.error) {
    console.error("Category search demands query failed:", result.error);
    return [] as CategorySearchDemandRecord[];
  }

  return ((result.data ?? []) as Array<{
    query?: string | null;
    normalized_query?: string | null;
    requested_at?: string | null;
  }>).map((row) => ({
    query: row.query ? String(row.query) : null,
    normalizedQuery: row.normalized_query ? String(row.normalized_query) : null,
    createdAt: row.requested_at ? String(row.requested_at) : null,
  }));
}

function chunkArray<T>(values: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function isMissingProductCategoryColumn(error: unknown) {
  return isMissingColumn(error, "category");
}

function isMissingListingUpdatedAtColumn(error: unknown) {
  return isMissingColumn(error, "updated_at");
}

function isMissingColumn(error: unknown, column: string) {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: string; message?: string; details?: string };
  const text = `${record.message ?? ""} ${record.details ?? ""}`.toLowerCase();
  return (
    record.code === "42703" ||
    record.code === "PGRST204" ||
    text.includes(column.toLowerCase())
  );
}

function buildCategorySearches(
  events: CategorySearchEventRecord[],
  demands: CategorySearchDemandRecord[],
) {
  return [
    ...events.map((event) => ({
      productId: event.productId,
      createdAt: event.createdAt,
    })),
    ...demands.map((demand) => ({
      query: demand.query,
      normalizedQuery: demand.normalizedQuery,
      createdAt: demand.createdAt,
    })),
  ];
}

type CategoryProductRow = {
  id: string | number;
  name: string;
  slug?: string | null;
  category?: string | null;
  created_at?: string | null;
};

type CategoryListingRow = {
  id: string | number;
  product_id: string | number | null;
  title: string | null;
  price: string | number | null;
  city: string | null;
  source: string | null;
  url: string | null;
  condition: string | null;
  image_url?: string | null;
  created_at: string | null;
  updated_at?: string | null;
  confidence_score?: string | number | null;
};
