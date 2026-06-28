"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  DailyPricePoint,
  PriceHistorySummary,
} from "@/lib/price-insights";

type RangeKey = "7" | "30" | "90" | "all";

const ranges: Array<{ key: RangeKey; label: string; days?: number }> = [
  { key: "7", label: "Son 7 gün", days: 7 },
  { key: "30", label: "Son 30 gün", days: 30 },
  { key: "90", label: "Son 90 gün", days: 90 },
  { key: "all", label: "Tümü" },
];

const formatPrice = (price: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(price);

const formatPercent = (value: number | null) =>
  value === null ? "—" : `${value > 0 ? "+" : ""}${value.toLocaleString("tr-TR")}%`;

export function PriceHistoryChart({
  points,
  summary,
}: {
  points: DailyPricePoint[];
  summary: PriceHistorySummary;
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

  if (points.length < 2) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-black/15 bg-[#fafaf8] px-6 py-10 text-center text-sm font-semibold text-black/45">
        Fiyat grafiği için daha fazla veri gerekli.
      </div>
    );
  }

  return (
    <div className="mt-6 min-w-0">
      <div className="mb-4 flex flex-wrap gap-2">
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

      <div className="h-[300px] min-w-0 rounded-2xl border border-black/8 bg-[#fafaf8] p-2 sm:h-[360px] sm:p-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={filteredPoints}
            margin={{ top: 16, right: 18, left: 0, bottom: 12 }}
          >
            <CartesianGrid stroke="#e7e2dc" strokeDasharray="4 6" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: "rgba(0,0,0,.45)" }}
              tickFormatter={(value) => value.slice(5)}
              minTickGap={18}
            />
            <YAxis
              width={76}
              tick={{ fontSize: 12, fill: "rgba(0,0,0,.45)" }}
              tickFormatter={(value) =>
                `${Math.round(Number(value) / 1000).toLocaleString("tr-TR")} bin`
              }
            />
            <Tooltip
              formatter={(value) => formatPrice(Number(value))}
              labelFormatter={(value) =>
                new Intl.DateTimeFormat("tr-TR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }).format(new Date(String(value)))
              }
              contentStyle={{
                borderRadius: 16,
                border: "1px solid rgba(0,0,0,.08)",
                boxShadow: "0 18px 50px rgba(0,0,0,.08)",
                fontWeight: 700,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12, fontWeight: 800 }} />
            <Line
              type="monotone"
              name="En düşük"
              dataKey="lowest"
              stroke="#16a34a"
              strokeWidth={3}
              dot={false}
            />
            <Line
              type="monotone"
              name="Ortalama"
              dataKey="average"
              stroke="#ff6b00"
              strokeWidth={3}
              dot={false}
            />
            <Line
              type="monotone"
              name="En yüksek"
              dataKey="highest"
              stroke="#dc2626"
              strokeWidth={3}
              dot={false}
            />
            <Line
              type="monotone"
              name="Piyasa değeri"
              dataKey="market"
              stroke="#111111"
              strokeWidth={2}
              strokeDasharray="6 6"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-5 grid gap-3 min-[420px]:grid-cols-2 lg:grid-cols-6">
        <HistoryCard label="Bugünkü fiyat" value={formatMaybePrice(summary.todayPrice)} accent />
        <HistoryCard label="7 gün değişim" value={formatPercent(summary.change7)} tone={summary.change7} />
        <HistoryCard label="30 gün değişim" value={formatPercent(summary.change30)} tone={summary.change30} />
        <HistoryCard label="90 gün değişim" value={formatPercent(summary.change90)} tone={summary.change90} />
        <HistoryCard label="En düşük fiyat" value={formatMaybePrice(summary.lowest)} />
        <HistoryCard label="En yüksek fiyat" value={formatMaybePrice(summary.highest)} />
      </div>
    </div>
  );
}

function HistoryCard({
  label,
  value,
  accent = false,
  tone,
}: {
  label: string;
  value: string;
  accent?: boolean;
  tone?: number | null;
}) {
  const toneClass =
    tone === undefined || tone === null
      ? ""
      : tone <= 0
        ? "text-green-700"
        : "text-red-700";
  return (
    <div
      className={`min-w-0 rounded-2xl border p-4 ${
        accent ? "border-[#ff6b00]/20 bg-[#fff7f1]" : "border-black/8 bg-white"
      }`}
    >
      <p className="text-[11px] font-black uppercase tracking-[0.07em] text-black/40">
        {label}
      </p>
      <p className={`mt-2 break-words text-lg font-black ${toneClass}`}>
        {value}
      </p>
    </div>
  );
}

function formatMaybePrice(value: number | null) {
  return value === null ? "—" : formatPrice(value);
}
