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

  // Phase 1: Batch-resolve all product matches
  const inputs: BatchMatcherInput[] = normalizedListings.map(({ listing }) => ({
    title: listing.title,
    productName: listing.productName,
    category: listing.category,
    source,
  }));

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
          product_id: matchedProduct.id,
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
          raw_payload: listing.rawPayload,
        },
        { onConflict: "source,external_id" },
      );

      if (listingError) throw new Error(listingError.message);
      result.imported += 1;

      // Analyze product type (non-fatal — engine failure doesn't roll back listing)
      try {
        const understanding = analyzeProduct({
          title: listing.title,
          price: listing.price,
          sourceId: listing.sourceId ? String(listing.sourceId) : undefined,
          marketplaceCategory: listing.category ?? undefined,
        });

        // Store product understanding result in products.attributes JSONB
        const { error: attrError } = await supabase
          .from("products")
          .update({ attributes: understanding })
          .eq("id", matchedProduct.id);

        if (attrError) {
          console.warn(
            `[Import] Failed to update attributes for product ${matchedProduct.id}: ${attrError.message}`,
          );
        }
      } catch (engineError) {
        console.warn(
          `[Import] Product Understanding Engine failed for "${listing.title}": ${engineError instanceof Error ? engineError.message : "Unknown error"}`,
        );
      }
    } catch (error) {
      result.failed += 1;
      result.errors.push({
        index,
        message: error instanceof Error ? error.message : "Bilinmeyen hata",
      });
    }
  }

  return result;
}
