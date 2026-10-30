// Validation shared by the wizard (per step, while typing) and the server
// action (the authority). Pure: no I/O.

import { LISTING_CONDITIONS, LISTING_SOURCES, type ListingCondition, type ListingSource } from "@/lib/listings";
import { isTrCity } from "@/lib/listing-submission/cities";
import { parseTlPrice } from "@/lib/listing-submission/price";
import { normalizeListingUrl, urlMatchesSource } from "@/lib/listing-submission/url";

export const TITLE_MIN_LENGTH = 8;
export const TITLE_MAX_LENGTH = 160;
/** Submissions a user may have waiting for approval per 24 hours. */
export const MAX_SUBMISSIONS_PER_DAY = 10;

export type ListingSubmissionInput = {
  productId: string;
  title: string;
  price: string;
  city: string;
  source: string;
  condition: string;
  url: string;
};

export type ListingField = keyof ListingSubmissionInput;
export type ListingFieldErrors = Partial<Record<ListingField, string>>;

export type ValidListingSubmission = {
  productId: number;
  title: string;
  price: number;
  city: string;
  source: ListingSource;
  condition: ListingCondition;
  url: string;
};

export type ListingValidation =
  | { ok: true; value: ValidListingSubmission; warnings: Partial<Record<ListingField, string>> }
  | { ok: false; errors: ListingFieldErrors };

export const STEP_FIELDS: ListingField[][] = [["productId"], ["title", "price", "condition", "city", "source", "url"]];

export function cleanTitle(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function validateFields(input: ListingSubmissionInput, fields: ListingField[]): ListingFieldErrors {
  const errors: ListingFieldErrors = {};
  const wants = (field: ListingField) => fields.includes(field);

  if (wants("productId")) {
    const id = Number(input.productId);
    if (!Number.isSafeInteger(id) || id <= 0) errors.productId = "İlanın hangi ürüne ait olduğunu seçin.";
  }

  if (wants("title")) {
    const title = cleanTitle(input.title);
    if (title.length < TITLE_MIN_LENGTH) errors.title = `Başlık en az ${TITLE_MIN_LENGTH} karakter olmalı.`;
    else if (title.length > TITLE_MAX_LENGTH) errors.title = `Başlık en fazla ${TITLE_MAX_LENGTH} karakter olabilir.`;
    else if (/^https?:\/\//i.test(title)) errors.title = "Başlığa bağlantı değil, ilanın başlığını yazın.";
  }

  if (wants("price") && parseTlPrice(input.price) === null) {
    errors.price = "Geçerli bir fiyat girin (ör. 25.000).";
  }

  if (wants("condition") && !(LISTING_CONDITIONS as string[]).includes(input.condition)) {
    errors.condition = "Ürünün durumunu seçin.";
  }

  if (wants("city") && !isTrCity(input.city)) errors.city = "Listeden bir şehir seçin.";

  if (wants("source") && !(LISTING_SOURCES as string[]).includes(input.source)) {
    errors.source = "İlanın yayınlandığı siteyi seçin.";
  }

  if (wants("url")) {
    const url = normalizeListingUrl(input.url);
    if (!url.ok) errors.url = url.reason;
  }

  return errors;
}

/** Errors for the fields of one wizard step (0-based). */
export function validateStep(step: number, input: ListingSubmissionInput): ListingFieldErrors {
  return validateFields(input, STEP_FIELDS[step] ?? []);
}

/** Non-blocking hints, e.g. a link that does not look like it is from the chosen site. */
export function listingWarnings(input: ListingSubmissionInput): Partial<Record<ListingField, string>> {
  const warnings: Partial<Record<ListingField, string>> = {};
  const url = normalizeListingUrl(input.url);
  if (url.ok && (LISTING_SOURCES as string[]).includes(input.source) && !urlMatchesSource(url.host, input.source as ListingSource)) {
    warnings.url = `Bu bağlantı ${input.source} sitesine ait görünmüyor. Doğru siteyi seçtiğinden emin ol.`;
  }
  return warnings;
}

export function validateListingSubmission(input: ListingSubmissionInput): ListingValidation {
  const errors = validateFields(input, STEP_FIELDS.flat());
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const url = normalizeListingUrl(input.url);
  const price = parseTlPrice(input.price);
  if (!url.ok || price === null) return { ok: false, errors: { url: "Geçerli bir bağlantı girin." } };

  return {
    ok: true,
    value: {
      productId: Number(input.productId),
      title: cleanTitle(input.title),
      price,
      city: input.city,
      source: input.source as ListingSource,
      condition: input.condition as ListingCondition,
      url: url.url,
    },
    warnings: listingWarnings(input),
  };
}
