export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function getRecordString(
  value: Record<string, unknown> | null | undefined,
  key: string,
): string | undefined {
  const candidate = value?.[key];
  return typeof candidate === "string" && candidate.trim()
    ? candidate.trim()
    : undefined;
}

export function getNestedRecord(
  value: Record<string, unknown> | null | undefined,
  key: string,
): Record<string, unknown> | null {
  const candidate = value?.[key];
  return isRecord(candidate) ? candidate : null;
}

export function getNestedRecordString(
  value: Record<string, unknown> | null | undefined,
  key: string,
  nestedKey: string,
): string | undefined {
  return getRecordString(getNestedRecord(value, key), nestedKey);
}
