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
  count: number;
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

/**
 * The one definition of "is this price normal for this product".
 *
 * `differencePercent` is how far a price is from the market baseline (the
 * trimmed average of the listings currently on sale): negative = cheaper.
 * Every badge in the app (listing cards, product summary, price band, search)
 * derives its label from this, so the same listing can never be called a
 * "great deal" in one place and "normal" in another.
 */
export const PRICE_POSITION_THRESHOLDS = {
  /** At least this far below the market is more likely a scam or a defect than a bargain. */
  suspicious: -40,
  great: -15,
  below: -5,
  normal: 10,
  expensive: 25,
} as const;

/** Fewer comparable listings than this and no price judgement is made. */
export const MIN_PRICE_COMPARISON_SAMPLE = 3;

export type PricePosition = "suspicious" | "great" | "below" | "normal" | "expensive" | "very_expensive";

export function classifyPricePosition(differencePercent: number): PricePosition {
  const t = PRICE_POSITION_THRESHOLDS;
  if (differencePercent <= t.suspicious) return "suspicious";
  if (differencePercent <= t.great) return "great";
  if (differencePercent < t.below) return "below";
  if (differencePercent <= t.normal) return "normal";
  if (differencePercent <= t.expensive) return "expensive";
  return "very_expensive";
}

const NEUTRAL_RATING_CLASS = "border-slate-200 bg-slate-50 text-slate-600";

