import { cache } from "react";
import type { ConfidenceLevel } from "@/lib/confidence-engine";
import type { ListingCondition, ListingSource } from "@/lib/listings";
import { isMissingStatusColumn, isMissingListingUpdatedAtColumn } from "@/lib/listing-status";
import { calculateProductIntelligence } from "@/lib/intelligence-engine";
import {
  buildLandingFaqItems,
  snapshotFromMarketIntelligence,
} from "@/lib/seo/landing-content";
import { buildMarketIntelligence, type MarketIntelligence, type MarketIntelligenceListing } from "@/lib/market-intelligence";
import {
  dominantProductType,
  extractProductTypeFromAttributes,
  toConfidenceResult,
  toConfidenceLevel,
} from "@/lib/market-intelligence/helpers";
import { buildMarketPulse, type MarketPulse, type MarketPulseItem } from "@/lib/market-pulse";
import { formatBrandDisplayName, extractBrand } from "@/lib/normalization";
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
import { toBigintIds } from "@/lib/supabase-ids";
import {
  EMPTY_CATEGORY_STATS,
  getCategoryBySlug,
  getCategoryScopeIds,
  getCategoryStats,
  getNavigationCategoryTree,
  isCategoryVisible,
  type Category,
  type ResolvedCategory,
} from "@/lib/categories";

/**
 * What a category page / JSON-LD needs to know about the category it renders.
 * Built from a public.categories row (see scopeFromCategory).
 */
export type CategoryScope = {
  slug: string;
  label: string;
  shortDescription: string;
  longDescription: string;
  expectedProductType?: string;
  parent?: { slug: string; label: string } | null;
};

export type CategorySubcategoryLink = {
  slug: string;
  label: string;
  productCount: number;
};

export type CategoryCatalogEntry = {
  id: number;
  slug: string;
  label: string;
  parentSlug: string | null;
  icon: string | null;
  productCount: number;
  listingCount: number;
  latestListingAt: string | null;
};

export type CategoryProductRecord = {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  attributes?: unknown;
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
  productType?: string;
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
  expectedProductType?: string;
  parent: { slug: string; label: string } | null;
  subcategories: CategorySubcategoryLink[];
  productCount: number;
  listingCount: number;
  marketIntelligence: MarketIntelligence;
  opportunityAnalysis: OpportunityAnalysis;
  duplicateSummary: DuplicateBatchSummary;
  marketPulse: MarketPulse;
  topOpportunities: MarketPulseItem[];
  popularProducts: MarketPulseItem[];
  latestListings: CategoryListingRecord[];
  gridListings: CategoryListingRecord[];
  brandDistribution: CategoryBrandDistributionEntry[];
  faqItems: CategoryFaqItem[];
  jsonLd: CategoryJsonLdDocument[];
};

const CATEGORY_LISTING_BATCH_SIZE = 100;
const CATEGORY_PRODUCT_PAGE_SIZE = 1000;
const SEARCH_LIMIT = 1000;

/**
 * URL variants that redirect to canonical category slugs (old links, common
 * Turkish spellings). Keys are already normalized (lowercased, diacritics
 * removed, hyphenated). Canonical slugs themselves live in public.categories.
 */
const CATEGORY_ALIASES: Record<string, string> = {
  "cep-telefonu": "telefon",
  "cep-telefon": "telefon",
  "akilli-telefon": "telefon",
  "dizustu": "bilgisayar-laptop",
  "dizustu-bilgisayar": "bilgisayar-laptop",
  "laptop": "bilgisayar-laptop",
  "notebook": "bilgisayar-laptop",
  "tablet": "bilgisayar-tablet",
  "pc": "bilgisayar",
  "oyun-bilgisayari": "bilgisayar-masaustu",
  "playstation": "konsol-playstation",
  "oyun-konsolu": "konsol",
  "televizyon": "tv-ses-televizyon",
  "tv": "tv-ses",
  "tv-ve-ses-sistemleri": "tv-ses",
  "kulaklik": "tv-ses-kulaklik",
  "otomobil": "arac-otomobil",
  "araba": "arac-otomobil",
  "konut": "emlak-konut",
  "daire": "emlak-konut",
  "telefon-aksesuari": "aksesuar",
  "ev-ve-yasam": "ev-yasam",
  "yedek-parca-ve-donanim": "yedek-parca",
  // Removed duplicate subcategories (2026-09-30)
  "bilgisayar-parcalari": "yedek-parca-bilgisayar",
  "aksesuar-kulaklik": "tv-ses-kulaklik",
};

export function normalizeCategorySlug(input: string): string {
  const slug = createProductSlug(input);
  return CATEGORY_ALIASES[slug] ?? slug;
}

/**
 * Returns the canonical slug for a given input slug.
 * If the input is already a canonical slug, returns the same value.
 * If the input is an alias, returns the canonical equivalent.
 * Use this in pages to decide whether to redirect alias URLs.
 */
