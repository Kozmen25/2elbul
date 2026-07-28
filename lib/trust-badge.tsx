import { BadgeCheck, Minus, TriangleAlert } from "lucide-react";
import type { ConfidenceLevel } from "@/lib/confidence-engine/types";

type TrustLevel = ConfidenceLevel | "insufficient";

export function formatTrustLabel(level: TrustLevel): string {
  switch (level) {
    case "very-high":
      return "Güvenilir İlan";
    case "high":
      return "Güvenilir";
    case "medium":
      return "Orta Güven";
    case "low":
      return "Dikkatli İncele";
    case "very-low":
      return "Riskli";
    case "insufficient":
      return "Yetersiz Veri";
  }
}

export function getTrustBadgeClassName(level: TrustLevel): string {
  switch (level) {
    case "very-high":
      return "border-green-200 bg-green-50 text-green-800";
    case "high":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "medium":
      return "border-sky-200 bg-sky-50 text-sky-800";
    case "low":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "very-low":
      return "border-red-200 bg-red-50 text-red-800";
    case "insufficient":
      return "border-gray-200 bg-gray-50 text-gray-700";
  }
}

function getTrustIcon(level: TrustLevel) {
  switch (level) {
    case "very-high":
    case "high":
      return BadgeCheck;
    case "low":
    case "very-low":
      return TriangleAlert;
    case "medium":
    case "insufficient":
      return Minus;
  }
}

export function TrustBadge({
  level,
  showIcon = true,
  size = "sm",
}: {
  level: TrustLevel;
  showIcon?: boolean;
  size?: "sm" | "md";
}) {
  const Icon = getTrustIcon(level);
  const padding = size === "md" ? "px-4 py-2" : "px-3 py-1.5";
  const textSize = size === "md" ? "text-xs" : "text-[11px]";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-black ${padding} ${textSize} ${getTrustBadgeClassName(level)}`}
    >
      {showIcon && <Icon size={size === "md" ? 15 : 13} />}
      {formatTrustLabel(level)}
    </span>
  );
}

export function TrustMeter({
  score,
  level,
}: {
  score: number;
  level: ConfidenceLevel;
}) {
  const minScore = Math.max(0, Math.min(100, score));
  const trackColor =
    level === "very-high" || level === "high"
      ? "bg-green-400"
      : level === "medium"
        ? "bg-sky-400"
        : "bg-red-400";

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.07em] text-black/40">
          Güven skoru
        </p>
        <span className="text-xs font-black text-black/45">{minScore}/100</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/8">
        <div
          className={`h-full rounded-full transition-all duration-500 ${trackColor}`}
          style={{ width: `${minScore}%` }}
        />
      </div>
    </div>
  );
}

export function confidenceToTrustLevel(
  level: ConfidenceLevel | undefined | null,
  sampleSize?: number,
): TrustLevel {
  if (typeof sampleSize === "number" && sampleSize < 3) return "insufficient";
  return level ?? "insufficient";
}
