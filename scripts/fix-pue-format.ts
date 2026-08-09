/**
 * Fix PUE data format: wrap in `productUnderstanding` key.
 *
 * The backfill stored `analyzeProduct()` output as flat keys directly on
 * `attributes`, but all extractors (extractProductTypeFromAttributes,
 * hasProductUnderstanding) expect `attributes.productUnderstanding.*`.
 *
 * Usage: npx tsx scripts/fix-pue-format.ts
 */
import { createClient } from "@supabase/supabase-js";

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
  // 1. Fetch all products WHERE attributes IS NOT NULL
  console.log("[fix-pue-format] Fetching products with existing attributes...");
  const { data: products, error: fetchError } = await supabase
    .from("products")
    .select("id, name, attributes")
    .not("attributes", "is", null)
    .order("id", { ascending: true });

  if (fetchError) {
    console.error("[fix-pue-format] Fetch error:", fetchError.message);
    process.exit(1);
  }

  if (!products || products.length === 0) {
    console.log("[fix-pue-format] No products to fix. Done.");
    return;
  }

  console.log(`[fix-pue-format] Found ${products.length} products to fix.`);

  let fixCount = 0;
  let skipCount = 0;

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);

    for (const product of batch) {
      const attrs = product.attributes as Record<string, unknown>;

      // Already wrapped?
      if (attrs && typeof attrs === "object" && "productUnderstanding" in attrs) {
        skipCount++;
        continue;
      }

      // Wrap the flat PUE fields under productUnderstanding
      const wrapped = { productUnderstanding: attrs };

      const { error: updateError } = await supabase
        .from("products")
        .update({ attributes: wrapped })
        .eq("id", product.id);

      if (updateError) {
        console.warn(`[fix-pue-format] Update failed for id=${product.id}: ${updateError.message}`);
      } else {
        fixCount++;
      }
    }

    const pct = Math.min(100, Math.round(((i + batch.length) / products.length) * 100));
    console.log(`[fix-pue-format] ${Math.min(i + batch.length, products.length)}/${products.length} (${pct}%) — ${fixCount} fixed, ${skipCount} skipped`);
  }

  // 3. Verify
  console.log("\n[fix-pue-format] === VERIFICATION ===");

  // Check a sample product to confirm structure
  const { data: sample } = await supabase
    .from("products")
    .select("id, name, attributes")
    .not("attributes", "is", null)
    .limit(3);

  if (sample) {
    for (const p of sample) {
      const attrs = p.attributes as Record<string, unknown>;
      const hasWrapper = attrs && typeof attrs === "object" && "productUnderstanding" in attrs;
      const pu = attrs?.productUnderstanding as Record<string, unknown> | undefined;
      const pt = pu?.productType as { value?: unknown } | undefined;
      const typeVal = pt?.value ?? "MISSING";
      console.log(`ID=${p.id} | wrapped=${hasWrapper} | productType=${typeVal}`);
    }
  }

  // Count how many DON'T have the wrapper (should be 0)
  const { data: all } = await supabase
    .from("products")
    .select("id, attributes");

  let stillFlat = 0;
  let withWrapper = 0;
  for (const p of all ?? []) {
    const a = p.attributes as Record<string, unknown>;
    if (a && "productUnderstanding" in a) withWrapper++;
    else if (a && typeof a === "object") stillFlat++;
  }
  console.log(`\n[fix-pue-format] With wrapper: ${withWrapper}, Still flat: ${stillFlat}`);

  console.log("[fix-pue-format] Done.");
}

main().catch((err) => {
  console.error("[fix-pue-format] Unhandled error:", err);
  process.exit(1);
});
