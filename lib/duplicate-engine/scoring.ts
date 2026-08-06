import type { DuplicateScore, ComparisonInput } from './types';
import { CATEGORY_LABELS } from "@/lib/taxonomy/product-type-mapping";

export function calculateNormalizationScore(
  norm1: string,
  norm2: string
): number {
  if (norm1 === norm2) return 100;

  const clean1 = norm1.replace(/\s+/g, '').toLowerCase();
  const clean2 = norm2.replace(/\s+/g, '').toLowerCase();
  
  if (clean1 === clean2) return 100;

  const tokens1 = norm1.split(/\s+/).filter(Boolean);
  const tokens2 = norm2.split(/\s+/).filter(Boolean);

  if (tokens1.length === 0 || tokens2.length === 0) return 0;

  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  const intersection = [...set1].filter((t) => set2.has(t)).length;
  const union = new Set([...set1, ...set2]).size;

  return union === 0 ? 0 : Math.round((intersection / union) * 100);
}

export function calculateBrandScore(
  brand1: string | null | undefined,
  brand2: string | null | undefined
): number {
  if (!brand1 || !brand2) return brand1 === brand2 ? 50 : 0;
  return brand1.toLowerCase() === brand2.toLowerCase() ? 100 : 0;
}

export function calculateModelScore(
  model1: string | null | undefined,
  model2: string | null | undefined
): number {
  if (!model1 || !model2) return model1 === model2 ? 50 : 0;

  const m1 = model1.toLowerCase().replace(/[\s\-]/g, '');
  const m2 = model2.toLowerCase().replace(/[\s\-]/g, '');

  if (m1 === m2) return 100;

  const tokens1 = model1.toLowerCase().split(/[-\s]+/).filter(Boolean);
  const tokens2 = model2.toLowerCase().split(/[-\s]+/).filter(Boolean);

  if (tokens1.length === 0 || tokens2.length === 0) return 0;

  const baseMatch = tokens1[0] === tokens2[0] ? 1 : 0;

  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  const intersection = [...set1].filter((t) => set2.has(t)).length;

  if (intersection === 0) return baseMatch ? 20 : 0;

  return Math.round((intersection / Math.max(tokens1.length, tokens2.length)) * 80 + 20);
}

export function calculateStorageScore(
  storage1: string | null | undefined,
  storage2: string | null | undefined
): number {
  if (!storage1 && !storage2) return 50;
  if (!storage1 || !storage2) return 0;

  if (storage1.toLowerCase() === storage2.toLowerCase()) return 100;

  const extract = (s: string): number | null => {
    const match = s.match(/(\d+)(?:gb|tb)?/i);
    if (!match) return null;
    const value = parseInt(match[1], 10);
    return s.toLowerCase().includes('tb') ? value * 1024 : value;
  };

  const val1 = extract(storage1);
  const val2 = extract(storage2);

  if (val1 === null || val2 === null) return 0;

  const diff = Math.abs(val1 - val2);
  const ratio = diff / Math.max(val1, val2);

  if (ratio === 0) return 100;
  if (ratio < 0.1) return 90;
  if (ratio < 0.25) return 70;
  if (ratio < 0.5) return 40;

  return 0;
}

export function calculateRamScore(
  ram1: string | null | undefined,
  ram2: string | null | undefined,
  category?: string | null
): number {
  if (category && category !== CATEGORY_LABELS.PHONE) return 100;

  if (!ram1 && !ram2) return 100;
  if (!ram1 || !ram2) return 70;

  if (ram1.toLowerCase() === ram2.toLowerCase()) return 100;

  const extract = (s: string): number | null => {
    const match = s.match(/(\d+)\s*gb/i);
    return match ? parseInt(match[1], 10) : null;
  };

  const val1 = extract(ram1);
  const val2 = extract(ram2);

  if (val1 === null || val2 === null) return 0;

  const diff = Math.abs(val1 - val2);
  if (diff === 0) return 100;
  if (diff <= 2) return 90;
  if (diff <= 4) return 70;

  return 30;
}

export function calculateVariantScore(
  model1: string | null | undefined,
  model2: string | null | undefined
): number {
  if (!model1 || !model2) return 50;

  const m1Lower = model1.toLowerCase();
  const m2Lower = model2.toLowerCase();
  
  if (m1Lower === m2Lower) return 100;

  const variants = ['pro', 'max', 'ultra', 'plus', 'mini', 'fe', 'air', 'gen', 'generation'];
  
  const var1 = variants.filter((v) => m1Lower.includes(v));
  const var2 = variants.filter((v) => m2Lower.includes(v));

  if (var1.length === 0 && var2.length === 0) return 100;
  if (var1.length === 0 || var2.length === 0) return 40;

  const sameVariants = var1.every((v) => var2.includes(v)) &&
    var2.every((v) => var1.includes(v));

  return sameVariants ? 100 : 60;
}

