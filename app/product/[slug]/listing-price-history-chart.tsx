"use client";

import { useMemo, useState } from "react";
import { formatCurrencyTRY, formatDateTR } from "@/lib/formatters";

export type ListingPriceHistoryPoint = {
  date: string;
  average: number;
  lowest: number;
  count: number;
};

type RangeKey = "7" | "30" | "90" | "all";

const ranges: Array<{ key: RangeKey; label: string; days?: number }> = [
  { key: "7", label: "7 gün", days: 7 },
  { key: "30", label: "30 gün", days: 30 },
  { key: "90", label: "90 gün", days: 90 },
  { key: "all", label: "Tümü" },
];

const chartWidth = 720;
const chartHeight = 280;
const padding = { top: 24, right: 28, bottom: 42, left: 78 };

const formatPrice = (price: number) => formatCurrencyTRY(price);

const formatShortPrice = (price: number) =>
  `${Math.round(price / 1000).toLocaleString("tr-TR")} bin`;

const formatDate = (date: string) =>
  formatDateTR(`${date}T00:00:00`, {
    day: "numeric",
    month: "short",
  });

export function ListingPriceHistoryChart({
  points,
}: {
  points: ListingPriceHistoryPoint[];
}) {
  const [range, setRange] = useState<RangeKey>("30");
  const filteredPoints = useMemo(() => {
    const selected = ranges.find((item) => item.key === range);
    if (!selected?.days) return points;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - selected.days);
    const scoped = points.filter(
      (point) => new Date(`${point.date}T00:00:00`) >= cutoff,
    );
    return scoped.length >= 2 ? scoped : points.slice(-Math.max(selected.days, 2));
  }, [points, range]);

  const summary = useMemo(() => {
    const last = filteredPoints.at(-1);
    const totalCount = filteredPoints.reduce((total, point) => total + point.count, 0);
    const latestAverage = last?.average ?? null;
    const latestLowest = last?.lowest ?? null;
    return { totalCount, latestAverage, latestLowest };
  }, [filteredPoints]);

  if (points.length < 2) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-black/15 bg-[#fafaf8] px-6 py-10 text-center text-sm font-semibold text-black/45">
        Fiyat grafiği için farklı günlere ait daha fazla ilan verisi gerekli.
      </div>
    );
  }

  const values = filteredPoints.flatMap((point) => [point.average, point.lowest]);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const spread = Math.max(maxValue - minValue, maxValue * 0.08, 1);
  const yMin = Math.max(0, minValue - spread * 0.15);
  const yMax = maxValue + spread * 0.15;

  const averagePath = buildLinePath(filteredPoints, "average", yMin, yMax);
  const lowestPath = buildLinePath(filteredPoints, "lowest", yMin, yMax);
  const firstPoint = filteredPoints[0];
  const lastPoint = filteredPoints.at(-1);

  return (
    <div className="mt-6 min-w-0">
      <div className="flex flex-wrap gap-2">
        {ranges.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setRange(item.key)}
            className={`rounded-full border px-3 py-2 text-xs font-black transition ${
              range === item.key
                ? "border-[#ff6b00] bg-[#ff6b00] text-white"
                : "border-black/10 bg-white text-black/55 hover:border-[#ff6b00]/40"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-black/8 bg-[#fafaf8]">
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            role="img"
            aria-label="Ürün fiyat geçmişi grafiği"
            className="h-[280px] min-w-[620px] w-full"
          >
            <rect width={chartWidth} height={chartHeight} fill="#fafaf8" />
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = padding.top + (chartHeight - padding.top - padding.bottom) * ratio;
              const value = yMax - (yMax - yMin) * ratio;
              return (
                <g key={ratio}>
                  <line
                    x1={padding.left}
                    x2={chartWidth - padding.right}
                    y1={y}
                    y2={y}
                    stroke="rgba(0,0,0,.08)"
                    strokeDasharray="5 7"
                  />
                  <text
                    x={padding.left - 12}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-black/40 text-[11px] font-bold"
                  >
                    {formatShortPrice(value)}
                  </text>
                </g>
              );
            })}

            <path
              d={lowestPath}
              fill="none"
              stroke="#16a34a"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={averagePath}
              fill="none"
              stroke="#ff6b00"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {filteredPoints.map((point, index) => {
              const x = getX(index, filteredPoints.length);
              const y = getY(point.average, yMin, yMax);
              return (
                <g key={`${point.date}-${point.average}`}>
                  <circle cx={x} cy={y} r="4" fill="#ff6b00" />
                  {(index === 0 || index === filteredPoints.length - 1) && (
                    <text
                      x={x}
                      y={chartHeight - 16}
                      textAnchor={index === 0 ? "start" : "end"}
                      className="fill-black/45 text-[12px] font-black"
                    >
                      {formatDate(point.date)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-black text-black/55">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#ff6b00]/20 bg-[#fff7f1] px-3 py-2 text-[#ff6b00]">
          <span className="size-2 rounded-full bg-[#ff6b00]" /> Ortalama fiyat
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-2 text-green-700">
          <span className="size-2 rounded-full bg-green-600" /> En düşük fiyat
        </span>
      </div>

      <div className="mt-5 grid gap-3 min-[420px]:grid-cols-3">
        <MetricCard
          label="Son ortalama"
          value={summary.latestAverage ? formatPrice(summary.latestAverage) : "—"}
        />
        <MetricCard
          label="Son en düşük"
          value={summary.latestLowest ? formatPrice(summary.latestLowest) : "—"}
        />
        <MetricCard label="Grafikteki ilan" value={`${summary.totalCount}`} />
      </div>

      {firstPoint && lastPoint ? (
        <p className="mt-4 text-xs font-semibold text-black/45">
          Gösterilen aralık: {formatDate(firstPoint.date)} - {formatDate(lastPoint.date)}
        </p>
      ) : null}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/8 bg-white p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.07em] text-black/40">
        {label}
      </p>
      <p className="mt-2 break-words text-lg font-black">{value}</p>
    </div>
  );
}

function buildLinePath(
  points: ListingPriceHistoryPoint[],
  key: "average" | "lowest",
  yMin: number,
  yMax: number,
) {
  return points
    .map((point, index) => {
      const x = getX(index, points.length);
      const y = getY(point[key], yMin, yMax);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function getX(index: number, count: number) {
  if (count <= 1) return padding.left;
  const width = chartWidth - padding.left - padding.right;
  return padding.left + (width * index) / (count - 1);
}

function getY(value: number, yMin: number, yMax: number) {
  const height = chartHeight - padding.top - padding.bottom;
  return padding.top + ((yMax - value) / (yMax - yMin)) * height;
}
