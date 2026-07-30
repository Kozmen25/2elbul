import type { ComparisonInput } from './types';

export function createComparisonInput(
  title: string,
  options?: {
    brand?: string | null;
    model?: string | null;
    storage?: string | null;
    ram?: string | null;
    condition?: string | null;
    price?: number | null;
    sourceId?: number | null;
    category?: string | null;
  }
): ComparisonInput {
  return {
    title,
    brand: options?.brand || null,
    model: options?.model || null,
    storage: options?.storage || null,
    ram: options?.ram || null,
    condition: options?.condition || null,
    price: options?.price || null,
    sourceId: options?.sourceId || null,
    category: options?.category || null,
  };
}

export function normalizeCondition(condition: string | null | undefined): string | null {
  if (!condition) return null;

  const normalized = condition.toLowerCase().trim();

  if (normalized.includes('yeni')) return 'Yeni';
  if (normalized.includes('sıfır')) return 'Yeni';
  if (normalized.includes('açılmamış')) return 'Yeni';
  if (normalized.includes('ikinci') || normalized.includes('2.el')) return 'İkinci El';
  if (normalized.includes('kullanılmış')) return 'İkinci El';
  if (normalized.includes('hasar')) return 'Hasarlı';

  return condition;
}

export function formatScore(score: number): string {
  return `${Math.round(score)}%`;
}

export function formatConfidence(confidence: 'same' | 'strong' | 'possible' | 'different'): string {
  switch (confidence) {
    case 'same':
      return 'Aynı Ürün';
    case 'strong':
      return 'Güçlü Eşleşme';
    case 'possible':
      return 'Olası Eşleşme';
    case 'different':
      return 'Farklı Ürün';
  }
}

export function shouldMerge(
  score: number,
  condition: 'same' | 'strong' | 'possible' | 'different'
): boolean {
  return score >= 90 && condition === 'same';
}

export function shouldWarn(
  score: number,
  condition: 'same' | 'strong' | 'possible' | 'different'
): boolean {
  return (score >= 70 && condition === 'strong') || (score >= 40 && condition === 'possible');
}

export function shouldIgnore(
  score: number,
  condition: 'same' | 'strong' | 'possible' | 'different'
): boolean {
  return score < 40 && condition === 'different';
}

export function scoreToHumanReadable(score: number): {
  message: string;
  action: 'merge' | 'warn' | 'ignore';
} {
  if (score >= 90) {
    return { message: 'Neredeyse kesinlikle aynı ürün', action: 'merge' };
  }

  if (score >= 70) {
    return { message: 'Muhtemelen aynı ürün', action: 'warn' };
  }

  if (score >= 40) {
    return { message: 'Aynı ürün olabilir', action: 'warn' };
  }

  return { message: 'Farklı ürünler görünüyor', action: 'ignore' };
}

export function summarizeComparison(
  title1: string,
  title2: string,
  score: number,
  confidence: 'same' | 'strong' | 'possible' | 'different'
): string {
  const scoreMsg = formatScore(score);
  const confMsg = formatConfidence(confidence);

  return `"${title1}" ve "${title2}" → ${scoreMsg} (${confMsg})`;
}
