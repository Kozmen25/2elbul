import type { SupabaseClient } from "@supabase/supabase-js";
import type { ICategoryResolver } from "./taxonomy/integration";
import {
  extractBrand,
  isBareIphoneModel,
  isBareSamsungModel,
  normalizeProductTitle as newNormalizeProductTitle,
} from "./normalization";
import { isRecord } from "./records";
import type { DuplicateMatch, DuplicateGroup } from "./duplicate-engine/types";
import type { ConfidenceMetadata } from "./confidence-engine";
import {
  createComparisonInput,
  compareListings,
  groupDuplicates as groupDuplicatesEngine,
} from "./duplicate-engine";
import {
  buildProductMatcherConfidenceInput,
  calculateConfidence,
  toConfidenceMetadata,
} from "./confidence-engine";

export type ProductSignals = {
  brand: string | null;
  model: string | null;
  storage: string | null;
  ram: string | null;
  color: string | null;
  category: string | null;
  normalizedKey: string;
};

export type MatchedProduct = {
  id: string | number;
  name: string;
  signals: ProductSignals;
  created: boolean;
} & ConfidenceMetadata;

export type ProductMatcherDryRunResult = {
  inputTitle: string;
  normalizedTitle: string;
  signals: ProductSignals;
  productKey: string;
  matchedProduct: {
    id: string | number;
    name: string;
  } | null;
  wouldCreate: boolean;
  suggestedName: string;
} & ConfidenceMetadata;

export type ListingDuplicateDetectionResult = {
  listing: ComparisonListing;
  duplicates: DuplicateMatch[];
  isDuplicate: boolean;
  confidenceScore: number;
  suggestion: "match" | "review" | "none";
};

export type GroupedListingDuplicates = {
  groups: DuplicateGroup[];
  count: number;
  matchedCount: number;
};

export type DuplicateBatchSummary = {
  threshold: number;
  itemCount: number;
  groupCount: number;
  matchedGroupCount: number;
  duplicatePairCount: number;
  duplicateItemCount: number;
  maxGroupSize: number;
  topGroups: Array<{
    canonicalId: string | number;
    canonicalTitle: string;
    duplicateCount: number;
    maxScore: number;
    sampleTitles: string[];
  }>;
};

type ComparisonListing = {
  id: string | number;
  title: string;
  price: number;
  source: string;
  condition?: string;
};

type ProductRow = {
  id: string | number;
  name: string;
  category?: string | null;
};

type FindOrCreateMatchedProductInput = {
  supabase: SupabaseClient;
  title: string;
  productName?: string | null;
  category?: string | null;
  source?: string | null;
  resolver?: ICategoryResolver;
};

const storageValues = ["64", "128", "256", "512", "1024", "1"];
const colors = [
  "siyah",
  "beyaz",
  "mavi",
  "kirmizi",
  "yesil",
  "mor",
  "pembe",
  "gri",
  "gumus",
  "altin",
  "gold",
  "black",
  "white",
  "blue",
  "red",
  "green",
  "purple",
  "pink",
  "gray",
  "grey",
  "silver",
];

export const normalizeProductTitle = newNormalizeProductTitle;

function buildProductConfidenceMetadata(
  signals: ProductSignals,
  input: {
    normalizedTitle: string;
    canonicalTitle: string;
    source?: string | null;
    category?: string | null;
  },
): ConfidenceMetadata {
  const confidence = calculateConfidence(
    buildProductMatcherConfidenceInput({
      signals,
      normalizedTitle: input.normalizedTitle,
      canonicalTitle: input.canonicalTitle,
      sourceName: input.source ?? null,
      categoryConfidence: input.category ? "medium" : null,
    }),
  );

  return toConfidenceMetadata(confidence);
}

