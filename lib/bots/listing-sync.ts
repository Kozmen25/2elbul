import "server-only";

import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BotAdapterListing } from "@/lib/bots/types";
import { isRecord } from "@/lib/records";
import {
  findOrCreateMatchedProduct,
  groupListingDuplicates,
  summarizeDuplicateGroups,
  type DuplicateBatchSummary,
} from "@/lib/product-matcher";
import { recordListingPriceHistory } from "@/lib/price-history";

type SyncRpcResult = {
  inserted?: number;
  updated?: number;
  inactive?: number;
  reactivated?: number;
  skipped?: number;
};

export type ListingSyncResult = {
  imported: number;
  updated: number;
  inactive: number;
  reactivated: number;
  skipped: number;
  matchedProducts: number;
  errorCount: number;
  errors: string[];
  duplicateSummary: DuplicateBatchSummary | null;
};

type PreparedListingSyncState = {
  productIds: Map<string, string | number>;
  matchedProducts: number;
  duplicateSummary: DuplicateBatchSummary;
  errors: string[];
};

type DuplicateListingInput = {
  id: string;
  title: string;
  price: number;
  source: string;
  condition?: string;
};

export function normalizeSyncStatus(value: unknown) {
  if (value === "pending" || value === "inactive" || value === "active") {
    return value;
  }
  if (value === "published") return "active";
  return "active";
}

export function createListingExternalId(url: string) {
  return createHash("sha1").update(url.trim().toLowerCase()).digest("hex");
}

async function prepareListingSyncState(
  supabase: SupabaseClient,
  listings: BotAdapterListing[],
): Promise<PreparedListingSyncState> {
  const productIds = await loadProductIdsForListings(supabase, listings);
  const errors: string[] = [];
  const matchedProducts = await resolveMatchedProductIds(
    supabase,
    listings,
    productIds,
    errors,
  );
  const duplicateSummary = buildDuplicateSummary(listings);

  return {
    productIds,
    matchedProducts,
    duplicateSummary,
    errors,
  };
}

export async function syncListingsForSource(
  supabase: SupabaseClient,
  sourceId: number,
  listings: BotAdapterListing[],
  options: { skipInactiveMarking?: boolean } = {},
): Promise<ListingSyncResult> {
  let imported = 0;
  let updated = 0;
  let inactive = 0;
  let reactivated = 0;
  let skipped = 0;
  let errorCount = 0;

  const syncState = await prepareListingSyncState(supabase, listings);
  const errors = [...syncState.errors];

  logDuplicateSummary(`Source ${sourceId}`, syncState.duplicateSummary);

  const payload: Array<Record<string, unknown>> = [];
  for (const listing of listings) {
    const productId = syncState.productIds.get(listing.product_name);
    if (!productId) {
      errorCount += 1;
      errors.push(`${listing.title}: ürün kimliği bulunamadı.`);
      continue;
    }

    payload.push(buildRpcListingPayload(listing, productId));
  }

  if (!payload.length) {
    return {
      imported,
      updated,
      inactive,
      reactivated,
      skipped,
      matchedProducts: syncState.matchedProducts,
      errorCount,
      errors,
      duplicateSummary: syncState.duplicateSummary,
    };
  }

  let rpcResult = await supabase.rpc("sync_source_listings", {
    p_source_id: sourceId,
    p_items: payload,
    p_skip_inactive_marking: Boolean(options.skipInactiveMarking),
  });

  if (rpcResult.error && isRpcSignatureError(rpcResult.error)) {
    rpcResult = await supabase.rpc("sync_source_listings", {
      p_source_id: sourceId,
      p_items: payload,
    });
  }

  if (rpcResult.error) {
    const legacy = await insertListingsLegacy(supabase, listings);
    return {
      imported: legacy.imported,
      updated: legacy.updated,
      inactive: legacy.inactive,
      reactivated: legacy.reactivated,
      skipped: legacy.skipped,
      matchedProducts: syncState.matchedProducts,
      errorCount: legacy.errorCount,
      errors: [
        `RPC başarısız oldu, direct fallback kullanıldı: ${rpcResult.error.message}`,
        ...legacy.errors,
      ],
      duplicateSummary: legacy.duplicateSummary ?? syncState.duplicateSummary,
    };
  }

  const result: SyncRpcResult = rpcResult.data ?? {};
  imported = Number(result.inserted ?? 0);
  updated = Number(result.updated ?? 0);
  inactive = Number(result.inactive ?? 0);
  reactivated = Number(result.reactivated ?? 0);
  skipped = Number(result.skipped ?? 0);

  return {
    imported,
    updated,
    inactive,
    reactivated,
    skipped,
    matchedProducts: syncState.matchedProducts,
    errorCount,
    errors,
    duplicateSummary: syncState.duplicateSummary,
  };
}

