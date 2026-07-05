import { importAdapters } from "@/lib/import/adapters";
import type {
  ImportResult,
  ImportSource,
  RawImportListing,
} from "@/lib/import/types";
import {
  findOrCreateMatchedProduct,
  groupListingDuplicates,
  summarizeDuplicateGroups,
} from "@/lib/product-matcher";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getGlobalContext } from "@/lib/taxonomy/context";

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
    .filter((x) => x !== null) as Array<{ index: number; listing: ReturnType<typeof adapter.normalize> }>;

  if (normalizedListings.length > 0) {
    const duplicateGroups = groupListingDuplicates(
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

  for (const { index, listing } of normalizedListings) {
    try {
      const { data: product, error: productError } = await supabase
        .from("products")
        .upsert(
          {
            name: listing.productName,
            category: listing.category,
          },
          { onConflict: "name" },
        )
        .select("id")
        .single();

      if (productError || !product) {
        throw new Error(productError?.message ?? "Ürün oluşturulamadı.");
      }

      const matchedProduct = await findOrCreateMatchedProduct({
        supabase,
        title: listing.title,
        productName: listing.productName,
        category: listing.category,
        resolver,
      });

      const { error: listingError } = await supabase.from("listings").upsert(
        {
          product_id: matchedProduct.id,
          external_id: listing.externalId,
          title: listing.title,
          price: listing.price,
          city: listing.city,
          source: listing.source,
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
