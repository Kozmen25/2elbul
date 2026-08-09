/**
 * One-shot production backfill: populate products.attributes with PUE data.
 *
 * Usage: npx tsx scripts/backfill-pue.ts
 *
 * Reads all products from production where attributes IS NULL,
 * calls analyzeProduct() for each, and updates the row.
 * Safe to re-run — skips products that already have attributes.
 */
import { createClient } from "@supabase/supabase-js";
import { analyzeProduct } from "../lib/product-understanding";

const SUPABASE_URL = "https://ozbzxhhorhrslpeccgsl.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY env var");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const BATCH_SIZE = 10;

async function main() {
  // 1. Fetch all products where attributes IS NULL, ordered by id
  console.log("[backfill-pue] Fetching products with null attributes...");
  const { data: products, error: fetchError } = await supabase
    .from("products")
    .select("id, name, category")
    .is("attributes", null)
    .order("id", { ascending: true });

  if (fetchError) {
    console.error("[backfill-pue] Fetch error:", fetchError.message);
    process.exit(1);
  }

  if (!products || products.length === 0) {
    console.log("[backfill-pue] No products need backfill. Done.");
    return;
  }

  console.log(`[backfill-pue] Found ${products.length} products to backfill.`);

  let successCount = 0;
  let failCount = 0;

  // Process in batches
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    const batchResults: { id: number; attributes: unknown }[] = [];

    for (const product of batch) {
      const title = String(product.name ?? "");
      const category = product.category ?? undefined;

      try {
        const understanding = analyzeProduct({
          title,
          marketplaceCategory: category,
        });
        batchResults.push({ id: product.id, attributes: { productUnderstanding: understanding } });
      } catch (err) {
        console.warn(
          `[backfill-pue] analyzeProduct failed for id=${product.id} name="${title}": ${err instanceof Error ? err.message : String(err)}`,
        );
        failCount++;
      }
    }

    if (batchResults.length === 0) continue;

    // Batch update
    for (const result of batchResults) {
      const { error: updateError } = await supabase
        .from("products")
        .update({ attributes: result.attributes })
        .eq("id", result.id);

      if (updateError) {
        console.warn(
          `[backfill-pue] Update failed for id=${result.id}: ${updateError.message}`,
        );
        failCount++;
      } else {
        successCount++;
      }
    }

    const pct = Math.min(100, Math.round(((i + batch.length) / products.length) * 100));
    console.log(
      `[backfill-pue] ${Math.min(i + batch.length, products.length)}/${products.length} (${pct}%) — ${successCount} ok, ${failCount} fail`,
    );
  }

  // 3. Final verification
  console.log("\n[backfill-pue] === VERIFICATION ===");
  const { count: remainingNull, error: countError } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .is("attributes", null);

  if (countError) {
    console.error("[backfill-pue] Verification count error:", countError.message);
  } else {
    console.log(`[backfill-pue] Remaining null attributes: ${remainingNull}`);
  }

  const { count: totalProducts } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true });

  console.log(`[backfill-pue] Total products: ${totalProducts}`);
  console.log(`[backfill-pue] Backfilled: ${successCount}`);
  console.log(`[backfill-pue] Failed: ${failCount}`);
  console.log("[backfill-pue] Done.");
}

main().catch((err) => {
  console.error("[backfill-pue] Unhandled error:", err);
  process.exit(1);
});