export function extractProductSignals(title: string, resolver?: ICategoryResolver): ProductSignals {
  const normalized = normalizeProductTitle(title);
  const tokens = normalized.split(" ").filter(Boolean);
  const brand = extractBrand(normalized);
  const model = detectModel(normalized, tokens, brand);
  const storage = detectStorage(normalized, tokens);
  const ram = detectRam(normalized);
  const color = detectColor(tokens);
  const category = resolver
    ? resolver.resolveSync(title).categoryLabel
    : detectCategory(normalized, brand);
  const keyParts = [
    brand,
    model,
    storage,
    ram && category !== "Telefon" ? ram : null,
  ].filter(Boolean);
  const normalizedKey = keyParts.length
    ? keyParts.join("-").replace(/[^a-z0-9]+/g, "-")
    : normalized.replace(/\s+/g, "-");

  return {
    brand,
    model,
    storage,
    ram,
    color,
    category,
    normalizedKey,
  };
}

export function generateProductKey(title: string) {
  return extractProductSignals(title).normalizedKey;
}

export async function dryRunProductMatch({
  supabase,
  title,
  productName,
  category,
  source,
  resolver,
}: FindOrCreateMatchedProductInput): Promise<ProductMatcherDryRunResult> {
  const combinedTitle = `${productName ?? ""} ${title}`.trim();
  const signals = extractProductSignals(combinedTitle, resolver);
  const normalizedTitle = normalizeProductTitle(combinedTitle);
  const productKey = signals.normalizedKey;
  const suggestedName = createCanonicalProductName(signals, productName || title);
  const confidence = buildProductConfidenceMetadata(signals, {
    normalizedTitle,
    canonicalTitle: suggestedName,
    source: source ?? null,
    category: category || signals.category,
  });
  const matchedProduct = await findExistingMatchedProduct(
    supabase,
    suggestedName,
    productKey,
  );

  return {
    inputTitle: title,
    normalizedTitle,
    signals: {
      ...signals,
      category: category || signals.category,
    },
    productKey,
    matchedProduct: matchedProduct
      ? {
          id: matchedProduct.id,
          name: matchedProduct.name,
        }
      : null,
    wouldCreate: !matchedProduct,
    suggestedName,
    ...confidence,
  };
}

export async function findOrCreateMatchedProduct({
  supabase,
  title,
  productName,
  category,
  source,
  resolver,
}: FindOrCreateMatchedProductInput): Promise<MatchedProduct> {
  const combinedTitle = `${productName ?? ""} ${title}`.trim();
  const normalizedTitle = normalizeProductTitle(combinedTitle);
  const signals = extractProductSignals(combinedTitle, resolver);
  const canonicalName = createCanonicalProductName(signals, productName || title);
  const canonicalKey = signals.normalizedKey;
  const confidence = buildProductConfidenceMetadata(signals, {
    normalizedTitle,
    canonicalTitle: canonicalName,
    source: source ?? null,
    category: category || signals.category,
  });

  const matchedProduct = await findExistingMatchedProduct(
    supabase,
    canonicalName,
    canonicalKey,
  );
  if (matchedProduct) {
    return {
      id: matchedProduct.id,
      name: matchedProduct.name,
      signals,
      created: false,
      ...confidence,
    };
  }

  const insertPayload: Record<string, unknown> = {
    name: canonicalName,
  };
  const productCategory = category || signals.category;
  if (productCategory) insertPayload.category = productCategory;

  const { data: createdProduct, error: insertError } = await supabase
    .from("products")
    .insert(insertPayload)
    .select("id, name")
    .single();
  if (insertError && isDuplicateError(insertError)) {
    const duplicateLookup = await supabase
      .from("products")
      .select("id, name")
      .eq("name", canonicalName)
      .maybeSingle();
    if (duplicateLookup.error) throw duplicateLookup.error;
    if (duplicateLookup.data) {
      return {
        id: duplicateLookup.data.id,
        name: String(duplicateLookup.data.name),
        signals,
        created: false,
        ...confidence,
      };
    }
  }
  if (insertError || !createdProduct) {
    throw new Error(insertError?.message ?? "Ürün oluşturulamadı.");
  }

  return {
    id: createdProduct.id,
    name: String(createdProduct.name),
    signals,
    created: true,
    ...confidence,
  };
}