export function calculateConditionScore(
  condition1: string | null | undefined,
  condition2: string | null | undefined
): number {
  if (!condition1 && !condition2) return 100;
  if (!condition1 || !condition2) return 60;

  const norm1 = condition1.toLowerCase().trim();
  const norm2 = condition2.toLowerCase().trim();

  if (norm1 === norm2) return 100;

  return 20;
}

export function calculatePriceScore(
  price1: number | null | undefined,
  price2: number | null | undefined
): number {
  if (price1 === null || price1 === undefined || price2 === null || price2 === undefined) {
    return 50;
  }

  if (price1 === 0 || price2 === 0) return 50;

  const maxPrice = Math.max(price1, price2);
  const diff = Math.abs(price1 - price2);
  const ratio = diff / maxPrice;

  if (ratio === 0) return 100;
  if (ratio <= 0.05) return 100;
  if (ratio <= 0.1) return 90;
  if (ratio <= 0.2) return 70;
  if (ratio <= 0.5) return 40;
  if (ratio <= 1.0) return 20;

  return 0;
}

export function calculateTitleSimilarityScore(
  title1: string,
  title2: string
): number {
  const tokens1 = new Set(
    title1.toLowerCase().split(/\s+/).filter((t) => t.length > 2)
  );
  const tokens2 = new Set(
    title2.toLowerCase().split(/\s+/).filter((t) => t.length > 2)
  );

  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  const intersection = [...tokens1].filter((t) => tokens2.has(t)).length;
  const union = new Set([...tokens1, ...tokens2]).size;

  return union === 0 ? 0 : Math.round((intersection / union) * 100);
}

export function calculateSourceDiversityScore(
  sourceId1: number | null | undefined,
  sourceId2: number | null | undefined
): number {
  if (!sourceId1 || !sourceId2) return 100;

  return sourceId1 === sourceId2 ? 0 : 50;
}

export function calculateCategoryScore(
  category1: string | null | undefined,
  category2: string | null | undefined
): number {
  if (!category1 && !category2) return 100;
  if (!category1 || !category2) return 30;
  return category1.toLowerCase() === category2.toLowerCase() ? 100 : 0;
}

export function isProductTypeConflict(
  type1: string | null | undefined,
  type2: string | null | undefined
): boolean {
  // Both null → no data, no conflict
  if (!type1 && !type2) return false;
  // One null, one known → partial data, let scoring handle it
  if (!type1 || !type2) return false;

  const t1 = type1.toLowerCase();
  const t2 = type2.toLowerCase();

  // Same type → no conflict
  if (t1 === t2) return false;

  // Conflict matrix: any different type pair is a conflict
  return true;
}

export function calculateProductTypeScore(
  type1: string | null | undefined,
  type2: string | null | undefined,
  subType1?: string | null | undefined,
  subType2?: string | null | undefined
): number {
  if (!type1 && !type2) return 50;
  if (!type1 || !type2) return 50;

  if (type1.toLowerCase() !== type2.toLowerCase()) return 0;

  // Same productType — check sub-type agreement if both have sub-type data
  if (subType1 && subType2) {
    return subType1.toLowerCase() === subType2.toLowerCase() ? 100 : 60;
  }
  // One or both lack sub-type data → can't penalize
  return 100;
}

