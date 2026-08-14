import type { MarketStats } from "@/lib/price-insights";
import { calculateOpportunityRating } from "@/lib/price-insights";
import type { ListingPriceHistoryPoint } from "./listing-price-history-chart";
import { formatCurrencyTRY } from "@/lib/formatters";

function computeSevenDayChange(points: ListingPriceHistoryPoint[]): {
  direction: "up" | "down" | "stable";
  changePercent: number | null;
} {
  if (points.length < 2) return { direction: "stable", changePercent: null };
  const latest = points[points.length - 1].average;
  const baseline =
    points.length >= 8 ? points[points.length - 8].average : points[0].average;
  const changePercent = Math.round(((latest - baseline) / baseline) * 100);
  if (changePercent > 3) return { direction: "up", changePercent };
  if (changePercent < -3) return { direction: "down", changePercent };
  return { direction: "stable", changePercent };
}

export function PriceBandPanel({
  marketStats,
  listingPriceHistory,
  currentPrice,
}: {
  marketStats: MarketStats | null;
  listingPriceHistory: ListingPriceHistoryPoint[];
  currentPrice: number;
}) {
  if (!marketStats || marketStats.count < 2) return null;

  const opportunity = calculateOpportunityRating(
    currentPrice,
    marketStats.marketValue,
    marketStats.count,
  );
  const trend = computeSevenDayChange(listingPriceHistory);

  const bandRange = marketStats.highest - marketStats.lowest;
  const currentPercent =
    bandRange > 0
      ? Math.max(
          0,
          Math.min(100, ((currentPrice - marketStats.lowest) / bandRange) * 100),
        )
      : 50;
  const medianPercent =
    bandRange > 0
      ? ((marketStats.median - marketStats.lowest) / bandRange) * 100
      : 50;

  return (
    <section className="mt-8 min-w-0 rounded-3xl border border-black/8 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#ff6b00]">
            Fiyat bandı
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-[-0.035em]">
            Piyasa Analizi
          </h2>
          <p className="mt-1 text-sm leading-6 text-black/55">
            {marketStats.count} ilan üzerinden piyasa özeti.
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-black ${opportunity.className}`}
        >
          {opportunity.label}
          {opportunity.suspicious ? (
            <span className="text-red-500">!</span>
          ) : null}
        </span>
      </div>

      {/* Price band visualization */}
      <div className="relative mt-6">
        <div className="relative h-8">
          <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-gradient-to-r from-green-200 via-yellow-200 to-red-200" />

          {/* Median marker */}
          <div
            className="absolute top-0 h-8 w-0.5 bg-black/40"
            style={{ left: `${medianPercent}%` }}
          >
            <div className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold text-black/40">
              Medyan
            </div>
          </div>

          {/* Current price marker */}
          <div
            className="absolute top-0 h-8 w-1 rounded-sm bg-[#ff6b00] shadow-[0_0_6px_rgba(255,107,0,0.5)]"
            style={{ left: `${currentPercent}%` }}
          >
            <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold text-[#ff6b00]">
              Bu ilan
            </div>
          </div>
        </div>

        <div className="mt-2 flex justify-between text-xs text-black/40">
          <span>{formatCurrencyTRY(marketStats.lowest)}</span>
          <span className="font-bold text-black/60">
            {formatCurrencyTRY(marketStats.highest)}
          </span>
        </div>
      </div>

      {/* Key stats grid */}
      <div className="mt-8 grid grid-cols-3 gap-3">
        <StatBox label="En düşük" value={formatCurrencyTRY(marketStats.lowest)} />
        <StatBox label="Medyan" value={formatCurrencyTRY(marketStats.median)} />
        <StatBox label="Ortalama" value={formatCurrencyTRY(marketStats.average)} />
      </div>

      {/* Trend and market value row */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-black/8 bg-black/[0.02] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-black/40">
            Piyasa değeri
          </span>
          <span className="text-sm font-black">
            {formatCurrencyTRY(marketStats.marketValue)}
          </span>
        </div>
        <div className="h-4 w-px bg-black/10" />
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-black/40">
            7 günlük trend
          </span>
          <span
            className={`text-sm font-black ${
              trend.direction === "up"
                ? "text-red-500"
                : trend.direction === "down"
                  ? "text-green-600"
                  : "text-black/55"
            }`}
          >
            {trend.changePercent !== null
              ? `${trend.direction === "up" ? "+" : ""}${trend.changePercent}%`
              : "—"}
          </span>
        </div>
      </div>
    </section>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-black/8 bg-black/[0.02] p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-black/40">
        {label}
      </p>
      <p className="mt-0.5 text-base font-black">{value}</p>
    </div>
  );
}
