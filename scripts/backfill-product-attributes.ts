import { createClient } from "@supabase/supabase-js";
import { analyzeProduct } from "../lib/product-understanding";

const SUPABASE_URL = "https://ozbzxhhorhrslpeccgsl.supabase.co";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96Ynp4aGhvcmhyc2xwZWNjZ3NsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTI4NTcwNSwiZXhwIjoyMDk2ODYxNzA1fQ.f7F1NyPgIPcabcyKEffZqoeZ3yhdzMQVVXBVw_oujXs";

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const BATCH_SIZE = 100;
const RATE_LIMIT_MS = 500;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

interface ProductRow {
  id: number;
  name: string;
  category: string | null;
}

async function main() {
  console.log("=== PRODUCT ATTRIBUTES BACKFILL ===");
  console.log(`Batch size: ${BATCH_SIZE}, Rate limit: ${RATE_LIMIT_MS}ms\n`);

  // Step 1: Count total products needing backfill
  const { count: total, error: countError } = await sb
    .from("products")
    .select("id", { count: "exact", head: true })
    .is("attributes", null);

  if (countError) {
    console.error(`FATAL: Failed to count products: ${countError.message}`);
    process.exit(1);
  }

  if (!total || total === 0) {
    console.log("No products need backfill — all have attributes populated.");
    process.exit(0);
  }

  console.log(`Found ${total} products with NULL attributes.\n`);

  // Step 2: Process in batches
  let processed = 0;
  let successCount = 0;
  let errorCount = 0;

  while (processed < total) {
    console.log(
      `[${processed + 1}-${Math.min(processed + BATCH_SIZE, total)}/${total}] Fetching batch...`,
    );

    const { data: batch, error: fetchError } = await sb
      .from("products")
      .select("id, name, category")
      .is("attributes", null)
      .order("id", { ascending: true })
      .range(processed, processed + BATCH_SIZE - 1);

    if (fetchError) {
      console.error(`  ERROR fetching batch: ${fetchError.message}`);
      errorCount += BATCH_SIZE;
      processed += BATCH_SIZE;
      continue;
    }

    if (!batch || batch.length === 0) break;

    for (const product of batch) {
      try {
        const understanding = analyzeProduct({
          title: product.name,
          marketplaceCategory: product.category ?? undefined,
        });

        const { error: updateError } = await sb
          .from("products")
          .update({ attributes: { productUnderstanding: understanding } })
          .eq("id", product.id);

        if (updateError) {
          console.error(`  ERROR product #${product.id} ("${product.name.substring(0, 50)}"): ${updateError.message}`);
          errorCount++;
        } else {
          successCount++;
        }
      } catch (engineError) {
        console.error(
          `  ENGINE ERROR product #${product.id} ("${product.name.substring(0, 50)}"): ${engineError instanceof Error ? engineError.message : "Unknown error"}`,
        );
        errorCount++;
      }
    }

    processed += batch.length;
    console.log(`  Progress: ${successCount} success, ${errorCount} errors (${processed}/${total})`);

    if (processed < total) {
      await sleep(RATE_LIMIT_MS);
    }
  }

  console.log(`\n=== BACKFILL COMPLETE ===`);
  console.log(`Processed: ${processed}, Success: ${successCount}, Errors: ${errorCount}`);
}

main().catch((e) => console.error("FATAL:", e));
