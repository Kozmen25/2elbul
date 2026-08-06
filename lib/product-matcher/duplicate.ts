import type { DuplicateMatch } from "@/lib/duplicate-engine/types";
import {
  createComparisonInput,
  compareListings,
  groupDuplicates as groupDuplicatesEngine,
} from "@/lib/duplicate-engine";
import type {
  ComparisonListing,
  GroupedListingDuplicates,
  ListingDuplicateDetectionResult,
} from "./types";
import type { ProductSignals } from "@/lib/normalization";
import { extractProductSignals } from "@/lib/normalization";

export function detectListingDuplicates(
  reference: ComparisonListing,
  candidates: ComparisonListing[],
  threshold: number = 70,
): ListingDuplicateDetectionResult {
  const refInput = createComparisonInput(reference.title, {
    price: reference.price,
    sourceId: reference.sourceId,
    condition: reference.condition,
    productType: reference.productType,
  });

  const matches: DuplicateMatch[] = [];

  for (const candidate of candidates) {
    const candInput = createComparisonInput(candidate.title, {
      price: candidate.price,
      sourceId: candidate.sourceId,
      condition: candidate.condition,
      productType: candidate.productType,
    });

    const result = compareListings(refInput, candInput);
    if (result.score >= threshold) {
      matches.push({
        listing1Id: reference.id,
        listing2Id: candidate.id,
        score: result.score,
        confidence: result.confidence,
        confidenceScore: result.confidenceScore,
        confidenceLevel: result.confidenceLevel,
        confidenceReasons: result.confidenceReasons,
      });
    }
  }

  const bestMatch = matches.reduce<DuplicateMatch | null>(
    (best, match) => {
      if (!best) return match;
      return match.score > best.score ? match : best;
    },
    null,
  );
  const maxScore = bestMatch?.score ?? 0;

  return {
    listing: reference,
    duplicates: matches,
    isDuplicate: maxScore >= threshold,
    confidenceScore: bestMatch?.confidenceScore ?? maxScore,
    suggestion: maxScore >= threshold ? "match" : maxScore >= 50 ? "review" : "none",
  };
}

export function groupListingDuplicates(
  listings: ComparisonListing[],
  threshold: number = 70,
): GroupedListingDuplicates {
  const inputs = listings.map((l) => ({
    ...createComparisonInput(l.title, {
      price: l.price,
      sourceId: l.sourceId,
      condition: l.condition,
      productType: l.productType,
    }),
    id: l.id,
  }));

  const groups = groupDuplicatesEngine(inputs, threshold);

  return {
    groups,
    count: groups.length,
    matchedCount: groups.filter((g) => g.duplicates.length > 0).length,
  };
}