async function findExistingMatchedProduct(
  supabase: SupabaseClient,
  canonicalName: string,
  canonicalKey: string,
) {
  const exact = await supabase
    .from("products")
    .select("id, name, category")
    .eq("name", canonicalName)
    .maybeSingle();
  if (exact.error) throw exact.error;
  if (exact.data) {
    return {
      id: exact.data.id,
      name: String(exact.data.name),
      category: exact.data.category ? String(exact.data.category) : null,
    };
  }

  const { data: products, error: lookupError } = await supabase
    .from("products")
    .select("id, name, category")
    .limit(2000);
  if (lookupError) throw lookupError;

  const matched = (products ?? []).find(
    (product: ProductRow) => generateProductKey(product.name) === canonicalKey,
  );
  if (!matched) return null;

  return {
    id: matched.id,
    name: matched.name,
    category: matched.category ?? null,
  };
}

export function detectListingDuplicates(
  reference: ComparisonListing,
  candidates: ComparisonListing[],
  threshold: number = 70
): ListingDuplicateDetectionResult {
  const refInput = createComparisonInput(reference.title, {
    price: reference.price,
    sourceId: 1,
    condition: reference.condition,
  });

  const matches: DuplicateMatch[] = [];
  
  for (const candidate of candidates) {
    const candInput = createComparisonInput(candidate.title, {
      price: candidate.price,
      sourceId: 2,
      condition: candidate.condition,
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
    suggestion:
      maxScore >= threshold ? "match" : maxScore >= 50 ? "review" : "none",
  };
}

export function groupListingDuplicates(
  listings: ComparisonListing[],
  threshold: number = 70
): GroupedListingDuplicates {
  const inputs = listings.map((l) => ({
    ...createComparisonInput(l.title, {
      price: l.price,
      sourceId: 1,
      condition: l.condition,
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

export function summarizeDuplicateGroups(
  grouped: GroupedListingDuplicates,
  itemCount: number,
  threshold: number = 70,
): DuplicateBatchSummary {
  const duplicatePairCount = grouped.groups.reduce(
    (total, group) => total + group.duplicates.length,
    0,
  );
  const duplicateItemCount = grouped.groups.reduce(
    (total, group) => total + group.duplicates.length + 1,
    0,
  );
  const maxGroupSize = grouped.groups.reduce(
    (max, group) => Math.max(max, group.duplicates.length + 1),
    0,
  );

  const topGroups = grouped.groups
    .map((group) => {
      const duplicateCount = group.duplicates.length;
      const maxScore =
        duplicateCount > 0
          ? Math.max(...group.duplicates.map((candidate) => candidate.score))
          : 0;

      return {
        canonicalId: group.canonical.title,
        canonicalTitle: group.canonical.title,
        duplicateCount,
        maxScore,
        sampleTitles: group.duplicates.slice(0, 3).map((candidate) => candidate.title),
      };
    })
    .sort(
      (a, b) =>
        b.duplicateCount - a.duplicateCount ||
        b.maxScore - a.maxScore ||
        a.canonicalTitle.localeCompare(b.canonicalTitle, "tr"),
    )
    .slice(0, 3);

  return {
    threshold,
    itemCount,
    groupCount: grouped.count,
    matchedGroupCount: grouped.matchedCount,
    duplicatePairCount,
    duplicateItemCount,
    maxGroupSize,
    topGroups,
  };
}

function detectModel(
  normalized: string,
  tokens: string[],
  brand: string | null,
) {
  const iphone = normalized.match(
    /\b(?:iphone\s*)?(1[1-6])\s*(pro\s*max|pro|plus|mini)?\b/,
  );
  if ((brand === "apple" || isBareIphoneModel(normalized)) && iphone) {
    return ["iphone", iphone[1], compactModelSuffix(iphone[2])]
      .filter(Boolean)
      .join("-");
  }

  const samsung = normalized.match(
    /\b(?:samsung\s*)?(?:galaxy\s*)?((?:s|a|m)\d{2}(?:\s*ultra|\s*plus|\s*fe)?|z\s*(?:fold|flip)\s*\d?)\b/,
  );
  if (
    (brand === "samsung" ||
      normalized.includes("galaxy") ||
      isBareSamsungModel(normalized)) &&
    samsung
  ) {
    return `galaxy-${samsung[1].replace(/\s+/g, "-")}`;
  }

  const ipad = normalized.match(/\bipad\s*(\d+|air|pro|mini)?(?:\s*nesil)?\b/);
  if (ipad) return ["ipad", ipad[1]].filter(Boolean).join("-");

  const macbook = normalized.match(/\bmacbook\s*(air|pro)?\s*(m\d)?\b/);
  if (macbook) return ["macbook", macbook[1], macbook[2]].filter(Boolean).join("-");

  return tokens.slice(0, 4).join("-");
}

function detectStorage(normalized: string, tokens: string[]) {
  const explicit = normalized.match(/\b(\d{2,4}gb|\d+tb)\b/);
  if (explicit) return normalizeCapacity(explicit[1]);

  const bare = tokens.find((token) => storageValues.includes(token));
  return bare ? normalizeCapacity(`${bare}${bare === "1" ? "tb" : "gb"}`) : null;
}

function detectRam(normalized: string) {
  const match = normalized.match(/\b(\d{1,3})\s*(?:gb)?\s*ram\b/);
  return match ? `${match[1]}gb` : null;
}

function detectColor(tokens: string[]) {
  return tokens.find((token) => colors.includes(token)) ?? null;
}

function detectCategory(normalized: string, brand: string | null) {
  if (
    brand === "apple" &&
    (normalized.includes("iphone") || isBareIphoneModel(normalized))
  ) {
    return "Telefon";
  }
  if (brand === "samsung" && /\b(galaxy|s\d{2}|a\d{2})\b/.test(normalized)) {
    return "Telefon";
  }
  if (normalized.includes("ipad") || normalized.includes("tablet")) return "Tablet";
  if (normalized.includes("macbook") || normalized.includes("laptop")) {
    return "Laptop";
  }
  if (normalized.includes("playstation") || normalized.includes("ps5")) {
    return "Oyun Konsolu";
  }
  if (normalized.includes("rtx") || normalized.includes("ekran karti")) {
    return "Ekran Kartı";
  }
  return null;
}

function createCanonicalProductName(signals: ProductSignals, fallback: string) {
  if (signals.brand === "apple" && signals.model?.startsWith("iphone-")) {
    return [
      "iPhone",
      ...signals.model
        .replace(/^iphone-/, "")
        .split("-")
        .map(formatModelPart),
      signals.storage?.toUpperCase(),
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (signals.brand === "samsung" && signals.model?.startsWith("galaxy-")) {
    return [
      "Samsung Galaxy",
      ...signals.model
        .replace(/^galaxy-/, "")
        .split("-")
        .map(formatModelPart),
      signals.storage?.toUpperCase(),
    ]
      .filter(Boolean)
      .join(" ");
  }

  return titleCase(normalizeProductTitle(fallback));
}

function compactModelSuffix(value: string | undefined) {
  return value?.trim().replace(/\s+/g, "-") ?? "";
}

function normalizeCapacity(value: string) {
  const normalized = value.toLocaleLowerCase("en-US").replace(/\s+/g, "");
  return normalized === "1024gb" ? "1tb" : normalized;
}

function formatModelPart(value: string) {
  if (/^\d+$/.test(value)) return value;
  if (value === "fe") return "FE";
  return value.charAt(0).toLocaleUpperCase("tr-TR") + value.slice(1);
}

function titleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map(formatModelPart)
    .join(" ");
}

function isDuplicateError(error: unknown) {
  if (!isRecord(error)) return false;
  return typeof error.code === "string" && error.code === "23505";
}
