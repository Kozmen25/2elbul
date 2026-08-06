import type { Listing, ListingCondition, ListingSource } from "@/lib/listings";

// ─── Generic Response Wrapper ───

export type MobileApiResponse<T> = { ok: true; data: T } | { ok: false; error: string };

// ─── Pagination ───

export type MobilePagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

// ─── Home ───

export type MobileHomeListing = {
  id: string;
  title: string;
  price: number;
  city: string;
  source: ListingSource;
  condition: ListingCondition;
  imageUrl: string | null;
  createdAt: string;
  productId: string;
  productName: string;
  productSlug: string | null;
};

export type MobileHomeCategory = {
  id: string | number;
  name: string;
  slug: string;
  listingCount: number;
};

export type MobileHomeProduct = {
  id: string;
  name: string;
  slug: string | null;
  listingCount: number;
  minPrice: number;
  averagePrice: number;
};

export type MobileHomeMarketPulse = {
  totalListings: number;
  totalProducts: number;
  averagePrice: number;
  priceRange: { min: number; max: number };
  sourceCount: number;
  lastUpdated: string | null;
};

export type MobileHomeResponse = {
  hero: {
    totalListings: number;
    totalProducts: number;
    newToday: number;
  };
  categories: MobileHomeCategory[];
  aiRecommendations: MobileHomeListing[];
  trendingProducts: MobileHomeProduct[];
  latestListings: MobileHomeListing[];
  marketSummary: MobileHomeMarketPulse;
};

// ─── Search ───

export type MobileSearchFilterSummary = {
  sources: { source: ListingSource; count: number }[];
  conditions: { condition: ListingCondition; count: number }[];
  priceRange: { min: number; max: number };
};

export type MobileSearchIntent = {
  query: string;
  label: string | null;
  matchedCategories: string[];
  isBroadCategory: boolean;
};

export type MobileSearchProductHit = {
  id: string;
  name: string;
  slug: string | null;
  category: string | null;
  listingCount: number;
  minPrice: number;
  averagePrice: number;
};

export type MobileSearchListingHit = {
  id: string;
  title: string;
  price: number;
  city: string;
  source: ListingSource;
  condition: ListingCondition;
  imageUrl: string | null;
  url: string;
  createdAt: string;
  productId: string;
  productName: string;
  productSlug: string | null;
  category: string | null;
  productType?: string | null;
  score: number;
};

export type MobileSearchResponse = {
  query: string;
  intent: MobileSearchIntent | null;
  products: MobileSearchProductHit[];
  listings: MobileSearchListingHit[];
  filters: MobileSearchFilterSummary;
  pagination: MobilePagination;
  isAuthenticated: boolean;
  favoriteListingIds: string[];
};

// ─── Product Detail ───

export type MobileProductListing = {
  id: string;
  title: string;
  price: number;
  city: string;
  source: ListingSource;
  condition: ListingCondition;
  imageUrl: string | null;
  url: string;
  createdAt: string;
};

export type MobilePriceHistoryPoint = {
  date: string;
  price: number;
  sourceCount?: number;
};

export type MobileProductConfidence = {
  score: number;
  level: string;
  description: string;
  reasons: string[];
  warnings: string[];
};

export type MobileProductSmartPrice = {
  summary: string;
  details: string[];
  warnings: string[];
};

export type MobileProductDecisionInsight = {
  confidence: MobileProductConfidence;
  smartPrice: MobileProductSmartPrice;
};

export type MobileProductBestDeal = {
  listing: MobileProductListing;
  differencePercent: number;
  label: string;
};

export type MobileSimilarProduct = {
  id: string;
  name: string;
  slug: string | null;
  listingCount: number;
  averagePrice: number;
  minPrice: number;
};

export type MobileMarketIntelligence = {
  totalListingsInCategory: number;
  averagePrice: number;
  medianPrice: number;
  priceRange: { min: number; max: number };
  sourceDistribution: { source: ListingSource; count: number }[];
  conditionDistribution: { condition: ListingCondition; count: number }[];
};

export type MobileProductDetailResponse = {
  product: {
    id: string;
    name: string;
    slug: string;
    category: string | null;
    createdAt: string;
  } | null;
  listings: MobileProductListing[];
  priceHistory: MobilePriceHistoryPoint[];
  decisionInsight: MobileProductDecisionInsight | null;
  marketIntelligence: MobileMarketIntelligence | null;
  bestDeals: MobileProductBestDeal[];
  similarProducts: MobileSimilarProduct[];
};

// ─── Favorites ───

export type MobileFavoriteItem = {
  id: string;
  listingId: string;
  listing: MobileProductListing | null;
  productName: string;
  productSlug: string | null;
  createdAt: string;
};

export type MobileFavoritesListResponse = {
  favorites: MobileFavoriteItem[];
};

export type MobileFavoriteCreatedResponse = {
  favoriteId: string;
};