export function groupListingDuplicatesByKey(
  listings: ComparisonListing[],
  threshold: number = 70,
): GroupedListingDuplicates & { comparisonsBefore: number; comparisonsAfter: number } {
  const startTime = performance.now();

  // Cache extractProductSignals results to avoid double computation per listing
  const signalsCache = new Map<string, ProductSignals>();
  function getSignals(title: string): ProductSignals {
    const cached = signalsCache.get(title);
    if (cached) return cached;
    const signals = extractProductSignals(title);
    signalsCache.set(title, signals);
    return signals;
  }

  // Total comparisons if we ran flat O(n²) on all listings
  const n = listings.length;
  const comparisonsBefore = (n * (n - 1)) / 2;

  // Phase 1: partition by brand
  const brandMap = new Map<string, ComparisonListing[]>();
  const nullBrand: ComparisonListing[] = [];

  for (const listing of listings) {
    const signals = getSignals(listing.title);
    const brand = signals.brand;
    if (brand) {
      const bucket = brandMap.get(brand);
      if (bucket) {
        bucket.push(listing);
      } else {
        brandMap.set(brand, [listing]);
      }
    } else {
      nullBrand.push(listing);
    }
  }

  // Phase 2: within each brand, partition by productType, then by normalized_key
  const allGroups: Array<{ brand: string; key: string; items: ComparisonListing[] }> = [];
  const nullKeyWithinBrand: ComparisonListing[] = [];

  for (const [brand, brandListings] of brandMap) {
    // First partition by productType to prevent cross-type grouping
    // e.g. "Samsung S24" phone and "Samsung S24 Charger" accessory get separate buckets
    const typeMap = new Map<string, ComparisonListing[]>();
    const nullTypeListings: ComparisonListing[] = [];

    for (const listing of brandListings) {
      if (listing.productType) {
        const bucket = typeMap.get(listing.productType);
        if (bucket) bucket.push(listing);
        else typeMap.set(listing.productType, [listing]);
      } else {
        nullTypeListings.push(listing);
      }
    }

    // Within each productType bucket, partition by normalized_key
    for (const [, typeListings] of typeMap) {
      const keyMap = new Map<string, ComparisonListing[]>();
      for (const listing of typeListings) {
        const signals = getSignals(listing.title);
        const nk = signals.normalizedKey;
        if (nk && nk !== brand && nk !== listing.title.toLowerCase().replace(/\s+/g, "-")) {
          const bucket = keyMap.get(nk);
          if (bucket) bucket.push(listing);
          else keyMap.set(nk, [listing]);
        } else {
          nullKeyWithinBrand.push(listing);
        }
      }
      for (const [key, items] of keyMap) {
        allGroups.push({ brand, key, items });
      }
    }

    // Also process listings without productType (graceful degradation)
    const nullTypeKeyMap = new Map<string, ComparisonListing[]>();
    for (const listing of nullTypeListings) {
      const signals = getSignals(listing.title);
      const nk = signals.normalizedKey;
      if (nk && nk !== brand && nk !== listing.title.toLowerCase().replace(/\s+/g, "-")) {
        const bucket = nullTypeKeyMap.get(nk);
        if (bucket) bucket.push(listing);
        else nullTypeKeyMap.set(nk, [listing]);
      } else {
        nullKeyWithinBrand.push(listing);
      }
    }
    for (const [key, items] of nullTypeKeyMap) {
      allGroups.push({ brand, key, items });
    }
  }

  // Phase 3: run the duplicate engine within each normalized_key group (brand-matched items)
  const brandInputs: Array<{ id: string | number } & ReturnType<typeof createComparisonInput>> = [];
  let totalComparisons = 0;

  for (const group of allGroups) {
    const g = group.items.length;
    for (const listing of group.items) {
      brandInputs.push({
        ...createComparisonInput(listing.title, {
          price: listing.price,
          sourceId: listing.sourceId,
          condition: listing.condition,
          productType: listing.productType,
        }),
        id: listing.id,
      });
    }
    totalComparisons += (g * (g - 1)) / 2;
  }

  const brandGroups = brandInputs.length > 0 ? groupDuplicatesEngine(brandInputs, threshold) : [];

  // Phase 4: run duplicate engine separately for null-key-within-brand items
  // Prevents O(n²) cross-group comparisons between null-key items and brand-matched groups
  const nullKeyInputs = nullKeyWithinBrand.map((listing) => ({
    ...createComparisonInput(listing.title, {
      price: listing.price,
      sourceId: listing.sourceId,
      condition: listing.condition,
    }),
    id: listing.id,
  }));
  const g2 = nullKeyInputs.length;
  totalComparisons += (g2 * (g2 - 1)) / 2;
  const nullKeyGroups = nullKeyInputs.length > 0 ? groupDuplicatesEngine(nullKeyInputs, threshold) : [];

  // Phase 5: run duplicate engine separately for truly brandless items
  // Prevents O(n²) cross-group comparisons between null-brand items and all brand-matched groups
  const nullBrandInputs = nullBrand.map((listing) => ({
    ...createComparisonInput(listing.title, {
      price: listing.price,
      sourceId: listing.sourceId,
      condition: listing.condition,
    }),
    id: listing.id,
  }));
  const g3 = nullBrandInputs.length;
  totalComparisons += (g3 * (g3 - 1)) / 2;
  const nullBrandGroups = nullBrandInputs.length > 0 ? groupDuplicatesEngine(nullBrandInputs, threshold) : [];

  const groups = [...brandGroups, ...nullKeyGroups, ...nullBrandGroups];

  const comparisonsAfter = totalComparisons;
  const elapsed = performance.now() - startTime;

  console.log(
    `[Duplicate ByKey] ${listings.length} listings → ${brandMap.size} brands + ${nullBrand.length} unbranded, ` +
    `${allGroups.length} product key groups. Comparisons: ${comparisonsBefore} → ${comparisonsAfter} (${comparisonsBefore > 0 ? Math.round((1 - comparisonsAfter / comparisonsBefore) * 100) : 0}% reduction). ` +
    `${elapsed.toFixed(1)}ms`
  );

  return {
    groups,
    count: groups.length,
    matchedCount: groups.filter((g) => g.duplicates.length > 0).length,
    comparisonsBefore,
    comparisonsAfter,
  };
}
