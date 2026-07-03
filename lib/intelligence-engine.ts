export type IntelligenceListingInput = {
  price: number | string | null | undefined;
  createdAt?: string | null;
};

export type IntelligencePriceHistoryInput = {
  price: number | string | null | undefined;
  recordedAt: string;
};

export type IntelligenceDemandInput = {
  searchCount?: number | null;
  recentSearchCount?: number | null;
};

export type IntelligenceTrendDirection =
  | "rising"
  | "falling"
  | "stable"
  | "unknown";

export type IntelligenceDemandLevel = "low" | "medium" | "high" | "unknown";

export type IntelligenceOpportunityLabel =
  | "Güçlü fırsat"
  | "Takip etmeye değer"
  | "Normal piyasa"
  | "Dikkatli incele"
  | "Veri yetersiz";

export type IntelligenceRecommendationAction =
  | "buy_now"
  | "watch"
  | "wait"
  | "insufficient_data";

export type ProductIntelligence = {
  marketValue: {
    averagePrice: number | null;
    medianPrice: number | null;
    minPrice: number | null;
    maxPrice: number | null;
    priceRange: number | null;
    listingCount: number;
  };
  trend: {
    direction: IntelligenceTrendDirection;
    changePercent: number | null;
    periodLabel: string;
    explanation: string;
  };
  demand: {
    searchCount: number;
    recentSearchCount: number;
    demandLevel: IntelligenceDemandLevel;
    explanation: string;
  };
  opportunity: {
    score: number;
    label: IntelligenceOpportunityLabel;
    explanation: string;
  };
  recommendation: {
    action: IntelligenceRecommendationAction;
    title: string;
    description: string;
  };
};

type CalculateProductIntelligenceInput = {
  listings: IntelligenceListingInput[];
  priceHistory?: IntelligencePriceHistoryInput[];
  demand?: IntelligenceDemandInput;
  now?: Date;
};

const insufficientIntelligence: ProductIntelligence = {
  marketValue: {
    averagePrice: null,
    medianPrice: null,
    minPrice: null,
    maxPrice: null,
    priceRange: null,
    listingCount: 0,
  },
  trend: {
    direction: "unknown",
    changePercent: null,
    periodLabel: "Veri yok",
    explanation: "Trend hesaplamak için yeterli fiyat geçmişi bulunmuyor.",
  },
  demand: {
    searchCount: 0,
    recentSearchCount: 0,
    demandLevel: "unknown",
    explanation: "Talep seviyesi için yeterli arama verisi yok.",
  },
  opportunity: {
    score: 0,
    label: "Veri yetersiz",
    explanation: "Fırsat skoru için en az 3 karşılaştırılabilir ilan gerekir.",
  },
  recommendation: {
    action: "insufficient_data",
    title: "Veri yetersiz",
    description:
      "Bu ürün için sağlıklı karar desteği üretecek kadar ilan veya geçmiş veri yok.",
  },
};

export function calculateProductIntelligence(
  input: CalculateProductIntelligenceInput,
): ProductIntelligence {
  const prices = normalizePrices(input.listings.map((listing) => listing.price));
  const demand = buildDemand(input.demand);
  const marketValue = buildMarketValue(prices);

  if (prices.length < 3 || !marketValue.averagePrice || !marketValue.medianPrice) {
    return {
      ...insufficientIntelligence,
      marketValue,
      demand,
    };
  }

  const trend = buildTrend(input.priceHistory ?? [], input.listings);
  const opportunity = buildOpportunity({
    prices,
    averagePrice: marketValue.averagePrice,
    minPrice: marketValue.minPrice,
    trendDirection: trend.direction,
  });
  const recommendation = buildRecommendation({
    opportunityLabel: opportunity.label,
    opportunityScore: opportunity.score,
    trendDirection: trend.direction,
    demandLevel: demand.demandLevel,
    changePercent: trend.changePercent,
  });

  return {
    marketValue,
    trend,
    demand,
    opportunity,
    recommendation,
  };
}

