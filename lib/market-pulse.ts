import {
  calculateProductIntelligence,
  type IntelligenceOpportunityLabel,
  type IntelligenceDecisionLabel,
  type IntelligenceTrendDirection,
} from "./intelligence-engine";
import { createProductSlug } from "./product-slug";
import { normalizeSearchDemandQuery } from "./search-demand";
import { extractProductTypeFromAttributes } from "@/lib/market-intelligence/helpers";

export type MarketPulseProductInput = {
  id?: string | number | null;
  name: string;
};

export type MarketPulseListingInput = {
  productId?: string | number | null;
  productName: string;
  price: number | string | null | undefined;
  createdAt?: string | null;
};

export type MarketPulseSearchInput = {
  productId?: string | number | null;
  productName?: string | null;
  query?: string | null;
  normalizedQuery?: string | null;
  createdAt?: string | null;
};

export type MarketPulseItem = {
  productName: string;
  href: string;
  listingCount: number;
  averagePrice: number | null;
  lowestPrice: number | null;
  opportunityLabel: IntelligenceOpportunityLabel;
  opportunityScore: number;
  buyScore: number;
  decisionLabel: IntelligenceDecisionLabel;
  trendDirection: IntelligenceTrendDirection;
  trendChangePercent: number | null;
  searchCount: number;
};

export type MarketPulse = {
  mostSearchedProducts: MarketPulseItem[];
  mostListedProducts: MarketPulseItem[];
  topOpportunities: MarketPulseItem[];
  fallingPriceProducts: MarketPulseItem[];
  insufficientDataProducts: MarketPulseItem[];
};

type BuildMarketPulseInput = {
  products: MarketPulseProductInput[];
  listings: MarketPulseListingInput[];
  searches?: MarketPulseSearchInput[];
  limit?: number;
  expectedProductType?: string | null;
  productLookup?: Map<string, { attributes?: unknown }>;
};

const emptyPulse: MarketPulse = {
  mostSearchedProducts: [],
  mostListedProducts: [],
  topOpportunities: [],
  fallingPriceProducts: [],
  insufficientDataProducts: [],
};

export function buildMarketPulse({
  products,
  listings,
  searches = [],
  limit = 6,
  expectedProductType,
  productLookup,
}: BuildMarketPulseInput): MarketPulse {
  if (!products.length && !listings.length) return emptyPulse;

  // Centralized productType filtering — only primary_product products enter
  // market pulse aggregation. Accessory/spare_part/service product names
  // would contaminate search counts via fuzzy token matching in countSearches().
  const filteredProducts = expectedProductType && productLookup
    ? products.filter((p) => {
        if (p.id == null) return false;
        const product = productLookup.get(String(p.id));
        if (!product) return false;
        const pt = extractProductTypeFromAttributes(product.attributes);
        if (!pt) return true;
        return pt === expectedProductType;
      })
    : products;

  const productNamesById = new Map(
    filteredProducts
      .filter((product) => product.id !== null && product.id !== undefined)
      .map((product) => [String(product.id), product.name]),
  );
  const productNames = new Set(filteredProducts.map((product) => product.name));
  for (const listing of listings) {
    if (listing.productName) productNames.add(listing.productName);
  }

  const listingsByProduct = new Map<string, MarketPulseListingInput[]>();
  for (const listing of listings) {
    const name =
      (listing.productId != null
        ? productNamesById.get(String(listing.productId))
        : null) || listing.productName;
    if (!name) continue;
    listingsByProduct.set(name, [...(listingsByProduct.get(name) ?? []), listing]);
  }

  const searchCounts = countSearches({
    searches,
    productNames: [...productNames],
    productNamesById,
  });

  const items = [...productNames]
    .map((productName) =>
      buildMarketPulseItem(
        productName,
        listingsByProduct.get(productName) ?? [],
        searchCounts.get(productName) ?? 0,
      ),
    )
    .filter((item) => item.listingCount > 0 || item.searchCount > 0);

  return {
    mostSearchedProducts: [...items]
      .filter((item) => item.searchCount > 0)
      .sort(
        (a, b) =>
          b.searchCount - a.searchCount ||
          b.listingCount - a.listingCount ||
          a.productName.localeCompare(b.productName, "tr"),
      )
      .slice(0, limit),
    mostListedProducts: [...items]
      .filter((item) => item.listingCount > 0)
      .sort(
        (a, b) =>
          b.listingCount - a.listingCount ||
          (a.lowestPrice ?? Number.MAX_SAFE_INTEGER) -
            (b.lowestPrice ?? Number.MAX_SAFE_INTEGER),
      )
      .slice(0, limit),
    topOpportunities: [...items]
      .filter(
        (item) =>
          item.opportunityLabel !== "Veri yetersiz" &&
          item.opportunityLabel !== "Dikkatli incele",
      )
      .sort(
        (a, b) =>
          b.buyScore - a.buyScore ||
          b.opportunityScore - a.opportunityScore ||
          (a.lowestPrice ?? Number.MAX_SAFE_INTEGER) -
            (b.lowestPrice ?? Number.MAX_SAFE_INTEGER),
      )
      .slice(0, limit),
    fallingPriceProducts: [...items]
      .filter((item) => item.trendDirection === "falling")
      .sort(
        (a, b) =>
          Math.abs(b.trendChangePercent ?? 0) -
          Math.abs(a.trendChangePercent ?? 0),
      )
      .slice(0, limit),
    insufficientDataProducts: [...items]
      .filter((item) => item.opportunityLabel === "Veri yetersiz")
      .sort(
        (a, b) =>
          b.searchCount - a.searchCount ||
          b.listingCount - a.listingCount ||
          a.productName.localeCompare(b.productName, "tr"),
      )
      .slice(0, limit),
  };
}