export function calculateProductUnderstandingScore(
  type1: string | null | undefined,
  type2: string | null | undefined,
  accessoryType1?: string | null | undefined,
  accessoryType2?: string | null | undefined,
  sparePartType1?: string | null | undefined,
  sparePartType2?: string | null | undefined,
  serviceType1?: string | null | undefined,
  serviceType2?: string | null | undefined,
  deviceFamily1?: string | null | undefined,
  deviceFamily2?: string | null | undefined,
  compatibleDevice1?: string | null | undefined,
  compatibleDevice2?: string | null | undefined
): number {
  // No product type data on either side → neutral
  if (!type1 && !type2) return 50;

  const sameType = type1 && type2 && type1.toLowerCase() === type2.toLowerCase();

  // Different product types → weak signal
  if (type1 && type2 && !sameType) return 30;

  // One has data, other doesn't → slightly positive (partial data)
  if (!type1 || !type2) return 60;

  // Same product type — check additional PUE signals for enrichment
  let score = 85;

  // Determine the relevant sub-type for each input
  const subType1 = accessoryType1 || sparePartType1 || serviceType1 || null;
  const subType2 = accessoryType2 || sparePartType2 || serviceType2 || null;

  // Same sub-type → stronger signal (e.g., both are screen_protector)
  if (subType1 && subType2 && subType1.toLowerCase() === subType2.toLowerCase()) {
    score = 95;
  }

  // Same device family → strong device-level alignment
  if (deviceFamily1 && deviceFamily2 && deviceFamily1.toLowerCase() === deviceFamily2.toLowerCase()) {
    score = Math.max(score, 90);
  }

  // Same compatible device → accessory targeting the same specific device
  if (compatibleDevice1 && compatibleDevice2 && compatibleDevice1.toLowerCase() === compatibleDevice2.toLowerCase()) {
    score = Math.max(score, 92);
  }

  // All signals aligned → maximum confidence
  if (
    subType1 && subType2 && subType1.toLowerCase() === subType2.toLowerCase() &&
    deviceFamily1 && deviceFamily2 && deviceFamily1.toLowerCase() === deviceFamily2.toLowerCase()
  ) {
    score = 100;
  }

  // Different sub-type within same productType → reduces confidence
  if (subType1 && subType2 && subType1.toLowerCase() !== subType2.toLowerCase()) {
    score = Math.min(score, 70);
  }

  return score;
}

export function calculateDuplicateScore(
  input1: ComparisonInput,
  input2: ComparisonInput,
  normalized1: string,
  normalized2: string
): DuplicateScore {
  const subType1 = input1.productType === 'accessory' ? input1.accessoryType
    : input1.productType === 'spare_part' ? input1.sparePartType
    : input1.productType === 'service' ? input1.serviceType
    : null;
  const subType2 = input2.productType === 'accessory' ? input2.accessoryType
    : input2.productType === 'spare_part' ? input2.sparePartType
    : input2.productType === 'service' ? input2.serviceType
    : null;

  return {
    normalization: calculateNormalizationScore(normalized1, normalized2),
    brand: calculateBrandScore(input1.brand, input2.brand),
    model: calculateModelScore(input1.model, input2.model),
    storage: calculateStorageScore(input1.storage, input2.storage),
    ram: calculateRamScore(input1.ram, input2.ram, input1.category),
    variant: calculateVariantScore(input1.model, input2.model),
    condition: calculateConditionScore(input1.condition, input2.condition),
    price: calculatePriceScore(input1.price, input2.price),
    titleSimilarity: calculateTitleSimilarityScore(input1.title, input2.title),
    sourceDiversity: calculateSourceDiversityScore(input1.sourceId, input2.sourceId),
    categoryScore: calculateCategoryScore(input1.category, input2.category),
    productTypeScore: calculateProductTypeScore(input1.productType, input2.productType, subType1, subType2),
    productUnderstandingScore: calculateProductUnderstandingScore(
      input1.productType, input2.productType,
      input1.accessoryType, input2.accessoryType,
      input1.sparePartType, input2.sparePartType,
      input1.serviceType, input2.serviceType,
      input1.deviceFamily, input2.deviceFamily,
      input1.compatibleDevice, input2.compatibleDevice
    ),
  };
}

export function aggregateScores(scores: DuplicateScore): number {
  const weights = {
    normalization: 0.15,
    brand: 0.08,
    model: 0.13,
    storage: 0.10,
    ram: 0.04,
    variant: 0.02,
    condition: 0.09,
    price: 0.02,
    titleSimilarity: 0.01,
    sourceDiversity: 0.01,
    categoryScore: 0.09,
    productTypeScore: 0.30,
    productUnderstandingScore: 0.15,
  };

  const weighted =
    scores.normalization * weights.normalization +
    scores.brand * weights.brand +
    scores.model * weights.model +
    scores.storage * weights.storage +
    scores.ram * weights.ram +
    scores.variant * weights.variant +
    scores.condition * weights.condition +
    scores.price * weights.price +
    scores.titleSimilarity * weights.titleSimilarity +
    scores.sourceDiversity * weights.sourceDiversity +
    scores.categoryScore * weights.categoryScore +
    scores.productTypeScore * weights.productTypeScore +
    scores.productUnderstandingScore * weights.productUnderstandingScore;

  return Math.round(weighted);
}