function buildMarketValue(prices: number[]): ProductIntelligence["marketValue"] {
  if (!prices.length) {
    return insufficientIntelligence.marketValue;
  }

  const sorted = [...prices].sort((a, b) => a - b);
  const total = sorted.reduce((sum, price) => sum + price, 0);
  const minPrice = sorted[0];
  const maxPrice = sorted[sorted.length - 1];

  return {
    averagePrice: Math.round(total / sorted.length),
    medianPrice: Math.round(median(sorted)),
    minPrice,
    maxPrice,
    priceRange: maxPrice - minPrice,
    listingCount: sorted.length,
  };
}

function buildTrend(
  priceHistory: IntelligencePriceHistoryInput[],
  listings: IntelligenceListingInput[],
): ProductIntelligence["trend"] {
  const historyPoints = priceHistory
    .map((record) => ({
      price: Number(record.price),
      date: record.recordedAt,
    }))
    .filter((point) => Number.isFinite(point.price) && point.price > 0 && point.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const points =
    historyPoints.length >= 2
      ? historyPoints
      : listings
          .map((listing) => ({
            price: Number(listing.price),
            date: listing.createdAt ?? "",
          }))
          .filter((point) => Number.isFinite(point.price) && point.price > 0 && point.date)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (points.length < 2) {
    return insufficientIntelligence.trend;
  }

  const first = points[0];
  const last = points[points.length - 1];
  const changePercent = roundPercent(((last.price - first.price) / first.price) * 100);
  const direction: IntelligenceTrendDirection =
    changePercent <= -4 ? "falling" : changePercent >= 4 ? "rising" : "stable";
  const days = Math.max(
    1,
    Math.round(
      (new Date(last.date).getTime() - new Date(first.date).getTime()) /
        86_400_000,
    ),
  );
  const periodLabel = `${days} günlük sinyal`;

  return {
    direction,
    changePercent,
    periodLabel,
    explanation:
      direction === "falling"
        ? `Fiyat sinyali ${periodLabel} içinde yaklaşık %${Math.abs(changePercent)} düşüş gösteriyor.`
        : direction === "rising"
          ? `Fiyat sinyali ${periodLabel} içinde yaklaşık %${changePercent} yükseliş gösteriyor.`
          : `Fiyat sinyali ${periodLabel} içinde dengeli seyrediyor.`,
  };
}

function buildDemand(
  demand?: IntelligenceDemandInput,
): ProductIntelligence["demand"] {
  const searchCount = Math.max(0, Math.trunc(Number(demand?.searchCount ?? 0)));
  const recentSearchCount = Math.max(
    0,
    Math.trunc(Number(demand?.recentSearchCount ?? 0)),
  );

  if (!searchCount && !recentSearchCount) {
    return insufficientIntelligence.demand;
  }

  const demandLevel: IntelligenceDemandLevel =
    recentSearchCount >= 8 || searchCount >= 25
      ? "high"
      : recentSearchCount >= 3 || searchCount >= 8
        ? "medium"
        : "low";

  return {
    searchCount,
    recentSearchCount,
    demandLevel,
    explanation:
      demandLevel === "high"
        ? "Bu ürün için arama ilgisi yüksek; iyi ilanlar daha hızlı tükenebilir."
        : demandLevel === "medium"
          ? "Bu ürün düzenli takip ediliyor; fiyat değişimleri izlenmeye değer."
          : "Arama talebi düşük; karar için fiyat verisi daha belirleyici.",
  };
}

function buildOpportunity({
  prices,
  averagePrice,
  minPrice,
  trendDirection,
}: {
  prices: number[];
  averagePrice: number;
  minPrice: number | null;
  trendDirection: IntelligenceTrendDirection;
}): ProductIntelligence["opportunity"] {
  if (prices.length < 3 || !minPrice) {
    return insufficientIntelligence.opportunity;
  }

  const cheapestDiscount = ((averagePrice - minPrice) / averagePrice) * 100;
  const spread = (Math.max(...prices) - Math.min(...prices)) / averagePrice;
  let score = 45;

  if (cheapestDiscount >= 20) score += 32;
  else if (cheapestDiscount >= 10) score += 22;
  else if (cheapestDiscount >= 5) score += 12;
  else if (cheapestDiscount < -5) score -= 15;

  if (trendDirection === "stable") score += 8;
  if (trendDirection === "falling") score -= 10;
  if (trendDirection === "rising") score += 4;
  if (prices.length >= 8) score += 8;
  if (spread >= 0.75) score -= 22;
  else if (spread >= 0.45) score -= 10;

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  const label: IntelligenceOpportunityLabel =
    spread >= 0.75 || cheapestDiscount >= 40
      ? "Dikkatli incele"
      : finalScore >= 70
        ? "Güçlü fırsat"
        : finalScore >= 58
          ? "Takip etmeye değer"
          : "Normal piyasa";

  return {
    score: finalScore,
    label,
    explanation:
      label === "Dikkatli incele"
        ? "Fiyat sapması belirgin; en ucuz ilanı almadan önce satıcı, garanti ve ürün durumunu kontrol et."
        : label === "Güçlü fırsat"
          ? "En düşük fiyat piyasa ortalamasının anlamlı şekilde altında görünüyor."
          : label === "Takip etmeye değer"
            ? "Piyasada takip edilebilir bir fiyat avantajı var."
            : "Fiyatlar genel olarak normal piyasa bandında.",
  };
}

function buildRecommendation({
  opportunityLabel,
  opportunityScore,
  trendDirection,
  demandLevel,
  changePercent,
}: {
  opportunityLabel: IntelligenceOpportunityLabel;
  opportunityScore: number;
  trendDirection: IntelligenceTrendDirection;
  demandLevel: IntelligenceDemandLevel;
  changePercent: number | null;
}): ProductIntelligence["recommendation"] {
  if (opportunityLabel === "Veri yetersiz") {
    return insufficientIntelligence.recommendation;
  }

  if (opportunityLabel === "Dikkatli incele") {
    return {
      action: "watch",
      title: "Detaylı kontrol et",
      description:
        "Fiyat sinyali güçlü olsa bile sapma yüksek. Satıcı güveni, cihaz durumu ve ilan detaylarını kontrol et.",
    };
  }

  if (trendDirection === "falling" && (changePercent ?? 0) <= -7) {
    return {
      action: "wait",
      title: "Biraz beklemek mantıklı",
      description:
        "Fiyat trendi düşüş yönünde. Acele yoksa yeni ilanları izlemek daha iyi fiyat yakalatabilir.",
    };
  }

  if (
    opportunityScore >= 72 &&
    (trendDirection === "stable" || trendDirection === "rising") &&
    demandLevel !== "low"
  ) {
    return {
      action: "buy_now",
      title: "Alım için uygun sinyal",
      description:
        "Piyasa dengeli ve fiyat avantajı belirgin. İlan detayları temizse hızlı davranmak mantıklı olabilir.",
    };
  }

  if (opportunityScore >= 58) {
    return {
      action: "watch",
      title: "Takip etmeye değer",
      description:
        "Fiyat avantajı var ancak karar vermeden önce birkaç ilanı daha karşılaştırmak iyi olur.",
    };
  }

  return {
    action: "watch",
    title: "Piyasayı izle",
    description:
      "Şu an fiyatlar normal bantta. Alarm kurup daha iyi fırsatları beklemek mantıklı.",
  };
}

function normalizePrices(values: Array<number | string | null | undefined>) {
  return values
    .map((value) => Number(value))
    .filter((price) => Number.isFinite(price) && price > 0);
}

function median(sorted: number[]) {
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function roundPercent(value: number) {
  return Math.round(value * 10) / 10;
}
