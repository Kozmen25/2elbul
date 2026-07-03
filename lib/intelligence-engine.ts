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
export type IntelligenceTrendStrength =
  | "Güçlü yükseliş"
  | "Hafif yükseliş"
  | "Stabil"
  | "Hafif düşüş"
  | "Güçlü düşüş"
  | "Veri yok";

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

export type IntelligenceDecisionLabel = "Şimdi Al" | "Bekle" | "Takip Et" | "Veri Az";
export type IntelligenceScoreLevel = "low" | "medium" | "high" | "unknown";

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
    strengthLabel: IntelligenceTrendStrength;
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
  decisionSupport: {
    buyScore: number;
    waitScore: number;
    volatilityScore: number;
    volatilityLevel: IntelligenceScoreLevel;
    liquidityScore: number;
    liquidityLevel: IntelligenceScoreLevel;
    label: IntelligenceDecisionLabel;
    explanation: string;
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
    strengthLabel: "Veri yok",
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
  decisionSupport: {
    buyScore: 0,
    waitScore: 0,
    volatilityScore: 0,
    volatilityLevel: "unknown",
    liquidityScore: 0,
    liquidityLevel: "unknown",
    label: "Veri Az",
    explanation:
      "Satın alma tavsiyesi için en az 3 karşılaştırılabilir ilan ve mümkünse fiyat geçmişi gerekir.",
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
  const decisionSupport = buildDecisionSupport({
    prices,
    listings: input.listings,
    priceHistory: input.priceHistory ?? [],
    marketValue,
    trend,
    demand,
    opportunityScore: opportunity.score,
    now: input.now ?? new Date(),
  });

  return {
    marketValue,
    trend,
    demand,
    opportunity,
    recommendation,
    decisionSupport,
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
  const strengthLabel = buildTrendStrength(changePercent);
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
    strengthLabel,
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

function buildDecisionSupport({
  prices,
  listings,
  priceHistory,
  marketValue,
  trend,
  demand,
  opportunityScore,
  now,
}: {
  prices: number[];
  listings: IntelligenceListingInput[];
  priceHistory: IntelligencePriceHistoryInput[];
  marketValue: ProductIntelligence["marketValue"];
  trend: ProductIntelligence["trend"];
  demand: ProductIntelligence["demand"];
  opportunityScore: number;
  now: Date;
}): ProductIntelligence["decisionSupport"] {
  if (
    prices.length < 3 ||
    !marketValue.averagePrice ||
    !marketValue.medianPrice ||
    !marketValue.minPrice
  ) {
    return insufficientIntelligence.decisionSupport;
  }

  const averagePrice = marketValue.averagePrice;
  const medianPrice = marketValue.medianPrice;
  const minPrice = marketValue.minPrice;
  const cheapestAverageDiscount = ((averagePrice - minPrice) / averagePrice) * 100;
  const cheapestMedianDiscount = ((medianPrice - minPrice) / medianPrice) * 100;
  const volatilityRatio = calculateVolatilityRatio(prices, averagePrice);
  const volatilityScore = clampScore(Math.round(volatilityRatio * 160));
  const volatilityLevel = scoreLevel(volatilityScore, 25, 55);
  const recentListingCount = countRecentListings(listings, now, 14);
  const recentDropRate = calculateRecentDropRate(priceHistory, listings);
  const liquidityScore = buildLiquidityScore({
    listingCount: prices.length,
    recentListingCount,
    demandLevel: demand.demandLevel,
    searchCount: demand.searchCount,
  });
  const liquidityLevel = scoreLevel(liquidityScore, 35, 65);
  const confidenceProxy = clampScore(
    35 + Math.min(30, prices.length * 4) + Math.max(0, 35 - volatilityScore),
  );

  let buyScore = 38;
  buyScore += Math.min(35, Math.max(0, cheapestAverageDiscount) * 1.25);
  buyScore += Math.min(12, Math.max(0, cheapestMedianDiscount) * 0.45);
  buyScore += trend.direction === "stable" ? 9 : trend.direction === "rising" ? 7 : -8;
  buyScore += demand.demandLevel === "high" ? 7 : demand.demandLevel === "medium" ? 4 : 0;
  buyScore += liquidityScore >= 65 ? 7 : liquidityScore >= 35 ? 3 : -5;
  buyScore += confidenceProxy >= 70 ? 7 : confidenceProxy >= 55 ? 3 : -8;
  buyScore -= volatilityScore >= 60 ? 18 : volatilityScore >= 35 ? 8 : 0;
  buyScore = clampScore(Math.round((buyScore + opportunityScore) / 2));

  let waitScore = 28;
  waitScore += trend.direction === "falling" ? 28 : trend.direction === "stable" ? 6 : -8;
  waitScore += Math.min(24, Math.max(0, recentDropRate) * 2.2);
  waitScore += recentListingCount >= 5 ? 10 : recentListingCount >= 2 ? 5 : 0;
  waitScore += demand.demandLevel === "low" ? 8 : demand.demandLevel === "medium" ? 3 : -5;
  waitScore += volatilityScore >= 55 ? 11 : volatilityScore >= 35 ? 5 : -2;
  waitScore -= cheapestAverageDiscount >= 12 && trend.direction !== "falling" ? 15 : 0;
  waitScore = clampScore(Math.round(waitScore));

  const label: IntelligenceDecisionLabel =
    prices.length < 3
      ? "Veri Az"
      : buyScore >= 68 && buyScore >= waitScore + 8
        ? "Şimdi Al"
        : waitScore >= 62 && waitScore > buyScore
          ? "Bekle"
          : "Takip Et";

  return {
    buyScore,
    waitScore,
    volatilityScore,
    volatilityLevel,
    liquidityScore,
    liquidityLevel,
    label,
    explanation: buildDecisionExplanation({
      label,
      trend,
      cheapestAverageDiscount,
      recentDropRate,
      volatilityLevel,
      liquidityLevel,
    }),
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

function buildTrendStrength(changePercent: number): IntelligenceTrendStrength {
  if (changePercent <= -10) return "Güçlü düşüş";
  if (changePercent <= -3) return "Hafif düşüş";
  if (changePercent >= 10) return "Güçlü yükseliş";
  if (changePercent >= 3) return "Hafif yükseliş";
  return "Stabil";
}

function calculateVolatilityRatio(prices: number[], averagePrice: number) {
  if (!prices.length || !averagePrice) return 0;
  const variance =
    prices.reduce((sum, price) => sum + (price - averagePrice) ** 2, 0) /
    prices.length;
  return Math.sqrt(variance) / averagePrice;
}

function countRecentListings(
  listings: IntelligenceListingInput[],
  now: Date,
  days: number,
) {
  const cutoff = now.getTime() - days * 86_400_000;
  return listings.filter((listing) => {
    if (!listing.createdAt) return false;
    const time = new Date(listing.createdAt).getTime();
    return Number.isFinite(time) && time >= cutoff;
  }).length;
}

function calculateRecentDropRate(
  priceHistory: IntelligencePriceHistoryInput[],
  listings: IntelligenceListingInput[],
) {
  const points = (
    priceHistory.length >= 2
      ? priceHistory.map((record) => ({
          price: Number(record.price),
          date: record.recordedAt,
        }))
      : listings.map((listing) => ({
          price: Number(listing.price),
          date: listing.createdAt ?? "",
        }))
  )
    .filter((point) => Number.isFinite(point.price) && point.price > 0 && point.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (points.length < 2) return 0;
  const recent = points.slice(-3);
  const first = recent[0];
  const last = recent[recent.length - 1];
  if (!first || !last || first.price <= 0) return 0;
  return roundPercent(((first.price - last.price) / first.price) * 100);
}

function buildLiquidityScore({
  listingCount,
  recentListingCount,
  demandLevel,
  searchCount,
}: {
  listingCount: number;
  recentListingCount: number;
  demandLevel: IntelligenceDemandLevel;
  searchCount: number;
}) {
  let score = 12;
  score += Math.min(42, listingCount * 5);
  score += Math.min(22, recentListingCount * 6);
  score += demandLevel === "high" ? 22 : demandLevel === "medium" ? 12 : demandLevel === "low" ? 4 : 0;
  score += Math.min(14, Math.floor(searchCount / 3));
  return clampScore(score);
}

function scoreLevel(
  score: number,
  mediumThreshold: number,
  highThreshold: number,
): IntelligenceScoreLevel {
  if (!Number.isFinite(score)) return "unknown";
  if (score >= highThreshold) return "high";
  if (score >= mediumThreshold) return "medium";
  return "low";
}

function buildDecisionExplanation({
  label,
  trend,
  cheapestAverageDiscount,
  recentDropRate,
  volatilityLevel,
  liquidityLevel,
}: {
  label: IntelligenceDecisionLabel;
  trend: ProductIntelligence["trend"];
  cheapestAverageDiscount: number;
  recentDropRate: number;
  volatilityLevel: IntelligenceScoreLevel;
  liquidityLevel: IntelligenceScoreLevel;
}) {
  if (label === "Şimdi Al") {
    return `Bu ürün ${trend.periodLabel} içinde ${trend.strengthLabel.toLocaleLowerCase("tr-TR")} sinyali veriyor. En ucuz ilan piyasa ortalamasının %${Math.max(0, roundPercent(cheapestAverageDiscount))} altında; şu an satın almak için uygun bir dönem olabilir.`;
  }

  if (label === "Bekle") {
    return `Son fiyat sinyali ${trend.strengthLabel.toLocaleLowerCase("tr-TR")} yönünde. Son hareketlerde yaklaşık %${Math.max(0, recentDropRate)} düşüş görüldüğü için birkaç gün beklemek daha avantajlı olabilir.`;
  }

  if (volatilityLevel === "high") {
    return "Fiyatlar dalgalı görünüyor. İlan detaylarını dikkatli inceleyip fiyat alarmıyla takip etmek daha sağlıklı olur.";
  }

  if (liquidityLevel === "high") {
    return "Piyasa aktif; yeni ilan gelme ihtimali yüksek. Acele etmeden güçlü fırsatları takip etmek mantıklı.";
  }

  return "Veriler net bir alım veya bekleme sinyali üretmiyor. Bu ürün için fiyat alarmı kurup piyasayı izlemek daha dengeli bir karar olur.";
}

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}