export async function insertListingsLegacy(
  supabase: SupabaseClient,
  listings: BotAdapterListing[],
): Promise<ListingSyncResult> {
  let imported = 0;
  let skipped = 0;
  let errorCount = 0;
  const syncState = await prepareListingSyncState(supabase, listings);
  const errors = [...syncState.errors];

  logDuplicateSummary("Legacy sync", syncState.duplicateSummary);

  const urls = listings.map((listing) => listing.url);
  const { data: existingListings, error: duplicateError } = await supabase
    .from("listings")
    .select("url")
    .in("url", urls);

  if (duplicateError) throw duplicateError;
  const existingUrls = new Set(
    (existingListings ?? []).map((listing) => String(listing.url)),
  );

  for (const listing of listings) {
    if (existingUrls.has(listing.url)) {
      skipped += 1;
      continue;
    }

    const productId = syncState.productIds.get(listing.product_name);
    if (!productId) {
      errorCount += 1;
      errors.push(`${listing.title}: ürün kimliği bulunamadı.`);
      continue;
    }

    const { data: createdListing, error: listingInsertError } = await supabase
      .from("listings")
      .insert(buildLegacyListingPayload(listing, productId))
      .select("id")
      .single();

    if (listingInsertError || !createdListing) {
      errorCount += 1;
      errors.push(
        `${listing.title}: ${
          listingInsertError?.message ?? "ilan kaydi olusturulamadi."
        }`,
      );
      continue;
    }

    await recordListingPriceHistory(supabase, {
      productId,
      listingId: createdListing.id,
      source: listing.source,
      price: listing.price,
    });
    imported += 1;
  }

  return {
    imported,
    updated: 0,
    inactive: 0,
    reactivated: 0,
    skipped,
    matchedProducts: syncState.matchedProducts,
    errorCount,
    errors,
    duplicateSummary: syncState.duplicateSummary,
  };
}

function isRpcSignatureError(error: unknown) {
  if (!isRecord(error)) return false;
  const code = typeof error.code === "string" ? error.code : undefined;
  const message = typeof error.message === "string" ? error.message : "";
  const details = typeof error.details === "string" ? error.details : "";
  const text = `${message} ${details}`.toLowerCase();
  return (
    code === "PGRST202" ||
    text.includes("p_skip_inactive_marking") ||
    text.includes("could not find the function") ||
    text.includes("function public.sync_source_listings")
  );
}

async function loadProductIdsForListings(
  supabase: SupabaseClient,
  listings: BotAdapterListing[],
) {
  const productNames = [...new Set(listings.map((listing) => listing.product_name))];
  const { data: existingProducts, error: productLookupError } = await supabase
    .from("products")
    .select("id, name")
    .in("name", productNames);

  if (productLookupError) throw productLookupError;

  return new Map(
    (existingProducts ?? []).map((product) => [String(product.name), product.id]),
  );
}

function buildDuplicateSummary(listings: BotAdapterListing[]) {
  const duplicateGroups = groupListingDuplicates(
    listings.map(toDuplicateListingInput),
    70,
  );

  return summarizeDuplicateGroups(duplicateGroups, listings.length, 70);
}

function logDuplicateSummary(
  label: string,
  duplicateSummary: DuplicateBatchSummary | null,
) {
  if (!duplicateSummary || duplicateSummary.matchedGroupCount === 0) return;
  console.log(
    `[Duplicate Detection] ${label}: Found ${duplicateSummary.groupCount} groups, ${duplicateSummary.matchedGroupCount} with duplicates`,
  );
}

function toDuplicateListingInput(
  listing: BotAdapterListing,
): DuplicateListingInput {
  return {
    id: listing.external_id || createListingExternalId(listing.url),
    title: listing.title,
    price: listing.price,
    source: listing.source,
    condition: listing.condition,
  };
}

function resolveListingImageUrl(listing: BotAdapterListing) {
  return listing.image_url ?? listing.image_urls[0] ?? null;
}

function resolveListingExternalId(listing: BotAdapterListing) {
  return listing.external_id || createListingExternalId(listing.url);
}

function buildListingPayloadBase(
  listing: BotAdapterListing,
  productId: string | number,
) {
  return {
    product_id: productId,
    title: listing.title,
    price: listing.price,
    city: listing.city,
    source: listing.source,
    url: listing.url,
    condition: listing.condition,
    image_url: resolveListingImageUrl(listing),
  };
}

function buildRpcListingPayload(
  listing: BotAdapterListing,
  productId: string | number,
) {
  return {
    ...buildListingPayloadBase(listing, productId),
    external_id: resolveListingExternalId(listing),
    description: listing.description ?? null,
    old_price: listing.old_price ?? null,
    brand: listing.brand ?? null,
    model: listing.model ?? null,
    storage: listing.storage ?? null,
    ram: listing.ram ?? null,
    color: listing.color ?? null,
    warranty: listing.warranty ?? null,
    seller_name: listing.seller_name ?? null,
    source_type: listing.source_type ?? null,
    category: listing.category ?? null,
    status: normalizeSyncStatus(listing.status),
    raw_payload: listing,
  };
}

function buildLegacyListingPayload(
  listing: BotAdapterListing,
  productId: string | number,
) {
  return {
    ...buildListingPayloadBase(listing, productId),
    status: normalizeSyncStatus(listing.status),
  };
}

async function resolveMatchedProductIds(
  supabase: SupabaseClient,
  listings: BotAdapterListing[],
  productIds: Map<string, string | number>,
  errors: string[],
) {
  const matchedIds = new Set<string>();
  for (const listing of listings) {
    try {
      const product = await findOrCreateMatchedProduct({
        supabase,
        title: listing.title,
        productName: listing.product_name,
        category: listing.category,
        source: listing.source,
      });
      productIds.set(listing.product_name, product.id);
      matchedIds.add(String(product.id));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Ürün eşleştirilemedi.";
      console.error("Listing sync product match failed:", error);
      errors.push(`${listing.product_name}: ${message}`);
    }
  }
  return matchedIds.size;
}
