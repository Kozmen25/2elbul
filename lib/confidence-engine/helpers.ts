import type {
  ConfidenceContext,
  ConfidenceInput,
  ConfidenceMetadata,
  ConfidenceResult,
  ConfidenceSignalScores,
  DuplicateScoreLike,
  ProductSignalsLike,
} from "./types";
import { clampScore } from "./scoring";

const SOURCE_RELIABILITY_RULES: Array<{ pattern: RegExp; score: number }> = [
  { pattern: /easycep/i, score: 92 },
  { pattern: /getmobil/i, score: 90 },
  { pattern: /yenilenmi/i, score: 87 },
  { pattern: /teknosa/i, score: 86 },
  { pattern: /hepsiburada/i, score: 85 },
  { pattern: /mediamarkt/i, score: 84 },
  { pattern: /sahibinden/i, score: 68 },
  { pattern: /letgo/i, score: 60 },
  { pattern: /facebook/i, score: 58 },
];

const VARIANT_KEYWORDS = [
  "pro max",
  "promax",
  "pro-max",
  "pro",
  "max",
  "ultra",
  "plus",
  "mini",
  "fe",
  "air",
  "gen",
  "generation",
];

export function scoreSourceCount(sourceCount: number | null | undefined): number | null {
  if (sourceCount == null || !Number.isFinite(sourceCount)) return null;
  if (sourceCount <= 0) return 0;
  if (sourceCount === 1) return 40;
  if (sourceCount === 2) return 70;
  if (sourceCount === 3) return 86;
  return 95;
}

export function scoreSourceReliability(
  sourceReliability: number | null | undefined,
  sourceName?: string | null,
  sourceNames?: string[],
): number | null {
  if (typeof sourceReliability === "number" && Number.isFinite(sourceReliability)) {
    return clampScore(sourceReliability);
  }

  const candidates = [
    ...(sourceNames ?? []),
    sourceName ?? "",
  ].filter(Boolean);

  if (!candidates.length) return null;

  const scores = candidates
    .map((candidate) => resolveSourceReliabilityFromName(candidate))
    .filter((value): value is number => typeof value === "number");

  if (!scores.length) return 50;

  return clampScore(Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length));
}

export function scoreTaxonomySignal(context: ConfidenceContext | undefined): number | null {
  if (!context) return null;
  if (!context.categoryLabel) return null;

  const base =
    context.taxonomyConfidence === "high"
      ? 88
      : context.taxonomyConfidence === "medium"
        ? 72
        : context.taxonomyConfidence === "low"
          ? 46
          : 66;

  const fullPathBonus = context.taxonomyHasFullPath ? 6 : 0;
  const attributeBonus = Math.min(10, Math.max(0, (context.taxonomyAttributeCount ?? 0) * 2));

  return clampScore(base + fullPathBonus + attributeBonus);
}

export function scoreTitleSimilarity(
  left?: string | null,
  right?: string | null,
): number | null {
  if (!left || !right) return null;

  const tokens1 = tokenizeReadyText(left);
  const tokens2 = tokenizeReadyText(right);

  if (!tokens1.length || !tokens2.length) return null;

  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  const intersection = [...set1].filter((token) => set2.has(token)).length;
  const union = new Set([...set1, ...set2]).size;

  if (!union) return null;

  return clampScore(Math.round((intersection / union) * 100));
}