function buildMarketPulseItem(
  productName: string,
  listings: MarketPulseListingInput[],
  searchCount: number,
): MarketPulseItem {
  const intelligence = calculateProductIntelligence({
    listings: listings.map((listing) => ({
      price: listing.price,
      createdAt: listing.createdAt ?? null,
    })),
    demand: {
      searchCount,
      recentSearchCount: searchCount,
    },
  });

  return {
    productName,
    href: `/product/${createProductSlug(productName)}`,
    listingCount: intelligence.marketValue.listingCount,
    averagePrice: intelligence.marketValue.averagePrice,
    lowestPrice: intelligence.marketValue.minPrice,
    opportunityLabel: intelligence.opportunity.label,
    opportunityScore: intelligence.opportunity.score,
    buyScore: intelligence.decisionSupport.buyScore,
    decisionLabel: intelligence.decisionSupport.label,
    trendDirection: intelligence.trend.direction,
    trendChangePercent: intelligence.trend.changePercent,
    searchCount,
  };
}

function countSearches({
  searches,
  productNames,
  productNamesById,
}: {
  searches: MarketPulseSearchInput[];
  productNames: string[];
  productNamesById: Map<string, string>;
}) {
  const counts = new Map<string, number>();
  const normalizedProducts = productNames.map((name) => ({
    name,
    normalized: normalizeSearchDemandQuery(name),
  }));

  for (const search of searches) {
    const directName =
      (search.productId != null
        ? productNamesById.get(String(search.productId))
        : null) || search.productName || "";
    if (directName) {
      counts.set(directName, (counts.get(directName) ?? 0) + 1);
      continue;
    }

    const normalizedSearch = normalizeSearchDemandQuery(
      search.normalizedQuery || search.query || "",
    );
    if (!normalizedSearch) continue;
    const matchedProduct = normalizedProducts.find((product) => {
      if (!product.normalized) return false;
      if (normalizedSearch.includes(product.normalized)) return true;
      if (product.normalized.includes(normalizedSearch)) return true;
      const productTokens = product.normalized.split(" ").filter(Boolean);
      const queryTokens = new Set(normalizedSearch.split(" ").filter(Boolean));
      const overlap = productTokens.filter((token) => queryTokens.has(token));
      return overlap.length >= Math.min(2, productTokens.length);
    });
    if (matchedProduct) {
      counts.set(
        matchedProduct.name,
        (counts.get(matchedProduct.name) ?? 0) + 1,
      );
    }
  }

  return counts;
}
