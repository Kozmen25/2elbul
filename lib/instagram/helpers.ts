import { formatCurrencyTRY, formatDateTR, formatNumberTR } from "@/lib/formatters";
import { formatOpportunityLevel } from "@/lib/opportunity-engine/helpers";
import type { InstagramPublishConfig, InstagramReelDraft } from "./types";

const DEFAULT_GRAPH_API_VERSION = "v20.0";

export function buildInstagramPublishConfig(): InstagramPublishConfig | null {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN?.trim();
  const igUserId = process.env.INSTAGRAM_IG_USER_ID?.trim();
  const graphApiVersion = normalizeGraphApiVersion(
    process.env.INSTAGRAM_GRAPH_API_VERSION?.trim(),
  );

  if (!accessToken || !igUserId) return null;

  return {
    accessToken,
    igUserId,
    graphApiVersion,
  };
}

export function buildInstagramGraphApiBaseUrl(version?: string | null) {
  const normalizedVersion = normalizeGraphApiVersion(version);
  return `https://graph.facebook.com/${normalizedVersion}`;
}

export function buildInstagramReelCaption(draft: InstagramReelDraft) {
  const lines = [
    `Bugunun firsati: ${draft.productName}`,
    `${draft.recommendationLabel} • Risk ${formatOpportunityLevel(draft.riskLevel)} • Confidence ${formatOpportunityLevel(draft.confidenceLevel)}`,
    `Opportunity skoru: ${draft.opportunityScore}/100`,
    draft.averagePrice != null && draft.minPrice != null
      ? `Ortalama ${formatCurrencyTRY(draft.averagePrice)}, en dusuk ${formatCurrencyTRY(draft.minPrice)}, fiyat avantaji %${formatDecimal(
          draft.priceAdvantagePercent,
        )}`
      : "Fiyat verisi henüz yeterli değil.",
    `Bu analiz ${formatNumberTR(draft.sampleSize)} ilan ve ${formatNumberTR(draft.sourceCount)} kaynak üzerinden oluşturuldu.`,
    `Son güncelleme: ${formatDateTR(draft.analysisGeneratedAt, {
      dateStyle: "medium",
      timeStyle: "short",
    })}`,
    draft.productUrl,
    "#2ElBul #ikinciEl #fırsat #reel",
  ];

  return lines.join("\n");
}

export function buildInstagramReelOverlayLines(draft: InstagramReelDraft) {
  return [
    "GUNUN FIRSATI",
    draft.productName,
    `${draft.recommendationLabel} • ${formatOpportunityLevel(draft.opportunityLevel)}`,
    `Skor ${draft.opportunityScore}/100 • Risk ${formatOpportunityLevel(draft.riskLevel)}`,
    draft.averagePrice != null && draft.minPrice != null
      ? `Ort. ${formatCurrencyTRY(draft.averagePrice)} • Dusuk ${formatCurrencyTRY(draft.minPrice)}`
      : "Yetersiz fiyat verisi",
    `Analiz ${formatNumberTR(draft.sampleSize)} ilan • ${formatNumberTR(draft.sourceCount)} kaynak`,
    `Confidence ${formatOpportunityLevel(draft.confidenceLevel)} • %${formatDecimal(
      draft.priceAdvantagePercent,
    )} avantaj`,
  ];
}

export function escapeSvgText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function splitSvgTextLines(value: string, maxCharacters: number) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];

  const lines: string[] = [];
  let currentLine = words[0];

  for (const word of words.slice(1)) {
    const candidate = `${currentLine} ${word}`;
    if (candidate.length <= maxCharacters) {
      currentLine = candidate;
      continue;
    }

    lines.push(currentLine);
    currentLine = word;
  }

  if (currentLine) lines.push(currentLine);
  return lines.slice(0, 4);
}

export function formatDecimal(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 1,
  }).format(value);
}

export function normalizeGraphApiVersion(value?: string | null) {
  const candidate = value?.trim();
  if (!candidate) return DEFAULT_GRAPH_API_VERSION;
  if (/^v\d+(\.\d+)?$/i.test(candidate)) return candidate.toLowerCase();
  return candidate.startsWith("v") ? candidate : `v${candidate}`;
}
