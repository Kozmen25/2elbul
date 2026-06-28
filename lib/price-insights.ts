export type MarketStats = {
  count: number;
  sampleCount: number;
  marketValue: number;
  median: number;
  average: number;
  lowest: number;
  highest: number;
};

export type OpportunityRating = {
  stars: number;
  label: "Harika Fırsat" | "İyi Fırsat" | "Normal" | "Pahalı" | "Dikkat";
  percent: number;
  suspicious: boolean;
  className: string;
};

export type PriceHistoryRecord = {
  price: number;
  recordedAt: string;
};

export type DailyPricePoint = {
  date: string;
  lowest: number;
  average: number;
  highest: number;
  market: number;
};

export type PriceHistorySummary = {
  todayPrice: number | null;
  change7: number | null;
  change30: number | null;
  change90: number | null;
  lowest: number | null;
  highest: number | null;
};

export function calculateMarketStats(prices: number[]): MarketStats | null {
  const sorted = prices
    .filter((price) => Number.isFinite(price) && price > 0)
    .sort((a, b) => a - b);

  if (!sorted.length) return null;

  const median = calculateMedian(sorted);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  const iqrLower = q1 - iqr * 1.5;
  const iqrUpper = q3 + iqr * 1.5;
  const medianLower = median * 0.55;
  const medianUpper = median * 1.8;
  const filtered =
    sorted.length >= 4
      ? sorted.filter(
          (price) =>
            price >= Math.max(iqrLower, medianLower) &&
            price <= Math.min(iqrUpper, medianUpper),
        )
      : sorted;
  const sample = filtered.length >= 2 ? filtered : sorted;
  const average = sample.reduce((total, price) => total + price, 0) / sample.length;
  const sampleMedian = calculateMedian(sample);
  const marketValue = Math.round(sampleMedian * 0.6 + average * 0.4);

  return {
    count: sorted.length,
    sampleCount: sample.length,
    marketValue,
    median: Math.round(sampleMedian),
    average: Math.round(average),
    lowest: sorted[0],
    highest: sorted[sorted.length - 1],
  };
}

export function calculateOpportunityRating(
  price: number,
  marketValue: number | null | undefined,
  comparableCount: number,
): OpportunityRating {
  if (!marketValue || comparableCount < 2) {
    return {
      stars: 4,
      label: "Normal",
      percent: 0,
      suspicious: false,
      className: "border-slate-200 bg-slate-50 text-slate-600",
    };
  }

  const percent = Math.round(((marketValue - price) / marketValue) * 100);
  if (percent >= 40) {
    return {
      stars: 2,
      label: "Dikkat",
      percent,
      suspicious: true,
      className: "border-red-200 bg-red-50 text-red-700",
    };
  }
  if (percent >= 8) {
    return {
      stars: 5,
      label: "Harika Fırsat",
      percent,
      suspicious: false,
      className: "border-green-200 bg-green-50 text-green-700",
    };
  }
  if (percent >= 3) {
    return {
      stars: 5,
      label: "İyi Fırsat",
      percent,
      suspicious: false,
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }
  if (percent <= -12) {
    return {
      stars: 2,
      label: "Pahalı",
      percent,
      suspicious: false,
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }
  return {
    stars: 4,
    label: "Normal",
    percent,
    suspicious: false,
    className: "border-slate-200 bg-slate-50 text-slate-600",
  };
}

export function buildDailyPriceHistory(
  records: PriceHistoryRecord[],
): DailyPricePoint[] {
  const grouped = new Map<string, number[]>();
  for (const record of records) {
    if (!Number.isFinite(record.price) || record.price <= 0) continue;
    const date = record.recordedAt.slice(0, 10);
    grouped.set(date, [...(grouped.get(date) ?? []), record.price]);
  }

  return [...grouped.entries()]
    .map(([date, prices]) => {
      const stats = calculateMarketStats(prices);
      const average = Math.round(
        prices.reduce((total, price) => total + price, 0) / prices.length,
      );
      return {
        date,
        lowest: Math.min(...prices),
        average,
        highest: Math.max(...prices),
        market: stats?.marketValue ?? average,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function summarizePriceHistory(
  points: DailyPricePoint[],
): PriceHistorySummary {
  const latest = points.at(-1) ?? null;
  const prices = points.flatMap((point) => [
    point.lowest,
    point.average,
    point.highest,
  ]);

  return {
    todayPrice: latest?.market ?? null,
    change7: latest ? calculateChange(points, 7, latest.market) : null,
    change30: latest ? calculateChange(points, 30, latest.market) : null,
    change90: latest ? calculateChange(points, 90, latest.market) : null,
    lowest: prices.length ? Math.min(...prices) : null,
    highest: prices.length ? Math.max(...prices) : null,
  };
}

function calculateChange(
  points: DailyPricePoint[],
  days: number,
  currentPrice: number,
) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const baseline =
    [...points]
      .reverse()
      .find((point) => new Date(`${point.date}T00:00:00Z`) <= cutoff)?.market ??
    points[0]?.market;

  if (!baseline) return null;
  return Math.round(((currentPrice - baseline) / baseline) * 1000) / 10;
}

function calculateMedian(sorted: number[]) {
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function quantile(sorted: number[], q: number) {
  if (sorted.length === 1) return sorted[0];
  const position = (sorted.length - 1) * q;
  const base = Math.floor(position);
  const rest = position - base;
  return sorted[base + 1] === undefined
    ? sorted[base]
    : sorted[base] + rest * (sorted[base + 1] - sorted[base]);
}
