import { normalizeSearchText, getTokens } from '../normalization';
import {
  calculateDuplicateScore,
  aggregateScores,
} from './scoring';
import type {
  DuplicateFingerprint,
  DuplicateResult,
  ComparisonInput,
  DuplicateScore,
} from './types';

export function createDuplicateFingerprint(
  title: string,
  brand?: string | null,
  model?: string | null,
  storage?: string | null,
  ram?: string | null,
  variant?: string | null
): DuplicateFingerprint {
  const normalized = normalizeSearchText(title);
  const tokens = new Set(getTokens(normalized));

  return {
    brand: brand || null,
    model: model || null,
    storage: storage || null,
    ram: ram || null,
    variant: variant || null,
    normalized,
    tokens,
  };
}

export function calculateDuplicateScoreForInputs(
  input1: ComparisonInput,
  input2: ComparisonInput
): DuplicateResult {
  const normalized1 = normalizeSearchText(input1.title);
  const normalized2 = normalizeSearchText(input2.title);

  const scores = calculateDuplicateScore(
    input1,
    input2,
    normalized1,
    normalized2
  );

  const aggregate = aggregateScores(scores);
  const confidence = determineConfidence(aggregate);
  const reasoning = generateReasoning(scores, aggregate);

  return {
    score: aggregate,
    confidence,
    signals: scores,
    reasoning,
  };
}

function determineConfidence(score: number): 'same' | 'strong' | 'possible' | 'different' {
  if (score >= 90) return 'same';
  if (score >= 70) return 'strong';
  if (score >= 40) return 'possible';
  return 'different';
}

function generateReasoning(scores: DuplicateScore, aggregate: number): string[] {
  const reasons: string[] = [];

  if (scores.normalization >= 90) {
    reasons.push('Başlık normalizasyonu çok yüksek');
  } else if (scores.normalization >= 70) {
    reasons.push('Başlık normalizasyonu yüksek');
  }

  if (scores.brand === 100) {
    reasons.push('Markalar aynı');
  } else if (scores.brand === 0) {
    reasons.push('Markalar farklı');
  }

  if (scores.model === 100) {
    reasons.push('Modeller aynı');
  } else if (scores.model < 50 && scores.model > 0) {
    reasons.push('Modeller kısmen benzer');
  } else if (scores.model === 0 && scores.brand !== 0) {
    reasons.push('Modeller farklı');
  }

  if (scores.storage === 100) {
    reasons.push('Depolama alanı aynı');
  } else if (scores.storage === 0 && scores.brand === 100) {
    reasons.push('Depolama alanı farklı');
  }

  if (scores.ram === 100) {
    reasons.push('RAM aynı');
  } else if (scores.ram === 0) {
    reasons.push('RAM farklı');
  }

  if (scores.condition !== 50 && scores.condition !== 100) {
    reasons.push('Durum eşleşmiyor');
  }

  if (scores.price < 20 && scores.price !== 50) {
    reasons.push('Fiyat çok farklı');
  } else if (scores.price >= 90) {
    reasons.push('Fiyat benzer');
  }

  if (scores.sourceDiversity === 50) {
    reasons.push('Farklı kaynaklardan');
  } else if (scores.sourceDiversity === 0) {
    reasons.push('Aynı kaynaktan');
  }

  return reasons.length > 0 ? reasons : ['Tam eşleşme kriterleri sağlanmadı'];
}

export function isDuplicate(
  input1: ComparisonInput,
  input2: ComparisonInput,
  threshold: number = 70
): boolean {
  const result = calculateDuplicateScoreForInputs(input1, input2);
  return result.score >= threshold;
}

export function compareMultiple(
  reference: ComparisonInput,
  candidates: ComparisonInput[]
): Array<{
  candidate: ComparisonInput;
  result: DuplicateResult;
  index: number;
}> {
  return candidates
    .map((candidate, index) => ({
      candidate,
      result: calculateDuplicateScoreForInputs(reference, candidate),
      index,
    }))
    .sort((a, b) => b.result.score - a.result.score);
}

export function findBestMatch(
  reference: ComparisonInput,
  candidates: ComparisonInput[]
): {
  candidate: ComparisonInput;
  result: DuplicateResult;
  index: number;
} | null {
  const results = compareMultiple(reference, candidates);
  return results.length > 0 ? results[0] : null;
}