/** Star rating view of classifyPricePosition (same thresholds, buyer-oriented labels). */
export function calculateOpportunityRating(
  price: number,
  marketValue: number | null | undefined,
  comparableCount: number,
): OpportunityRating {
  if (!marketValue || comparableCount < MIN_PRICE_COMPARISON_SAMPLE) {
    return { stars: 4, label: "Normal", percent: 0, suspicious: false, className: NEUTRAL_RATING_CLASS };
  }

  const differencePercent = ((price - marketValue) / marketValue) * 100;
  // Positive = cheaper than the market, as the badges show it.
  const percent = Math.round(-differencePercent);

  switch (classifyPricePosition(differencePercent)) {
    case "suspicious":
      return { stars: 2, label: "Dikkat", percent, suspicious: true, className: "border-red-200 bg-red-50 text-red-700" };
    case "great":
      return { stars: 5, label: "Harika Fırsat", percent, suspicious: false, className: "border-green-200 bg-green-50 text-green-700" };
    case "below":
      return { stars: 5, label: "İyi Fırsat", percent, suspicious: false, className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
    case "normal":
      return { stars: 4, label: "Normal", percent, suspicious: false, className: NEUTRAL_RATING_CLASS };
    default:
      return { stars: 2, label: "Pahalı", percent, suspicious: false, className: "border-amber-200 bg-amber-50 text-amber-700" };
  }
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
        count: prices.length,
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

// ---------------------------------------------------------------------------
// Price history chart (range selection and period summary)
// ---------------------------------------------------------------------------

export type HistoryRangeKey = "7" | "30" | "90" | "all";

export const HISTORY_RANGES: ReadonlyArray<{ key: HistoryRangeKey; label: string; days: number | null }> = [
  { key: "7", label: "7 gün", days: 7 },
  { key: "30", label: "30 gün", days: 30 },
  { key: "90", label: "90 gün", days: 90 },
  { key: "all", label: "Tümü", days: null },
];

/** A chart needs at least two days to draw a line. */
export const MIN_HISTORY_POINTS = 2;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type HistoryPointLike = {
  date: string;
  average: number;
  lowest: number;
  highest: number;
  count: number;
};

/**
 * Days (YYYY-MM-DD) inside the last `days` days, today included. `null` keeps
 * everything. Strict on purpose: a range with too few days stays short instead
 * of silently showing older data under the wrong label.
 */
export function selectHistoryRange<T extends { date: string }>(
  points: T[],
  days: number | null,
  today: Date = new Date(),
): T[] {
  if (days === null) return points;
  const cutoff = new Date(today.getTime() - (days - 1) * MS_PER_DAY).toISOString().slice(0, 10);
  return points.filter((point) => point.date >= cutoff);
}

/** 30 days when that already draws a line, otherwise everything recorded so far. */
export function defaultHistoryRange(points: { date: string }[], today: Date = new Date()): HistoryRangeKey {
  return selectHistoryRange(points, 30, today).length >= MIN_HISTORY_POINTS ? "30" : "all";
}

export type HistoryRangeSummary = {
  /** Mean over every recorded price in the range (days weighted by their record count). */
  average: number;
  lowest: number;
  highest: number;
  /** First to last day average, in percent (one decimal); null with fewer than two days. */
  changePercent: number | null;
  firstDate: string;
  lastDate: string;
  recordCount: number;
};

export function summarizeHistoryRange(points: HistoryPointLike[]): HistoryRangeSummary | null {
  if (points.length === 0) return null;

  const recordCount = points.reduce((total, point) => total + point.count, 0);
  const weightedTotal = points.reduce((total, point) => total + point.average * point.count, 0);
  const first = points[0];
  const last = points[points.length - 1];
  const changePercent =
    points.length >= MIN_HISTORY_POINTS && first.average > 0
      ? Math.round(((last.average - first.average) / first.average) * 1000) / 10
      : null;

  return {
    average: recordCount > 0 ? Math.round(weightedTotal / recordCount) : Math.round(last.average),
    lowest: Math.min(...points.map((point) => point.lowest)),
    highest: Math.max(...points.map((point) => point.highest)),
    changePercent,
    firstDate: first.date,
    lastDate: last.date,
    recordCount,
  };
}

/** Index of the chart point closest to a horizontal position inside [left, right]. */
export function nearestPointIndex(x: number, count: number, left: number, right: number): number {
  if (count <= 1 || right <= left) return 0;
  const ratio = Math.min(1, Math.max(0, (x - left) / (right - left)));
  return Math.round(ratio * (count - 1));
}

// ---------------------------------------------------------------------------
// Price trend
// ---------------------------------------------------------------------------

/** Moves smaller than this are "stable" (the same band market pulse uses). */
export const TREND_STABLE_BAND_PERCENT = 4;

export type PriceTrendDirection = "falling" | "rising" | "stable";

export type PriceTrend = {
  direction: PriceTrendDirection;
  /** First to last daily average in the window, percent with one decimal. */
  changePercent: number;
  /** Calendar days between the first and the last day used. */
  spanDays: number;
};

/**
 * Trend over the last `windowDays` days from DAILY averages.
 *
 * price_history stores one snapshot per listing, so comparing the first and
 * last raw record would compare two different listings. Daily averages are
 * the smallest unit that says something about the market. Returns null when
 * the window holds fewer than two distinct days: no data, no trend.
 */
export function calculatePriceTrend(
  points: { date: string; average: number }[],
  windowDays: number,
  today: Date = new Date(),
): PriceTrend | null {
  const inWindow = selectHistoryRange(points, windowDays, today).filter(
    (point) => Number.isFinite(point.average) && point.average > 0,
  );
  if (inWindow.length < MIN_HISTORY_POINTS) return null;

  const first = inWindow[0];
  const last = inWindow[inWindow.length - 1];
  const changePercent = Math.round(((last.average - first.average) / first.average) * 1000) / 10;
  const direction: PriceTrendDirection =
    changePercent <= -TREND_STABLE_BAND_PERCENT
      ? "falling"
      : changePercent >= TREND_STABLE_BAND_PERCENT
        ? "rising"
        : "stable";
  const spanDays = Math.max(
    1,
    Math.round((Date.parse(`${last.date}T00:00:00Z`) - Date.parse(`${first.date}T00:00:00Z`)) / MS_PER_DAY),
  );

  return { direction, changePercent, spanDays };
}
