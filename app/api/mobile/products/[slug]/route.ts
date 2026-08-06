import { getProductDetail } from "@/lib/product-detail";
import { isMissingStatusColumn } from "@/lib/listing-status";
import { createSupabaseClient } from "@/lib/supabase";
import { mobileSuccess, mobileError } from "@/lib/mobile/response";
import type { Listing, ListingCondition, ListingSource } from "@/lib/listings";
import type {
  MobileProductDetailResponse,
  MobileProductListing,
  MobilePriceHistoryPoint,
  MobileProductDecisionInsight,
  MobileProductConfidence,
  MobileProductSmartPrice,
  MobileProductBestDeal,
  MobileSimilarProduct,
  MobileMarketIntelligence,
} from "@/lib/mobile/types";
import type { OpportunityAnalysis } from "@/lib/opportunity-engine/types";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const includeListings = _request.nextUrl.searchParams.get("includeListings") !== "false";
  const includeHistory = _request.nextUrl.searchParams.get("includeHistory") !== "false";
  const includeSimilar = _request.nextUrl.searchParams.get("includeSimilar") !== "false";

  const detail = await getProductDetail(slug);
  if (!detail) {
    return mobileError("Ürün bulunamadı.", 404);
  }

  const response: MobileProductDetailResponse = {
    product: {
      id: detail.product.id,
      name: detail.product.name,
      slug: detail.product.slug,
      category: detail.product.category,
      createdAt: "", // not directly available from ProductRecord
    },
    listings: includeListings ? detail.listings.map(toMobileProductListing) : [],
    priceHistory: includeHistory ? detail.priceHistory.map(toMobilePricePoint) : [],
    decisionInsight: toMobileDecisionInsight(detail.decisionInsight),
    marketIntelligence: toMobileMarketIntelligence(
      detail,
      detail.listings,
    ),
    bestDeals: detail.bestDeals.map(toMobileBestDeal),
    similarProducts: includeSimilar
      ? detail.relatedProducts.map(toMobileSimilarProduct)
      : [],
  };

  return mobileSuccess(response);
}

function toMobileProductListing(l: Listing): MobileProductListing {
  return {
    id: l.id,
    title: l.title,
    price: l.price,
    city: l.city,
    source: l.source,
    condition: l.condition,
    imageUrl: l.imageUrl,
    url: l.url,
    createdAt: l.createdAt,
  };
}

function toMobilePricePoint(
  p: { price: number; recordedAt: string },
): MobilePriceHistoryPoint {
  return { date: p.recordedAt, price: p.price };
}

function toMobileDecisionInsight(
  insight: {
    confidence: {
      score: number | null;
      level: string;
      description: string;
      reasons: string[];
      warnings: string[];
    };
    smartPrice: {
      summary: string;
      details: string[];
      warnings: string[];
    };
  },
): MobileProductDecisionInsight {
  return {
    confidence: {
      score: insight.confidence.score ?? 0,
      level: insight.confidence.level,
      description: insight.confidence.description,
      reasons: insight.confidence.reasons,
      warnings: insight.confidence.warnings,
    },
    smartPrice: {
      summary: insight.smartPrice.summary,
      details: insight.smartPrice.details,
      warnings: insight.smartPrice.warnings,
    },
  };
}

function toMobileBestDeal(
  deal: {
    listing: Listing;
    differencePercent: number | null;
    label: string;
  },
): MobileProductBestDeal {
  return {
    listing: toMobileProductListing(deal.listing),
    differencePercent: deal.differencePercent ?? 0,
    label: deal.label,
  };
}

function toMobileSimilarProduct(
  sp: {
    id: string;
    name: string;
    slug: string;
    category: string | null;
    listingCount: number;
    averagePrice: number | null;
    minPrice: number | null;
  },
): MobileSimilarProduct {
  return {
    id: sp.id,
    name: sp.name,
    slug: sp.slug,
    listingCount: sp.listingCount,
    averagePrice: sp.averagePrice ?? 0,
    minPrice: sp.minPrice ?? 0,
  };
}

function toMobileMarketIntelligence(
  detail: {
    marketIntelligence: {
      totalListings?: number;
      averagePrice?: number;
      medianPrice?: number;
      priceRange?: { min: number; max: number };
      sourceDistribution?: { source: string; count: number }[];
      conditionDistribution?: { condition: string; count: number }[];
      opportunityAnalysis?: OpportunityAnalysis;
    };
  },
  listings: Listing[],
): MobileMarketIntelligence | null {
  const mi = detail.marketIntelligence;
  if (!mi) return null;

  return {
    totalListingsInCategory: mi.totalListings ?? listings.length,
    averagePrice: mi.averagePrice ?? 0,
    medianPrice: mi.medianPrice ?? 0,
    priceRange: mi.priceRange ?? {
      min: Math.min(...listings.map((l) => l.price)),
      max: Math.max(...listings.map((l) => l.price)),
    },
    sourceDistribution: (mi.sourceDistribution ?? []).map((s) => ({
      source: s.source as ListingSource,
      count: s.count,
    })),
    conditionDistribution: (mi.conditionDistribution ?? []).map((c) => ({
      condition: c.condition as ListingCondition,
      count: c.count,
    })),
  };
}
