export type PriceAnalysisLabel =
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

  return Object.fromEntries(
    [...grouped.entries()].map(([productId, prices]) => {
      const total = prices.reduce((sum, price) => sum + price, 0);
      return [
        productId,
        {
          productId,
          count: prices.length,
          average: Math.round(total / prices.length),
          min: Math.min(...prices),
          max: Math.max(...prices),
        },
      ];
    }),
  );
}

export function analyzeListingPrice(
  price: string | number | null | undefined,
  stats: ProductPriceStats | null | undefined,
): ListingPriceAnalysis {
  const numericPrice = Number(price);
  if (!stats || stats.count < 3 || !Number.isFinite(numericPrice) || numericPrice <= 0) {
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

export function getPriceAnalysisLabel(
  differencePercent: number,
): PriceAnalysisLabel {
  if (differencePercent <= -15) return "Çok iyi fırsat";
  if (differencePercent < -5) return "Piyasanın altında";
  if (differencePercent <= 10) return "Normal fiyat";
  if (differencePercent <= 25) return "Pahalı";
  return "Çok pahalı";
}

export function getPriceAnalysisClassName(label: PriceAnalysisLabel) {
  switch (label) {
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