export function resolveCanonicalSlug(input: string): string {
  return normalizeCategorySlug(input);
}

/**
 * Returns true if the given slug is a known alias (not canonical).
 */
export function isCategoryAlias(input: string): boolean {
  const normalized = createProductSlug(input);
  return normalized in CATEGORY_ALIASES;
}

export function scopeFromCategory(resolved: ResolvedCategory): CategoryScope {
  const { category, parent } = resolved;
  const shortDescription = category.shortDescription ?? `${category.name} ikinci el piyasa analizi`;
  return {
    slug: category.slug,
    label: category.name,
    shortDescription,
    longDescription: category.longDescription ?? shortDescription,
    expectedProductType:
      category.expectedProductType ?? parent?.expectedProductType ?? undefined,
    parent: parent ? { slug: parent.slug, label: parent.name } : null,
  };
}

/**
 * Every visible category (main categories each followed by their
 * subcategories) with the same counts the menu and homepage show.
 */
export const getCategoryCatalog = cache(async (): Promise<CategoryCatalogEntry[]> => {
  const [tree, stats] = await Promise.all([getNavigationCategoryTree(), getCategoryStats()]);
  const toEntry = (category: Category, parentSlug: string | null): CategoryCatalogEntry => {
    const entry = stats.get(category.id) ?? EMPTY_CATEGORY_STATS;
    return {
      id: category.id,
      slug: category.slug,
      label: category.name,
      parentSlug,
      icon: category.icon,
      productCount: entry.productCount,
      listingCount: entry.listingCount,
      latestListingAt: entry.latestListingAt,
    };
  };
  return tree.flatMap((main) => [
    toEntry(main, null),
    ...main.children.map((child) => toEntry(child, main.slug)),
  ]);
});

const CATEGORY_GRID_PAGE_SIZE = 60;

