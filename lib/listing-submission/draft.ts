// The wizard keeps an unsent draft in localStorage so a closed tab or a
// dropped connection does not lose what the user typed. Pure (de)serialisation.

import type { ListingSubmissionInput } from "@/lib/listing-submission/validation";

export const DRAFT_STORAGE_KEY = "listingDraft:v1";
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type ListingDraft = {
  input: ListingSubmissionInput;
  productName: string;
  savedAt: number;
};

const FIELDS: (keyof ListingSubmissionInput)[] = ["productId", "title", "price", "city", "source", "condition", "url"];

export function isEmptyDraft(input: ListingSubmissionInput): boolean {
  return FIELDS.every((field) => input[field].trim() === "");
}

export function serializeDraft(input: ListingSubmissionInput, productName: string, now = Date.now()): string {
  return JSON.stringify({ input, productName, savedAt: now } satisfies ListingDraft);
}

/** Returns the stored draft, or null when it is missing, malformed, empty or older than a week. */
export function parseDraft(raw: string | null, now = Date.now()): ListingDraft | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<ListingDraft>;
    if (!data || typeof data !== "object" || typeof data.savedAt !== "number" || !data.input) return null;
    if (now - data.savedAt > DRAFT_MAX_AGE_MS) return null;

    const input = {} as ListingSubmissionInput;
    for (const field of FIELDS) {
      const value = (data.input as Record<string, unknown>)[field];
      input[field] = typeof value === "string" ? value.slice(0, 500) : "";
    }
    if (isEmptyDraft(input)) return null;
    return { input, productName: typeof data.productName === "string" ? data.productName.slice(0, 200) : "", savedAt: data.savedAt };
  } catch {
    return null;
  }
}
