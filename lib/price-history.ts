import type { SupabaseClient } from "@supabase/supabase-js";

export type PriceHistoryInput = {
  productId: number | string | null | undefined;
  listingId: number | string | null | undefined;
  source?: string | null;
  price: number | string | null | undefined;
  recordedAt?: string | Date | null;
};

export type PriceHistoryWriteResult = {
  ok: boolean;
  inserted: boolean;
  skipped: boolean;
  reason?: "invalid_input" | "duplicate" | "schema_missing" | "write_failed";
  error?: string;
};

export type ExistingPriceHistoryRecord = {
  listingId: number | string | null;
  price: number | string | null;
  recordedAt: string | Date | null;
};

type NormalizedPriceHistoryInput = {
  productId: number;
  listingId: number;
  source: string;
  price: number;
  recordedAt: Date;
};

export function normalizePriceHistoryInput(
  input: PriceHistoryInput,
): NormalizedPriceHistoryInput | null {
  const productId = Number(input.productId);
  const listingId = Number(input.listingId);
  const price = Math.round(Number(input.price));
  const recordedAt = input.recordedAt ? new Date(input.recordedAt) : new Date();

  if (
    !Number.isFinite(productId) ||
    !Number.isFinite(listingId) ||
    productId <= 0 ||
    listingId <= 0 ||
    !Number.isFinite(price) ||
    price <= 0 ||
    Number.isNaN(recordedAt.getTime())
  ) {
    return null;
  }

  return {
    productId,
    listingId,
    source: input.source?.trim() || "Bilinmeyen kaynak",
    price,
    recordedAt,
  };
}

export function isSameListingSameDaySamePrice(
  input: PriceHistoryInput,
  records: ExistingPriceHistoryRecord[],
) {
  const normalized = normalizePriceHistoryInput(input);
  if (!normalized) return false;

  return records.some((record) => {
    const recordDate = record.recordedAt ? new Date(record.recordedAt) : null;
    return (
      Number(record.listingId) === normalized.listingId &&
      Number(record.price) === normalized.price &&
      recordDate !== null &&
      !Number.isNaN(recordDate.getTime()) &&
      toUtcDay(recordDate) === toUtcDay(normalized.recordedAt)
    );
  });
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

export async function recordListingPriceHistory(
  supabase: SupabaseClient,
  input: PriceHistoryInput,
): Promise<PriceHistoryWriteResult> {
  const normalized = normalizePriceHistoryInput(input);
  if (!normalized) {
    return {
      ok: false,
      inserted: false,
      skipped: true,
      reason: "invalid_input",
      error: "Price history girdisi gecersiz.",
    };
  }

  const dayStart = startOfUtcDay(normalized.recordedAt).toISOString();
  const nextDay = new Date(startOfUtcDay(normalized.recordedAt));
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  const duplicate = await supabase
    .from("price_history")
    .select("id")
    .eq("listing_id", normalized.listingId)
    .eq("price", normalized.price)
    .gte("recorded_at", dayStart)
    .lt("recorded_at", nextDay.toISOString())
    .limit(1)
    .maybeSingle();

  if (duplicate.error) {
    if (isMissingPriceHistorySchemaError(duplicate.error)) {
      console.error("Price history duplicate check skipped:", duplicate.error);
      return {
        ok: false,
        inserted: false,
        skipped: true,
        reason: "schema_missing",
        error: duplicate.error.message,
      };
    }

    console.error("Price history duplicate check failed:", duplicate.error);
    return {
      ok: false,
      inserted: false,
      skipped: false,
      reason: "write_failed",
      error: duplicate.error.message,
    };
  }

  if (duplicate.data) {
    return {
      ok: true,
      inserted: false,
      skipped: true,
      reason: "duplicate",
    };
  }

  const payload = {
    product_id: normalized.productId,
    listing_id: normalized.listingId,
    source: normalized.source,
    price: normalized.price,
    recorded_at: normalized.recordedAt.toISOString(),
  };

  let insert = await supabase.from("price_history").insert(payload);

  if (insert.error && isMissingPriceHistorySchemaError(insert.error)) {
    const { source: _source, ...legacyPayload } = payload;
    insert = await supabase.from("price_history").insert(legacyPayload);
  }

  if (insert.error) {
    console.error("Price history insert failed:", insert.error);
    return {
      ok: false,
      inserted: false,
      skipped: false,
      reason: isMissingPriceHistorySchemaError(insert.error)
        ? "schema_missing"
        : "write_failed",
      error: insert.error.message,
    };
  }

  return { ok: true, inserted: true, skipped: false };
}

export function buildPriceHistoryBackfillCandidates<
  T extends {
    id?: number | string | null;
    product_id?: number | string | null;
    price?: number | string | null;
    source?: string | null;
  },
>(listings: T[]) {
  return listings
    .map((listing) =>
      normalizePriceHistoryInput({
        productId: listing.product_id,
        listingId: listing.id,
        source: listing.source,
        price: listing.price,
      }),
    )
    .filter((listing): listing is NormalizedPriceHistoryInput => listing !== null);
}

function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function toUtcDay(date: Date) {
  return startOfUtcDay(date).toISOString().slice(0, 10);
}
