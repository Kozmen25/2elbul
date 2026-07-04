import type {
  NormalizedListing,
  ValidationResult,
  ListingValidationError,
  MatchingResult,
} from "./types";

export function validateListing(
  listing: NormalizedListing,
): ValidationResult {
  const errors: ListingValidationError[] = [];

  if (!listing.externalId?.trim()) {
    errors.push({ field: "externalId", reason: "Boş veya geçersiz" });
  }

  if (!listing.title?.trim()) {
    errors.push({ field: "title", reason: "Başlık boş" });
  }

  if (!Number.isFinite(listing.price) || listing.price <= 0) {
    errors.push({
      field: "price",
      reason: `Geçersiz fiyat: ${listing.price}`,
    });
  }

  if (listing.price > 100000000) {
    errors.push({
      field: "price",
      reason: "Fiyat çok yüksek (>100M TRY)",
    });
  }

  if (!listing.url?.trim()) {
    errors.push({ field: "url", reason: "URL boş" });
  }

  if (!listing.currency || listing.currency !== "TRY") {
    errors.push({
      field: "currency",
      reason: "Para birimi TRY değil",
    });
  }

  if (listing.sourceId <= 0) {
    errors.push({ field: "sourceId", reason: "Geçersiz kaynak ID" });
  }

  if (!listing.sourceName?.trim()) {
    errors.push({ field: "sourceName", reason: "Kaynak adı boş" });
  }

  return {
    ok: errors.length === 0,
    value: errors.length === 0 ? listing : null,
    errors,
  };
}

export function createNormalizedListing(
  overrides: Partial<NormalizedListing> & {
    externalId: string;
    title: string;
    price: number;
    url: string;
    sourceId: number;
    sourceName: string;
  },
): NormalizedListing {
  return {
    currency: "TRY",
    imageUrl: null,
    location: null,
    condition: "İkinci El",
    listedAt: null,
    rawData: null,
    ...overrides,
  };
}

export function createEmptyMatchingResult(): MatchingResult {
  return {
    score: 0,
    productId: null,
    confidence: "none",
  };
}

export function createHighConfidenceMatch(productId: number): MatchingResult {
  return {
    score: 0.95,
    productId,
    confidence: "high",
  };
}

export function createMediumConfidenceMatch(
  productId: number,
): MatchingResult {
  return {
    score: 0.75,
    productId,
    confidence: "medium",
  };
}

export function createLowConfidenceMatch(productId: number): MatchingResult {
  return {
    score: 0.5,
    productId,
    confidence: "low",
  };
}

export async function executePipeline<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<{ result: T | null; error: string | null; duration: number }> {
  const start = Date.now();
  try {
    const result = await fn();
    return {
      result,
      error: null,
      duration: Date.now() - start,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    console.error(`Pipeline ${name} error:`, message);
    return {
      result: null,
      error: message,
      duration: Date.now() - start,
    };
  }
}
