type DateInput = string | number | Date;

const tryCurrencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();

export function formatCurrencyTRY(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "—";
  return tryCurrencyFormatter.format(value);
}

export function formatNumberTR(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDateTR(
  value: DateInput | null | undefined,
  options: Intl.DateTimeFormatOptions,
) {
  if (value == null) return "—";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const formatter = getDateFormatter(options);
  return formatter.format(date);
}

function getDateFormatter(options: Intl.DateTimeFormatOptions) {
  const key = stableOptionsKey(options);
  const existing = dateFormatterCache.get(key);
  if (existing) return existing;

  const formatter = new Intl.DateTimeFormat("tr-TR", options);
  dateFormatterCache.set(key, formatter);
  return formatter;
}

function stableOptionsKey(options: Intl.DateTimeFormatOptions) {
  return Object.entries(options)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${String(value)}`)
    .join("|");
}
