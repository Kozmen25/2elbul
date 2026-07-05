import {
  extractBrand,
  formatBrandDisplayName,
  normalizeSearchText as newNormalizeSearchText,
} from "../normalization";

export const normalizeSearchText = newNormalizeSearchText;

export function createDeterministicExternalId(
  source: string,
  url: string,
  title: string,
): string {
  return `${source}-${normalizeSearchText(url || title).replace(/\s+/g, "-")}`.slice(
    0,
    180,
  );
}

export function deriveBrand(title: string): string | null {
  return formatBrandDisplayName(extractBrand(title));
}
