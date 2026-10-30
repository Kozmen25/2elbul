import {
  MIN_PRICE_COMPARISON_SAMPLE,
  calculateMarketStats,
  classifyPricePosition,
  type PricePosition,
} from "@/lib/price-insights";

export type PriceAnalysisLabel =
  | "Şüpheli ucuz"
  | "Çok iyi fırsat"
  | "Piyasanın altında"
  | "Normal fiyat"
  | "Pahalı"
  | "Çok pahalı"
  | "Yetersiz veri";

export type ProductPriceStats = {
  productId: string;
  count: number;
  average: number;
  min: number;
  max: number;
};

export type ListingPriceAnalysis = {
  label: PriceAnalysisLabel;
  count: number;
  average: number | null;
  min: number | null;
  max: number | null;
  differencePercent: number | null;
  className: string;
};

export type PricePoint = {
  productId: string | number | null | undefined;
  price: string | number | null | undefined;
};

const insufficientClassName = "border-slate-200 bg-slate-50 text-slate-600";

/**
 * Per-product price figures from the listings currently on sale. The average
 * is the trimmed market average (calculateMarketStats), so one absurd listing
 * cannot drag every other listing's label; min and max stay the raw extremes.
 */
export function buildProductPriceStats(
  listings: PricePoint[],
): Record<string, ProductPriceStats> {
  const grouped = new Map<string, number[]>();

  for (const listing of listings) {
    if (listing.productId == null) continue;
    const productId = String(listing.productId);
    const price = Number(listing.price);
    if (!productId || !Number.isFinite(price) || price <= 0) continue;
    grouped.set(productId, [...(grouped.get(productId) ?? []), price]);
  }

  const stats: Record<string, ProductPriceStats> = {};
  for (const [productId, prices] of grouped) {
    const market = calculateMarketStats(prices);
    if (!market) continue;
    stats[productId] = {
      productId,
      count: market.count,
      average: market.average,
      min: market.lowest,
      max: market.highest,
    };
  }
  return stats;
}

export function analyzeListingPrice(
  price: string | number | null | undefined,
  stats: ProductPriceStats | null | undefined,
): ListingPriceAnalysis {
  const numericPrice = Number(price);
  if (!stats || stats.count < MIN_PRICE_COMPARISON_SAMPLE || !Number.isFinite(numericPrice) || numericPrice <= 0) {
    return {
      label: "Yetersiz veri",
      count: stats?.count ?? 0,
      average: stats?.average ?? null,
      min: stats?.min ?? null,
      max: stats?.max ?? null,
      differencePercent: null,
      className: insufficientClassName,
    };
  }

  const differencePercent =
    ((numericPrice - stats.average) / stats.average) * 100;
  const label = getPriceAnalysisLabel(differencePercent);

  return {
    label,
    count: stats.count,
    average: stats.average,
    min: stats.min,
    max: stats.max,
    differencePercent: Math.round(differencePercent * 10) / 10,
    className: getPriceAnalysisClassName(label),
  };
}

const POSITION_LABELS: Record<PricePosition, PriceAnalysisLabel> = {
  suspicious: "Şüpheli ucuz",
  great: "Çok iyi fırsat",
  below: "Piyasanın altında",
  normal: "Normal fiyat",
  expensive: "Pahalı",
  very_expensive: "Çok pahalı",
};

export function getPriceAnalysisLabel(
  differencePercent: number,
): PriceAnalysisLabel {
  return POSITION_LABELS[classifyPricePosition(differencePercent)];
}

export function getPriceAnalysisClassName(label: PriceAnalysisLabel) {
  switch (label) {
    case "Şüpheli ucuz":
      return "border-red-200 bg-red-50 text-red-700";
    case "Çok iyi fırsat":
      return "border-green-200 bg-green-50 text-green-700";
    case "Piyasanın altında":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "Normal fiyat":
      return "border-slate-200 bg-slate-50 text-slate-700";
    case "Pahalı":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "Çok pahalı":
      return "border-red-200 bg-red-50 text-red-700";
    case "Yetersiz veri":
    default:
      return insufficientClassName;
  }
}
