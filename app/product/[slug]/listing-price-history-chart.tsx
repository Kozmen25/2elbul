"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatCurrencyTRY, formatDateTR } from "@/lib/formatters";
import {
  HISTORY_RANGES,
  MIN_HISTORY_POINTS,
  defaultHistoryRange,
  nearestPointIndex,
  selectHistoryRange,
  summarizeHistoryRange,
  type HistoryRangeKey,
} from "@/lib/price-insights";

export type ListingPriceHistoryPoint = {
  date: string;
  average: number;
  lowest: number;
  highest: number;
  count: number;
};

const CHART_HEIGHT = 260;
const PLOT = { top: 16, right: 16, bottom: 30, left: 52 };
const GRID_STEPS = [0, 0.25, 0.5, 0.75, 1];
const TOOLTIP_WIDTH = 168;
const Y_AXIS_PADDING_RATIO = 0.12;
const MIN_SPREAD_RATIO = 0.08;
const NARROW_CHART_PX = 420;
const THOUSAND = 1000;

const formatPrice = (price: number) => formatCurrencyTRY(price);

const formatAxisPrice = (price: number) =>
  price >= THOUSAND ? `${Math.round(price / THOUSAND).toLocaleString("tr-TR")} bin` : `${Math.round(price)} ₺`;

const formatShortDate = (date: string) => formatDateTR(`${date}T00:00:00`, { day: "numeric", month: "short" });

const formatLongDate = (date: string) =>
  formatDateTR(`${date}T00:00:00`, { day: "numeric", month: "long", year: "numeric" });

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    setWidth(element.clientWidth);
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

