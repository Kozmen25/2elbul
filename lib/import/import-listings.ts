import { importAdapters } from "@/lib/import/adapters";
import type {
  ImportResult,
  ImportSource,
  RawImportListing,
} from "@/lib/import/types";
import {
  batchFindOrCreateMatchedProducts,
  findOrCreateMatchedProduct,
  groupListingDuplicatesByKey,
  summarizeDuplicateGroups,
  type BatchMatcherInput,
} from "@/lib/product-matcher";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getGlobalContext } from "@/lib/taxonomy/context";
import { analyzeProduct } from "@/lib/product-understanding";
import { extractBrand } from "@/lib/normalization";
import type { Json } from "@/lib/database.types";
import { toBigintId } from "@/lib/supabase-ids";
import { regroupProducts } from "@/lib/duplicate-engine/group-repository";

export async function importListings(
  source: ImportSource,
  records: RawImportListing[],
): Promise<ImportResult> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new Error("Supabase admin bağlantısı yapılandırılmamış.");
  }

  const resolver = getGlobalContext().getResolver();

  const adapter = importAdapters[source];
  const result: ImportResult = {
    imported: 0,
    failed: 0,
    errors: [],
    duplicateSummary: null,
  };

  const normalizedListings = records
    .map((record, index) => {
      try {
        return {
          index,
          listing: adapter.normalize(record),
        };
      } catch (error) {
        result.failed += 1;
        result.errors.push({
          index,
          message: error instanceof Error ? error.message : "Normalizasyon hatası",
        });
        return null;
      }
    })
    .filter(
      (
        entry,
      ): entry is {
        index: number;
        listing: ReturnType<typeof adapter.normalize>;
      } => entry !== null,
    );

  if (normalizedListings.length > 0) {
    const duplicateGroups = groupListingDuplicatesByKey(
      normalizedListings.map((entry) => ({
        id: entry.listing.externalId || `item-${entry.index}`,
        title: entry.listing.title,
        price: entry.listing.price,
        source: entry.listing.source,
        condition: entry.listing.condition,
      })),
      70,
    );
    result.duplicateSummary = summarizeDuplicateGroups(
      duplicateGroups,
      normalizedListings.length,
      70,
    );

    if (duplicateGroups.matchedCount > 0) {
      console.log(
        `[Import Duplicate Detection] Source ${source}: ${duplicateGroups.count} groups, ${duplicateGroups.matchedCount} with duplicates`,
      );
    }
  }

  // Phase 1: Batch-resolve all product matches. Brand and price are passed
  // through so the accessory/spare-part vs primary-product classifier (and
  // its ProductType compatibility guard against cross-type merges) has the
  // signals it needs — previously omitted, which silently disabled the
  // brand-aware accessory shortcut and price-threshold checks.
  const inputs: BatchMatcherInput[] = normalizedListings.map(({ listing }) => {
    const understanding = analyzeProduct({
      title: listing.title,
      price: listing.price,
      marketplaceCategory: listing.category ?? undefined,
      brand: extractBrand(listing.title) ?? undefined,
    });
    return {
      title: listing.title,
      productName: listing.productName,
      category: listing.category,
      source,
      attributes: { productUnderstanding: understanding },
      price: listing.price,
    };
  });

  const matchedProducts = await batchFindOrCreateMatchedProducts(
    supabase,
    inputs,
    resolver,
  );

  // Phase 2: Upsert each listing with its matched product
  for (let i = 0; i < normalizedListings.length; i++) {
    const { index, listing } = normalizedListings[i];
    const matchedProduct = matchedProducts[i];

    if (!matchedProduct) {
      result.failed += 1;
      result.errors.push({
        index,
        message: "Ürün eşleştirilemedi",
      });
      continue;
    }

    try {
      const { error: listingError } = await supabase.from("listings").upsert(
        {
          product_id: toBigintId(matchedProduct.id),
          external_id: listing.externalId,
          title: listing.title,
          price: listing.price,
          city: listing.city,
          source: listing.source,
          source_id: listing.sourceId,
          url: listing.url,
          condition: listing.condition,
          image_url: listing.imageUrl,
          status: "published",
          published_at: listing.publishedAt,
          imported_at: new Date().toISOString(),
          // Parsed CSV/XLSX row; supabase-js serializes it with JSON.stringify.
          raw_payload: listing.rawPayload as Json,
        },
        { onConflict: "source,external_id" },
      );

      if (listingError) throw new Error(listingError.message);
      result.imported += 1;
      // products.attributes.productUnderstanding is set once, during the
      // Phase 1 match (see batchFindOrCreateMatchedProducts →
      // ensureProductUnderstanding), and never overwritten by a later
      // listing import — previously this block unconditionally re-ran
      // analyzeProduct() per listing and clobbered it, so a product's
      // classification (and condition) was effectively "whichever listing
      // happened to import last," not a stable, evidence-based value.
    } catch (error) {
      result.failed += 1;
      result.errors.push({
        index,
        message: error instanceof Error ? error.message : "Bilinmeyen hata",
      });
    }
  }

  // The imported listings may duplicate ones already on other platforms.
  // Best effort: the daily regroup pass repairs anything this misses.
  if (result.imported > 0) {
    try {
      await regroupProducts(
        supabase,
        matchedProducts.flatMap((product) => (product ? [product.id] : [])),
      );
    } catch (error) {
      console.error("Duplicate regroup after import failed:", error);
    }
  }

  return result;
}
