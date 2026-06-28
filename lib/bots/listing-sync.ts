import "server-only";

import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BotAdapterListing } from "@/lib/bots/types";
import { findOrCreateMatchedProduct } from "@/lib/product-matcher";

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
  errorCount: number;
  errors: string[];
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

export async function syncListingsForSource(
  supabase: SupabaseClient,
  sourceId: number,
  listings: BotAdapterListing[],
): Promise<ListingSyncResult> {
  let imported = 0;
  let updated = 0;
  let inactive = 0;
  let reactivated = 0;
  let skipped = 0;
  let errorCount = 0;
  const errors: string[] = [];

  const productNames = [
    ...new Set(listings.map((listing) => listing.product_name)),
  ];
  const { data: existingProducts, error: productLookupError } = await supabase
    .from("products")
    .select("id, name")
    .in("name", productNames);

  if (productLookupError) throw productLookupError;

  const productIds = new Map(
    (existingProducts ?? []).map((product) => [
      String(product.name),
      product.id as string | number,
    ]),
  );

  for (const productName of productNames) {
    if (productIds.has(productName)) continue;
    const { data: createdProduct, error: productInsertError } = await supabase
      .from("products")
      .insert({ name: productName })
      .select("id")
      .single();

    if (productInsertError || !createdProduct) {
      const message =
        productInsertError?.message ?? `${productName} oluşturulamadı.`;
      console.error("Listing sync product insert failed:", productInsertError);
      errors.push(`${productName}: ${message}`);
      continue;
    }
    productIds.set(productName, createdProduct.id);
  }

  await applyMatchedProductIds(supabase, listings, productIds, errors);

  const payload = [];
  for (const listing of listings) {
    const productId = productIds.get(listing.product_name);
    if (!productId) {
      errorCount += 1;
      errors.push(`${listing.title}: ürün kimliği bulunamadı.`);
      continue;
    }

    payload.push({
      external_id: listing.external_id || createListingExternalId(listing.url),
      product_id: productId,
      title: listing.title,
      price: listing.price,
      city: listing.city,
      source: listing.source,
      url: listing.url,
      condition: listing.condition,
      image_url: listing.image_url ?? listing.image_urls[0] ?? null,
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
    });
  }

  if (!payload.length) {
    return {
      imported,
      updated,
      inactive,
      reactivated,
      skipped,
      errorCount,
      errors,
    };
  }

  const { data, error } = await supabase.rpc("sync_source_listings", {
    p_source_id: sourceId,
    p_items: payload,
  });

  if (error) throw error;

  const result = (data ?? {}) as SyncRpcResult;
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
    errorCount,
    errors,
  };
}

export async function insertListingsLegacy(
  supabase: SupabaseClient,
  listings: BotAdapterListing[],
): Promise<ListingSyncResult> {
  let imported = 0;
  let skipped = 0;
  let errorCount = 0;
  const errors: string[] = [];

  const productNames = [
    ...new Set(listings.map((listing) => listing.product_name)),
  ];
  const { data: existingProducts, error: productLookupError } = await supabase
    .from("products")
    .select("id, name")
    .in("name", productNames);

  if (productLookupError) throw productLookupError;

  const productIds = new Map(
    (existingProducts ?? []).map((product) => [
      String(product.name),
      product.id as string | number,
    ]),
  );

  for (const productName of productNames) {
    if (productIds.has(productName)) continue;
    const { data: createdProduct, error: productInsertError } = await supabase
      .from("products")
      .insert({ name: productName })
      .select("id")
      .single();

    if (productInsertError || !createdProduct) {
      errors.push(
        `${productName}: ${productInsertError?.message ?? "oluşturulamadı."}`,
      );
      continue;
    }
    productIds.set(productName, createdProduct.id);
  }

  await applyMatchedProductIds(supabase, listings, productIds, errors);

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

    const productId = productIds.get(listing.product_name);
    if (!productId) {
      errorCount += 1;
      errors.push(`${listing.title}: ürün kimliği bulunamadı.`);
      continue;
    }

    const status =
      listing.status === "pending" ? "pending" : normalizeSyncStatus(listing.status);
    const { error: listingInsertError } = await supabase.from("listings").insert({
      product_id: productId,
      title: listing.title,
      price: listing.price,
      city: listing.city,
      source: listing.source,
      url: listing.url,
      condition: listing.condition,
      image_url: listing.image_url ?? listing.image_urls[0] ?? null,
      status,
    });

    if (listingInsertError) {
      errorCount += 1;
      errors.push(`${listing.title}: ${listingInsertError.message}`);
      continue;
    }
    imported += 1;
  }

  return {
    imported,
    updated: 0,
    inactive: 0,
    reactivated: 0,
    skipped,
    errorCount,
    errors,
  };
}

async function applyMatchedProductIds(
  supabase: SupabaseClient,
  listings: BotAdapterListing[],
  productIds: Map<string, string | number>,
  errors: string[],
) {
  for (const listing of listings) {
    try {
      const product = await findOrCreateMatchedProduct({
        supabase,
        title: listing.title,
        productName: listing.product_name,
        category: listing.category,
      });
      productIds.set(listing.product_name, product.id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Ürün eşleştirilemedi.";
      console.error("Listing sync product match failed:", error);
      errors.push(`${listing.product_name}: ${message}`);
    }
  }
}