export function buildDuplicateConfidenceInput({
  duplicateScore,
  signals,
  sourceCount,
  sourceReliability,
  sourceName,
  sourceNames,
  categoryLabel,
  taxonomyConfidence,
  taxonomyHasFullPath,
  taxonomyAttributeCount,
  normalizedTitle,
  canonicalTitle,
}: {
  duplicateScore: number;
  signals: DuplicateScoreLike;
  sourceCount?: number | null;
  sourceReliability?: number | null;
  sourceName?: string | null;
  sourceNames?: string[];
  categoryLabel?: string | null;
  taxonomyConfidence?: ConfidenceContext["taxonomyConfidence"];
  taxonomyHasFullPath?: boolean;
  taxonomyAttributeCount?: number;
  normalizedTitle?: string | null;
  canonicalTitle?: string | null;
}): ConfidenceInput {
  return {
    signals: {
      normalizationScore: signals.normalization,
      taxonomyScore: scoreTaxonomySignal({
        categoryLabel: categoryLabel ?? null,
        taxonomyConfidence: taxonomyConfidence ?? null,
        taxonomyHasFullPath: taxonomyHasFullPath ?? false,
        taxonomyAttributeCount: taxonomyAttributeCount ?? 0,
      }),
      brandScore: signals.brand,
      modelScore: signals.model,
      storageScore: signals.storage,
      ramScore: signals.ram,
      variantScore: signals.variant,
      duplicateScore,
      priceConsistency: signals.price,
      titleSimilarity: signals.titleSimilarity,
      sourceCount: scoreSourceCount(sourceCount ?? inferSourceCountFromDiversity(signals.sourceDiversity)),
      sourceReliability: scoreSourceReliability(
        sourceReliability ?? (sourceName || sourceNames?.length ? undefined : 50),
        sourceName,
        sourceNames,
      ),
    },
    context: {
      normalizedTitle,
      canonicalTitle,
      categoryLabel,
      taxonomyConfidence: taxonomyConfidence ?? null,
      taxonomyHasFullPath,
      taxonomyAttributeCount,
      sourceName,
      sourceNames,
      sourceCount: sourceCount ?? inferSourceCountFromDiversity(signals.sourceDiversity),
      sourceReliability,
    },
  };
}

export function buildProductMatcherConfidenceInput({
  signals,
  normalizedTitle,
  canonicalTitle,
  sourceName,
  sourceNames,
  sourceCount,
  sourceReliability,
  categoryConfidence,
  taxonomyHasFullPath,
  taxonomyAttributeCount,
}: {
  signals: ProductSignalsLike;
  normalizedTitle?: string | null;
  canonicalTitle?: string | null;
  sourceName?: string | null;
  sourceNames?: string[];
  sourceCount?: number | null;
  sourceReliability?: number | null;
  categoryConfidence?: ConfidenceContext["taxonomyConfidence"];
  taxonomyHasFullPath?: boolean;
  taxonomyAttributeCount?: number;
}): ConfidenceInput {
  const presentSignalCount = [signals.brand, signals.model, signals.storage, signals.ram].filter(Boolean).length;
  const normalizationScore =
    presentSignalCount === 0
      ? 40
      : clampScore(60 + presentSignalCount * 8 + (signals.category ? 4 : 0));

  const hasVariant = hasVariantMarker(signals.model);
  const taxonomyScore = scoreTaxonomySignal({
    categoryLabel: signals.category,
    taxonomyConfidence: categoryConfidence ?? (signals.category ? "medium" : null),
    taxonomyHasFullPath: taxonomyHasFullPath ?? false,
    taxonomyAttributeCount: taxonomyAttributeCount ?? 0,
  });

  return {
    signals: {
      normalizationScore,
      taxonomyScore,
      brandScore: scorePresence(signals.brand, 96, 35),
      modelScore: scorePresence(signals.model, 98, 25),
      storageScore: scorePresence(signals.storage, 94, 40),
      ramScore: scorePresence(signals.ram, 92, 45),
      variantScore: hasVariant ? 92 : signals.model ? 76 : 35,
      titleSimilarity: scoreTitleSimilarity(normalizedTitle, canonicalTitle),
      sourceCount: scoreSourceCount(sourceCount ?? 1),
      sourceReliability: scoreSourceReliability(
        sourceReliability ?? (sourceName || sourceNames?.length ? undefined : 50),
        sourceName,
        sourceNames,
      ),
    },
    context: {
      normalizedTitle,
      canonicalTitle,
      categoryLabel: signals.category,
      taxonomyConfidence: categoryConfidence ?? (signals.category ? "medium" : null),
      taxonomyHasFullPath,
      taxonomyAttributeCount,
      sourceName,
      sourceNames,
      sourceCount: sourceCount ?? 1,
      sourceReliability,
    },
  };
}

