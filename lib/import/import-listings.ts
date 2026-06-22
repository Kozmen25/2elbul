import { importAdapters } from "@/lib/import/adapters";
import type {
  ImportResult,
  ImportSource,
  RawImportListing,
} from "@/lib/import/types";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function importListings(
  source: ImportSource,
  records: RawImportListing[],
): Promise<ImportResult> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new Error("Supabase admin bağlantısı yapılandırılmamış.");
  }

  const adapter = importAdapters[source];
  const result: ImportResult = { imported: 0, failed: 0, errors: [] };

  for (const [index, record] of records.entries()) {
    try {
      const listing = adapter.normalize(record);
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

      const { error: listingError } = await supabase.from("listings").upsert(
        {
          product_id: product.id,
          external_id: listing.externalId,
          title: listing.title,
          price: listing.price,
          city: listing.city,
          source: listing.source,
          url: listing.url,
          condition: listing.condition,
          image_url: listing.imageUrl,
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