export const getCategoryPageData = cache(
  async (categorySlug: string): Promise<CategoryPageData | null> => {
    const resolved = await getCategoryBySlug(resolveCanonicalSlug(categorySlug));
    if (!resolved) return null;

    const route = scopeFromCategory(resolved);
    const stats = await getCategoryStats();
    const subcategories: CategorySubcategoryLink[] = resolved.children
      .filter((child) => isCategoryVisible(child, stats))
      .map((child) => ({
        slug: child.slug,
        label: child.name,
        productCount: stats.get(child.id)?.productCount ?? 0,
      }));

    const supabase = createSupabaseClient();
    if (!supabase) {
      return buildEmptyCategoryPageData(route, subcategories);
    }

    // Membership comes only from products.category_id (this category and its
    // subcategories) — the same rule the menu and homepage counts use.
    const categoryProducts = await fetchCategoryProducts(supabase, getCategoryScopeIds(resolved));

    const productLookup = new Map(categoryProducts.map((product) => [product.id, product]));
    const productIds = [...productLookup.keys()];
    const listingRows = await fetchCategoryListings(supabase, productIds);
    const searchDemands = await fetchSearchDemands(supabase);
    const listings = buildCategoryListings(listingRows, productLookup);
    const filteredListings = listings;
    const dominantType = dominantProductType(categoryProducts);

    if (!categoryProducts.length && !listings.length) {
      return buildEmptyCategoryPageData(route, subcategories);
    }

    const latestListingAt = getLatestListingTimestamp(listings);
    const categoryUrl = getAbsoluteUrl(`/category/${route.slug}`);
    const duplicateSummary = resolveProductDetailDuplicateSummary(
      filteredListings.map((listing) => ({
        id: listing.id,
        title: listing.title,
        price: listing.price,
        source: listing.source,
        condition: listing.condition,
      })),
    );
    const intelligence = calculateProductIntelligence({
      listings: filteredListings.map((listing) => ({
        price: listing.price,
        createdAt: listing.createdAt,
      })),
    });
    const decisionInsight = buildProductDecisionInsight(
      route.label,
      filteredListings.map((listing) => ({
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
        productType: dominantType,
      },
      listings: filteredListings.map((listing) => ({
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
      // No productLookup: that would re-partition listings by product type,
      // but membership here is already decided by products.category_id —
      // every listing of every product in the category counts.
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
      listings: filteredListings.map((listing) => ({
        productId: listing.productId,
        productName: listing.productName,
        price: listing.price,
        createdAt: listing.createdAt,
      })),
      searches: buildCategorySearches(searchDemands),
    });
    const topOpportunities = marketPulse.topOpportunities.slice(0, 6);
    const popularProducts =
      marketPulse.mostSearchedProducts.length > 0
        ? marketPulse.mostSearchedProducts.slice(0, 6)
        : marketPulse.mostListedProducts.slice(0, 6);
    const latestListings = latestFirst(filteredListings).slice(0, 6);
    const gridListings = latestFirst(filteredListings).slice(0, CATEGORY_GRID_PAGE_SIZE);
    const brandDistribution = buildBrandDistribution(categoryProducts, filteredListings);
    const faqItems = buildCategoryFaqItems({
      categoryName: route.label,
      marketIntelligence,
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
      expectedProductType: route.expectedProductType,
      parent: route.parent ?? null,
      subcategories,
      productCount: categoryProducts.length,
      listingCount: marketIntelligence.marketSummary.totalListingCount,
      marketIntelligence,
      opportunityAnalysis,
      duplicateSummary,
      marketPulse,
      topOpportunities,
      popularProducts,
      latestListings,
      gridListings,
      brandDistribution,
      faqItems,
      jsonLd,
    };
  },
);

function latestFirst(listings: CategoryListingRecord[]) {
  return [...listings].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
      a.productName.localeCompare(b.productName, "tr"),
  );
}

export function buildEmptyCategoryPageData(
  route: CategoryScope,
  subcategories: CategorySubcategoryLink[] = [],
): CategoryPageData {
  const categoryUrl = getAbsoluteUrl(`/category/${route.slug}`);
  const emptyIntelligence = calculateProductIntelligence({ listings: [] });
  const emptyDecisionInsight = buildProductDecisionInsight(route.label, [], []);
  const emptyDuplicateSummary = resolveProductDetailDuplicateSummary([]);
  const marketIntelligence = buildMarketIntelligence({
    scope: {
      productId: `category-${route.slug}`,
      productName: route.label,
      slug: route.slug,
      url: categoryUrl,
      category: route.label,
      brand: route.label,
      productType: null,
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
    duplicateSummary: emptyDuplicateSummary,
    analyzedAt: new Date(),
  });
  const opportunityAnalysis = buildOpportunityAnalysis({
    marketIntelligence,
    intelligence: emptyIntelligence,
    duplicateSummary: emptyDuplicateSummary,
    analyzedAt: marketIntelligence.analysisGeneratedAt,
    latestListingAt: null,
  });
  const emptyPulse = buildMarketPulse({ products: [], listings: [] });
  const faqItems = buildCategoryFaqItems({
    categoryName: route.label,
    marketIntelligence,
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
    expectedProductType: route.expectedProductType,
    parent: route.parent ?? null,
    subcategories,
    productCount: 0,
    listingCount: 0,
    marketIntelligence,
    opportunityAnalysis,
    duplicateSummary: emptyDuplicateSummary,
    marketPulse: emptyPulse,
    topOpportunities: [],
    popularProducts: [],
    latestListings: [],
    gridListings: [],
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

/** User-facing FAQ, answered from live market numbers (shared with every landing page). */
export function buildCategoryFaqItems({
  categoryName,
  marketIntelligence,
}: {
  categoryName: string;
  marketIntelligence: Pick<MarketIntelligence, "priceAnalysis" | "marketSummary">;
}): CategoryFaqItem[] {
  return buildLandingFaqItems("category", categoryName, snapshotFromMarketIntelligence(marketIntelligence));
}

export function buildCategoryJsonLd({
  route,
  categoryUrl,
  summary,
  faqItems,
  topOpportunities,
}: {
  route: CategoryScope;
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
        ...(route.parent
          ? [
              {
                "@type": "ListItem" as const,
                position: 2,
                name: route.parent.label,
                item: getAbsoluteUrl(`/category/${route.parent.slug}`),
              },
            ]
          : []),
        {
          "@type": "ListItem",
          position: route.parent ? 3 : 2,
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
      const productType = extractProductTypeFromAttributes(product.attributes);

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
        productType: productType ?? undefined,
      };
    })
    .filter((listing) => listing !== null) as CategoryListingRecord[];
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

async function fetchCategoryProducts(
  supabase: NonNullable<ReturnType<typeof createSupabaseClient>>,
  categoryIds: number[],
): Promise<CategoryProductRecord[]> {
  const products: CategoryProductRecord[] = [];
  for (let offset = 0; ; offset += CATEGORY_PRODUCT_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, slug, category, attributes, created_at")
      .in("category_id", categoryIds)
      .order("id", { ascending: true })
      .range(offset, offset + CATEGORY_PRODUCT_PAGE_SIZE - 1);

    if (error) {
      console.error("Category product query failed:", error);
      return products;
    }

    for (const row of data ?? []) {
      if (isPublicDemoProductName(row.name)) continue;
      products.push({
        id: String(row.id),
        name: row.name,
        slug: row.slug ?? createProductSlug(row.name),
        category: row.category,
        attributes: row.attributes,
        createdAt: row.created_at,
      });
    }
    if ((data ?? []).length < CATEGORY_PRODUCT_PAGE_SIZE) return products;
  }
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

    let query = supabase.from("listings").select(columns).in("product_id", toBigintIds(productIds));
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

function buildCategorySearches(
  demands: CategorySearchDemandRecord[],
) {
  return demands.map((demand) => ({
    query: demand.query,
    normalizedQuery: demand.normalizedQuery,
    createdAt: demand.createdAt,
  }));
}

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