export function buildConfidenceReasons(
  result: ConfidenceResult,
  context: ConfidenceContext | undefined,
): string[] {
  const candidates: Array<{ priority: number; reason: string }> = [];
  const signals = result.signals;

  addSignalReason(candidates, signals.titleSimilarity, {
    strong: { threshold: 95, priority: 100, reason: "Başlık tamamen eşleşiyor" },
    medium: { threshold: 80, priority: 92, reason: "Başlık benzer" },
    weak: { threshold: 35, priority: 22, reason: "Başlıklar zayıf uyum gösteriyor" },
  });

  addSignalReason(candidates, signals.normalizationScore, {
    strong: { threshold: 95, priority: 98, reason: "Başlık normalizasyonu çok güçlü" },
    medium: { threshold: 80, priority: 88, reason: "Normalizasyon tutarlı" },
    weak: { threshold: 35, priority: 20, reason: "Normalizasyon zayıf" },
  });

  addSignalReason(candidates, signals.brandScore, {
    strong: { threshold: 95, priority: 86, reason: "Marka aynı" },
    medium: { threshold: 80, priority: 78, reason: "Marka uyumu güçlü" },
    weak: { threshold: 35, priority: 18, reason: "Marka uyuşmuyor" },
  });

  addSignalReason(candidates, signals.modelScore, {
    strong: { threshold: 95, priority: 96, reason: "Model aynı" },
    medium: { threshold: 80, priority: 90, reason: "Model uyumu güçlü" },
    weak: { threshold: 35, priority: 30, reason: "Model farklı" },
  });

  addSignalReason(candidates, signals.storageScore, {
    strong: { threshold: 95, priority: 94, reason: "Depolama aynı" },
    medium: { threshold: 80, priority: 82, reason: "Depolama uyumu güçlü" },
    weak: { threshold: 35, priority: 28, reason: "Depolama eksik veya farklı" },
  });

  addSignalReason(candidates, signals.ramScore, {
    strong: { threshold: 95, priority: 84, reason: "RAM aynı" },
    medium: { threshold: 80, priority: 76, reason: "RAM uyumu güçlü" },
    weak: { threshold: 35, priority: 26, reason: "RAM eksik veya farklı" },
  });

  addSignalReason(candidates, signals.variantScore, {
    strong: { threshold: 95, priority: 80, reason: "Varyant aynı" },
    medium: { threshold: 80, priority: 68, reason: "Varyant uyumu güçlü" },
    weak: { threshold: 35, priority: 24, reason: "Varyant uyuşmuyor" },
  });

  addSignalReason(candidates, signals.taxonomyScore, {
    strong: { threshold: 90, priority: 70, reason: context?.categoryLabel ? `Kategori uyumlu: ${context.categoryLabel}` : "Kategori uyumlu" },
    medium: { threshold: 70, priority: 60, reason: "Taxonomy sinyali makul" },
    weak: { threshold: 40, priority: 18, reason: "Taxonomy desteği zayıf" },
  });

  addSignalReason(candidates, signals.duplicateScore, {
    strong: { threshold: 95, priority: 92, reason: "Duplicate skoru çok yüksek" },
    medium: { threshold: 80, priority: 84, reason: "Duplicate skoru güçlü" },
    weak: { threshold: 35, priority: 16, reason: "Duplicate sinyali zayıf" },
  });

  addSignalReason(candidates, signals.priceConsistency, {
    strong: { threshold: 90, priority: 64, reason: "Fiyat tutarlı" },
    medium: { threshold: 70, priority: 54, reason: "Fiyat makul" },
    weak: { threshold: 35, priority: 14, reason: "Fiyat tutarsız" },
  });

  const sourceCount = resolveSourceCount(context, signals);
  const sourceReliability = resolveSourceReliabilityValue(context, signals);
  if (sourceCount != null) {
    if (sourceCount >= 3 && sourceReliability != null && sourceReliability >= 80) {
      candidates.push({ priority: 85, reason: `${sourceCount} farklı güvenilir kaynak doğruladı` });
    } else if (sourceCount === 2 && sourceReliability != null && sourceReliability >= 70) {
      candidates.push({ priority: 74, reason: "İki kaynak aynı sonuca işaret ediyor" });
    } else if (sourceCount === 1 && sourceReliability != null && sourceReliability >= 80) {
      candidates.push({ priority: 56, reason: "Tek ama güvenilir kaynak" });
    } else if (sourceCount === 1) {
      candidates.push({ priority: 42, reason: "Tek kaynak" });
    }
  }

  if (sourceReliability != null) {
    if (sourceReliability >= 85) {
      candidates.push({ priority: 52, reason: "Kaynak güvenilirliği yüksek" });
    } else if (sourceReliability <= 45) {
      candidates.push({ priority: 24, reason: "Kaynak güvenilirliği düşük" });
    }
  }

  const uniqueReasons = new Map<string, number>();
  for (const candidate of candidates) {
    const currentPriority = uniqueReasons.get(candidate.reason);
    if (currentPriority == null || candidate.priority > currentPriority) {
      uniqueReasons.set(candidate.reason, candidate.priority);
    }
  }

  const sortedReasons = [...uniqueReasons.entries()]
    .map(([reason, priority]) => ({ reason, priority }))
    .sort((a, b) => b.priority - a.priority)
    .map((item) => item.reason);

  if (sortedReasons.length > 0) return sortedReasons.slice(0, 4);

  if (result.score >= 95) return ["Sinyaller çok güçlü"];
  if (result.score >= 70) return ["Sinyaller makul"];
  if (result.score >= 50) return ["Sinyaller sınırlı"];
  return ["Sinyaller zayıf"];
}

