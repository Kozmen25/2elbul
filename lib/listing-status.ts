export function isMissingStatusColumn(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: string; message?: string; details?: string };
  const text = `${record.message ?? ""} ${record.details ?? ""}`.toLowerCase();
  return (
    record.code === "42703" ||
    record.code === "PGRST204" ||
    (text.includes("status") &&
      (text.includes("column") || text.includes("schema cache")))
  );
}

export function isMissingAttributesColumn(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: string; message?: string; details?: string };
  const text = `${record.message ?? ""} ${record.details ?? ""}`.toLowerCase();
  return (
    record.code === "42703" ||
    record.code === "PGRST204" ||
    text.includes("attributes")
  );
}

export function isMissingColumnStrict(error: unknown, column: string): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: string; message?: string; details?: string };
  const text = `${record.message ?? ""} ${record.details ?? ""}`.toLowerCase();
  return (
    record.code === "42703" ||
    record.code === "PGRST204" ||
    (text.includes(column.toLowerCase()) &&
      (text.includes("column") || text.includes("schema cache")))
  );
}

export function isMissingColumn(error: unknown, column: string): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: string; message?: string; details?: string };
  const text = `${record.message ?? ""} ${record.details ?? ""}`.toLowerCase();
  return (
    record.code === "42703" ||
    record.code === "PGRST204" ||
    text.includes(column.toLowerCase())
  );
}

export function isMissingColumnArray(error: unknown, columns: string[]): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: string; message?: string; details?: string };
  const text = `${record.message ?? ""} ${record.details ?? ""}`.toLowerCase();
  return (
    record.code === "42703" ||
    record.code === "PGRST204" ||
    columns.some((col) => text.includes(col))
  );
}

export function isMissingPriceHistorySchemaError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: string; message?: string; details?: string };
  const text = `${record.message ?? ""} ${record.details ?? ""}`.toLowerCase();
  return (
    record.code === "42P01" ||
    record.code === "42703" ||
    record.code === "PGRST204" ||
    text.includes("price_history") ||
    text.includes("recorded_at") ||
    text.includes("source")
  );
}

export function isMissingSiteSettingsTable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: string; message?: string; details?: string };
  const text = `${record.message ?? ""} ${record.details ?? ""}`.toLowerCase();
  return (
    record.code === "42P01" ||
    record.code === "PGRST205" ||
    (text.includes("site_settings") &&
      (text.includes("relation") || text.includes("schema cache")))
  );
}

export function isMissingPriceHistoryTable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: string; message?: string; details?: string };
  const text = `${record.message ?? ""} ${record.details ?? ""}`.toLowerCase();
  return (
    record.code === "42P01" ||
    record.code === "PGRST205" ||
    text.includes("price_history")
  );
}

export function isMissingSearchDemandTable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: string; message?: string; details?: string };
  const text = `${record.message ?? ""} ${record.details ?? ""}`.toLowerCase();
  return (
    record.code === "42P01" ||
    record.code === "PGRST205" ||
    text.includes("search_demands")
  );
}

export function isMissingListingUpdatedAtColumn(error: unknown) {
  return isMissingColumn(error, "updated_at");
}

export function isMissingProductCategoryColumn(error: unknown) {
  return isMissingColumn(error, "category");
}

export function isMissingSearchQueueTable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: string; message?: string; details?: string };
  const text = `${record.message ?? ""} ${record.details ?? ""}`.toLowerCase();
  return (
    record.code === "42P01" ||
    record.code === "PGRST205" ||
    text.includes("search_demands") ||
    text.includes("bot_queue")
  );
}

export function isMissingBotListingStatusColumn(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: string; message?: string; details?: string };
  const text = `${record.message ?? ""} ${record.details ?? ""}`.toLowerCase();
  return (
    record.code === "42703" ||
    record.code === "PGRST204" ||
    (text.includes("bot_listing_status") &&
      (text.includes("column") || text.includes("schema cache")))
  );
}

export function isMissingIntegrationSettingsColumn(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: string; message?: string; details?: string };
  const text = `${record.message ?? ""} ${record.details ?? ""}`.toLowerCase();
  return (
    record.code === "42703" ||
    record.code === "PGRST204" ||
    [
      "api_url",
      "scrape_url",
      "cron_enabled",
      "cron_schedule",
      "product_limit",
      "fetch_limit",
      "integration_type",
      "bot_import_mode",
      "last_success",
    ].some((column) => text.includes(column))
  );
}