export function ListingPriceHistoryChart({ points }: { points: ListingPriceHistoryPoint[] }) {
  const [range, setRange] = useState<HistoryRangeKey>(() => defaultHistoryRange(points));
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const { ref: containerRef, width } = useElementWidth<HTMLDivElement>();

  const visible = useMemo(() => {
    const days = HISTORY_RANGES.find((item) => item.key === range)?.days ?? null;
    return selectHistoryRange(points, days);
  }, [points, range]);
  const summary = useMemo(() => summarizeHistoryRange(visible), [visible]);

  if (points.length < MIN_HISTORY_POINTS) {
    return (
      <div className="mt-6 rounded-sm border border-dashed border-black/15 bg-[#fafaf8] px-6 py-10 text-center text-sm font-semibold text-black/45">
        Fiyat geçmişi birikiyor. Fiyatlar her gün kaydedilir; grafik en az iki farklı gün verisi oluştuğunda görünür.
      </div>
    );
  }

  const canDraw = visible.length >= MIN_HISTORY_POINTS;

  return (
    <div className="mt-6 min-w-0">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Fiyat geçmişi aralığı">
        {HISTORY_RANGES.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={range === item.key}
            onClick={() => {
              setRange(item.key);
              setActiveIndex(null);
            }}
            className={`rounded-full border px-3 py-2 text-xs font-black transition ${
              range === item.key
                ? "border-[#3B66E0] bg-[#3B66E0] text-white"
                : "border-black/20 bg-white text-black/55 hover:border-[#3B66E0]/40"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div ref={containerRef} className="relative mt-5 overflow-hidden rounded-sm border border-black/20 bg-[#fafaf8]">
        {canDraw ? (
          width > 0 && (
            <PriceHistorySvg
              points={visible}
              width={width}
              activeIndex={activeIndex}
              onActiveChange={setActiveIndex}
            />
          )
        ) : (
          <p className="px-6 py-14 text-center text-sm font-semibold text-black/45">
            Bu aralıkta yeterli veri yok. Daha uzun bir aralık seçin.
          </p>
        )}
        {canDraw && width === 0 ? <div style={{ height: CHART_HEIGHT }} aria-hidden /> : null}
      </div>

      {canDraw ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-black text-black/55">
          <LegendDot className="bg-[#3B66E0]" label="Ortalama fiyat" tone="blue" />
          <LegendDot className="bg-green-600" label="En düşük fiyat" tone="green" />
          <LegendDot className="bg-[#3B66E0]/20" label="Günlük fiyat aralığı" tone="gray" />
        </div>
      ) : null}

      {summary ? (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="Dönem ortalaması" value={formatPrice(summary.average)} />
            <MetricCard label="En düşük fiyat" value={formatPrice(summary.lowest)} tone="green" />
            <MetricCard label="En yüksek fiyat" value={formatPrice(summary.highest)} />
            <MetricCard
              label="Değişim"
              value={formatChange(summary.changePercent)}
              tone={changeTone(summary.changePercent)}
            />
          </div>
          <p className="mt-4 text-xs font-semibold text-black/45">
            {summary.firstDate === summary.lastDate
              ? formatShortDate(summary.firstDate)
              : `${formatShortDate(summary.firstDate)} - ${formatShortDate(summary.lastDate)}`}
            {" · "}
            {summary.recordCount} fiyat kaydı
          </p>
        </>
      ) : null}
    </div>
  );
}

/** The drawn chart for a known width; exported so it can be rendered in tests. */
export function PriceHistorySvg({
  points,
  width,
  activeIndex,
  onActiveChange,
}: {
  points: ListingPriceHistoryPoint[];
  width: number;
  activeIndex: number | null;
  onActiveChange: (index: number | null) => void;
}) {
  const geometry = useMemo(() => {
    const values = points.flatMap((point) => [point.lowest, point.highest, point.average]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const spread = Math.max(max - min, max * MIN_SPREAD_RATIO, 1);
    const yMin = Math.max(0, min - spread * Y_AXIS_PADDING_RATIO);
    const yMax = max + spread * Y_AXIS_PADDING_RATIO;
    const left = PLOT.left;
    const right = width - PLOT.right;
    const plotHeight = CHART_HEIGHT - PLOT.top - PLOT.bottom;

    const x = (index: number) =>
      points.length <= 1 ? left : left + ((right - left) * index) / (points.length - 1);
    const y = (value: number) => PLOT.top + ((yMax - value) / (yMax - yMin)) * plotHeight;

    const line = (key: "average" | "lowest") =>
      points.map((point, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(point[key])}`).join(" ");
    const band = [
      ...points.map((point, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(point.highest)}`),
      ...[...points].reverse().map((point, index) => `L ${x(points.length - 1 - index)} ${y(point.lowest)}`),
      "Z",
    ].join(" ");

    return { yMin, yMax, left, right, x, y, averagePath: line("average"), lowestPath: line("lowest"), band };
  }, [points, width]);

  const active = activeIndex !== null ? points[activeIndex] : null;
  const showEveryDot = points.length <= 31;

  function handlePointer(event: React.PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    onActiveChange(nearestPointIndex(event.clientX - box.left, points.length, geometry.left, geometry.right));
  }

  function handleKeyDown(event: React.KeyboardEvent<SVGSVGElement>) {
    if (event.key === "Escape") return onActiveChange(null);
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const step = event.key === "ArrowRight" ? 1 : -1;
    const base = activeIndex ?? (step === 1 ? -1 : points.length);
    onActiveChange(Math.min(points.length - 1, Math.max(0, base + step)));
  }

  const lastIndex = points.length - 1;
  const tooltipLeft = active
    ? Math.min(Math.max(geometry.x(activeIndex as number) - TOOLTIP_WIDTH / 2, 4), width - TOOLTIP_WIDTH - 4)
    : 0;

  return (
    <div className="relative">
      <svg
        width={width}
        height={CHART_HEIGHT}
        viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
        role="img"
        aria-label="Ürün fiyat geçmişi grafiği. Günleri gezmek için sol ve sağ ok tuşlarını kullanın."
        tabIndex={0}
        className="block touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-[#3B66E0]/50"
        onPointerMove={handlePointer}
        onPointerDown={handlePointer}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") onActiveChange(null);
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => onActiveChange(null)}
      >
        {GRID_STEPS.map((ratio) => {
          const yPos = PLOT.top + (CHART_HEIGHT - PLOT.top - PLOT.bottom) * ratio;
          const value = geometry.yMax - (geometry.yMax - geometry.yMin) * ratio;
          return (
            <g key={ratio}>
              <line x1={PLOT.left} x2={width - PLOT.right} y1={yPos} y2={yPos} stroke="rgba(0,0,0,.08)" strokeDasharray="5 7" />
              <text x={PLOT.left - 8} y={yPos + 4} textAnchor="end" className="fill-black/40 text-[11px] font-bold">
                {formatAxisPrice(value)}
              </text>
            </g>
          );
        })}

        <path d={geometry.band} fill="#3B66E0" fillOpacity="0.1" />
        <path d={geometry.lowestPath} fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d={geometry.averagePath} fill="none" stroke="#3B66E0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

        {points.map((point, index) =>
          showEveryDot || index === lastIndex ? (
            <circle key={point.date} cx={geometry.x(index)} cy={geometry.y(point.average)} r="3.5" fill="#3B66E0" />
          ) : null,
        )}

        {active ? (
          <g>
            <line
              x1={geometry.x(activeIndex as number)}
              x2={geometry.x(activeIndex as number)}
              y1={PLOT.top}
              y2={CHART_HEIGHT - PLOT.bottom}
              stroke="rgba(0,0,0,.25)"
            />
            <circle cx={geometry.x(activeIndex as number)} cy={geometry.y(active.average)} r="6" fill="#fff" stroke="#3B66E0" strokeWidth="3" />
            <circle cx={geometry.x(activeIndex as number)} cy={geometry.y(active.lowest)} r="5" fill="#fff" stroke="#16a34a" strokeWidth="2.5" />
          </g>
        ) : null}

        <text x={PLOT.left} y={CHART_HEIGHT - 8} textAnchor="start" className="fill-black/45 text-[12px] font-black">
          {formatShortDate(points[0].date)}
        </text>
        {width >= NARROW_CHART_PX && points.length >= 3 ? (
          <text x={geometry.x(Math.floor(lastIndex / 2))} y={CHART_HEIGHT - 8} textAnchor="middle" className="fill-black/35 text-[12px] font-bold">
            {formatShortDate(points[Math.floor(lastIndex / 2)].date)}
          </text>
        ) : null}
        <text x={width - PLOT.right} y={CHART_HEIGHT - 8} textAnchor="end" className="fill-black/45 text-[12px] font-black">
          {formatShortDate(points[lastIndex].date)}
        </text>
      </svg>

      {active ? (
        <div
          role="status"
          className="pointer-events-none absolute top-2 rounded-sm border border-black/15 bg-white p-3 text-xs shadow-lg"
          style={{ left: tooltipLeft, width: TOOLTIP_WIDTH }}
        >
          <p className="font-black">{formatLongDate(active.date)}</p>
          <dl className="mt-2 grid gap-1 font-semibold text-black/60">
            <TooltipRow label="Ortalama" value={formatPrice(active.average)} className="text-[#2A4FBF]" />
            <TooltipRow label="En düşük" value={formatPrice(active.lowest)} className="text-green-700" />
            <TooltipRow label="En yüksek" value={formatPrice(active.highest)} />
            <TooltipRow label="Kayıt" value={`${active.count}`} />
          </dl>
        </div>
      ) : null}
    </div>
  );
}

function TooltipRow({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt>{label}</dt>
      <dd className={`font-black ${className}`}>{value}</dd>
    </div>
  );
}

function LegendDot({ className, label, tone }: { className: string; label: string; tone: "blue" | "green" | "gray" }) {
  const styles = {
    blue: "border-[#3B66E0]/20 bg-[#EEF3FF] text-[#3B66E0]",
    green: "border-green-200 bg-green-50 text-green-700",
    gray: "border-black/10 bg-white text-black/55",
  }[tone];
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 ${styles}`}>
      <span className={`size-2 rounded-full ${className}`} /> {label}
    </span>
  );
}

function MetricCard({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "green" | "red" }) {
  const color = tone === "green" ? "text-green-700" : tone === "red" ? "text-red-600" : "";
  return (
    <div className="rounded-sm border border-black/20 bg-white p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.07em] text-black/40">{label}</p>
      <p className={`mt-2 break-words text-lg font-black ${color}`}>{value}</p>
    </div>
  );
}

function formatChange(percent: number | null): string {
  if (percent === null) return "—";
  if (percent === 0) return "%0";
  const arrow = percent < 0 ? "↓" : "↑";
  return `${arrow} %${Math.abs(percent).toLocaleString("tr-TR")}`;
}

/** A falling price is good news for a buyer, so it is green. */
function changeTone(percent: number | null): "default" | "green" | "red" {
  if (percent === null || percent === 0) return "default";
  return percent < 0 ? "green" : "red";
}
