import { normalizeProductTitle as newNormalizeProductTitle } from "@/lib/normalization";
import { isRecord } from "@/lib/records";

export const normalizeProductTitle = newNormalizeProductTitle;

export function compactModelSuffix(value: string | undefined) {
  return value?.trim().replace(/\s+/g, "-") ?? "";
}

export function normalizeCapacity(value: string) {
  const normalized = value.toLocaleLowerCase("en-US").replace(/\s+/g, "");
  return normalized === "1024gb" ? "1tb" : normalized;
}

export function formatModelPart(value: string) {
  if (/^\d+$/.test(value)) return value;
  if (value === "fe") return "FE";
  return value.charAt(0).toLocaleUpperCase("tr-TR") + value.slice(1);
}

export function titleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map(formatModelPart)
    .join(" ");
}

export function isDuplicateError(error: unknown) {
  if (!isRecord(error)) return false;
  return typeof error.code === "string" && error.code === "23505";
}