export function toConfidenceMetadata(result: ConfidenceResult): ConfidenceMetadata {
  return {
    confidenceScore: result.score,
    confidenceLevel: result.level,
    confidenceReasons: result.reasons,
  };
}

function resolveSourceCount(
  context: ConfidenceContext | undefined,
  signals: ConfidenceSignalScores,
): number | null {
  if (typeof context?.sourceCount === "number" && Number.isFinite(context.sourceCount)) {
    return context.sourceCount;
  }

  const inferred = inferSourceCountFromSignal(signals.sourceCount);
  if (inferred != null) return inferred;

  if (context?.sourceNames?.length) return context.sourceNames.length;
  return null;
}

function resolveSourceReliabilityValue(
  context: ConfidenceContext | undefined,
  signals: ConfidenceSignalScores,
): number | null {
  if (typeof context?.sourceReliability === "number" && Number.isFinite(context.sourceReliability)) {
    return clampScore(context.sourceReliability);
  }

  if (typeof signals.sourceReliability === "number" && Number.isFinite(signals.sourceReliability)) {
    return clampScore(signals.sourceReliability);
  }

  const names = [
    ...(context?.sourceNames ?? []),
    context?.sourceName ?? "",
  ].filter(Boolean);

  if (!names.length) {
    if (typeof context?.sourceCount === "number" && Number.isFinite(context.sourceCount)) {
      return 50;
    }
    return null;
  }

  const scores = names
    .map((name) => resolveSourceReliabilityFromName(name))
    .filter((value): value is number => typeof value === "number");

  if (!scores.length) return null;
  return clampScore(Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length));
}

function resolveSourceReliabilityFromName(name: string) {
  const rule = SOURCE_RELIABILITY_RULES.find((entry) => entry.pattern.test(name));
  return rule?.score ?? 65;
}

function addSignalReason(
  candidates: Array<{ priority: number; reason: string }>,
  score: number | null | undefined,
  patterns: {
    strong: { threshold: number; priority: number; reason: string };
    medium: { threshold: number; priority: number; reason: string };
    weak: { threshold: number; priority: number; reason: string };
  },
) {
  if (typeof score !== "number" || !Number.isFinite(score)) return;
  const normalized = clampScore(score);
  if (normalized >= patterns.strong.threshold) {
    candidates.push({ priority: patterns.strong.priority, reason: patterns.strong.reason });
  } else if (normalized >= patterns.medium.threshold) {
    candidates.push({ priority: patterns.medium.priority, reason: patterns.medium.reason });
  } else if (normalized <= patterns.weak.threshold) {
    candidates.push({ priority: patterns.weak.priority, reason: patterns.weak.reason });
  }
}

function scorePresence(
  value: string | null | undefined,
  presentScore: number,
  missingScore: number,
) {
  return value ? presentScore : missingScore;
}

function hasVariantMarker(model: string | null | undefined) {
  if (!model) return false;
  const lower = model.toLocaleLowerCase("tr-TR");
  return VARIANT_KEYWORDS.some((keyword) => lower.includes(keyword));
}

function tokenizeReadyText(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/[^a-z0-9ğüşöçıİ\s-]/gi, " ")
    .split(/[\s-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

function inferSourceCountFromDiversity(sourceDiversity: number) {
  if (!Number.isFinite(sourceDiversity)) return null;
  if (sourceDiversity <= 0) return 1;
  if (sourceDiversity >= 100) return 1;
  return 2;
}

function inferSourceCountFromSignal(sourceCountScore: number | null | undefined) {
  if (typeof sourceCountScore !== "number" || !Number.isFinite(sourceCountScore)) {
    return null;
  }
  if (sourceCountScore >= 90) return 4;
  if (sourceCountScore >= 82) return 3;
  if (sourceCountScore >= 60) return 2;
  if (sourceCountScore >= 35) return 1;
  return 0;
}
