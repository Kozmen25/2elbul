import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  "https://ozbzxhhorhrslpeccgsl.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96Ynp4aGhvcmhyc2xwZWNjZ3NsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTI4NTcwNSwiZXhwIjoyMDk2ODYxNzA1fQ.f7F1NyPgIPcabcyKEffZqoeZ3yhdzMQVVXBVw_oujXs"
);

async function main() {
  // 1. Products table overview
  const { data: productData, count: productCount } = await sb.from("products").select("id", { count: "exact", head: true });
  console.log(`=== PRODUCTS ===`);
  console.log(`Total products: ${productCount ?? 0}`);

  const { data: schemaCheck } = await sb.from("products").select("id, name, category, normalized_key").limit(5);
  console.log(`Sample products (columns): ${JSON.stringify(schemaCheck, null, 2)}`);

  const { data: categoryDist } = await sb.from("products").select("category, count:id", { count: "exact" });
  // Can't aggregate directly with REST, let me try a different approach
  const { data: allCategories } = await sb.from("products").select("category, id");
  if (allCategories) {
    const catCount: Record<string, number> = {};
    let nullCat = 0;
    for (const r of allCategories) {
      const c = r.category;
      if (c) catCount[c] = (catCount[c] ?? 0) + 1;
      else nullCat++;
    }
    console.log(`\nCategory distribution:`);
    for (const [cat, count] of Object.entries(catCount).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${cat}: ${count}`);
    }
    if (nullCat > 0) console.log(`  (null): ${nullCat}`);
  }

  const { data: allProducts } = await sb.from("products").select("id, name, category, normalized_key");
  if (allProducts) {
    // Brand distribution from product names
    const brandCount: Record<string, number> = {};
    let unknownBrand = 0;
    for (const p of allProducts) {
      const name = (p.name ?? "").toLowerCase();
      const brand = extractBrand(name);
      if (brand) brandCount[brand] = (brandCount[brand] ?? 0) + 1;
      else unknownBrand++;
    }
    console.log(`\nBrand distribution (from product names):`);
    for (const [b, c] of Object.entries(brandCount).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${b}: ${c}`);
    }
    if (unknownBrand > 0) console.log(`  (unknown): ${unknownBrand}`);

    // Missing normalized_key
    const noKey = allProducts.filter(p => !p.normalized_key).length;
    console.log(`\nProducts without normalized_key: ${noKey} / ${allProducts.length}`);

    // Missing category
    const noCat = allProducts.filter(p => !p.category).length;
    console.log(`Products without category: ${noCat} / ${allProducts.length}`);
  }

  // 2. Listings table overview
  const { data: listData, count: listCount } = await sb.from("listings").select("id", { count: "exact", head: true });
  console.log(`\n=== LISTINGS ===`);
  console.log(`Total listings: ${listCount ?? 0}`);

  const { data: allListings } = await sb.from("listings").select("id, product_id, source, status, price, city, condition, external_id").limit(5000);
  if (allListings) {
    const total = allListings.length;

    // Source distribution
    const sourceCount: Record<string, { total: number; matched: number; unmatched: number }> = {};
    for (const l of allListings) {
      const s = l.source || "(unknown)";
      if (!sourceCount[s]) sourceCount[s] = { total: 0, matched: 0, unmatched: 0 };
      sourceCount[s].total++;
      if (l.product_id) sourceCount[s].matched++;
      else sourceCount[s].unmatched++;
    }
    console.log(`\nSource distribution (sample of ${total}):`);
    for (const [src, counts] of Object.entries(sourceCount).sort((a, b) => b[1].total - a[1].total)) {
      const matchRate = counts.total > 0 ? ((counts.matched / counts.total) * 100).toFixed(1) : "0.0";
      console.log(`  ${src}: ${counts.total} total, ${counts.matched} matched, ${counts.unmatched} unmatched (${matchRate}% match rate)`);
    }

    // Status distribution
    const statusCount: Record<string, number> = {};
    for (const l of allListings) {
      const s = l.status || "(null)";
      statusCount[s] = (statusCount[s] ?? 0) + 1;
    }
    console.log(`\nStatus distribution:`);
    for (const [st, c] of Object.entries(statusCount).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${st}: ${c}`);
    }

    // Duplicate detection per source (by external_id)
    const duplicateStats: Record<string, { total: number; unique: number; duplicates: number; dupPct: string }> = {};
    const sourceGroups: Record<string, Set<string>> = {};
    for (const l of allListings) {
      const s = l.source || "(unknown)";
      if (!sourceGroups[s]) sourceGroups[s] = new Set();
      if (l.external_id) sourceGroups[s].add(l.external_id);
    }
    console.log(`\nDuplicate rate (by external_id per source):`);
    for (const [src, uniqueIds] of Object.entries(sourceGroups)) {
      const total = sourceCount[src]?.total ?? 0;
      const unique = uniqueIds.size;
      const duplicates = total - unique;
      const dupPct = total > 0 ? ((duplicates / total) * 100).toFixed(1) : "0.0";
      console.log(`  ${src}: ${total} total, ${unique} unique IDs, ${duplicates} duplicates (${dupPct}%)`);
    }

    // Condition distribution
    const condCount: Record<string, number> = {};
    for (const l of allListings) {
      const c = l.condition || "(null)";
      condCount[c] = (condCount[c] ?? 0) + 1;
    }
    console.log(`\nCondition distribution:`);
    for (const [c, cnt] of Object.entries(condCount).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${c}: ${cnt}`);
    }

    // City distribution (top 15)
    const cityCount: Record<string, number> = {};
    for (const l of allListings) {
      if (l.city) cityCount[l.city] = (cityCount[l.city] ?? 0) + 1;
    }
    console.log(`\nCity distribution (top 15):`);
    for (const [city, cnt] of Object.entries(cityCount).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
      console.log(`  ${city}: ${cnt}`);
    }

    // Price stats per source
    console.log(`\nPrice stats per source:`);
    for (const [src, counts] of Object.entries(sourceCount).sort((a, b) => b[1].total - a[1].total)) {
      const prices = allListings.filter(l => (l.source || "(unknown)") === src && l.price != null).map(l => Number(l.price));
      if (prices.length > 0) {
        prices.sort((a, b) => a - b);
        const avg = (prices.reduce((s, p) => s + p, 0) / prices.length).toFixed(0);
        const min = prices[0];
        const max = prices[prices.length - 1];
        const mid = prices[Math.floor(prices.length / 2)];
        console.log(`  ${src}: ${prices.length} with prices, avg=${avg} TL, median=${mid} TL, min=${min}, max=${max}`);
      } else {
        console.log(`  ${src}: no prices`);
      }
    }
  }
}

// Simple brand extraction mirroring the engine
function extractBrand(name: string): string | null {
  if (/(apple|iphone|ipad|macbook|airpods)/.test(name) || /\b1[1-6]\s*(pro\s*max|pro|plus|mini)\b/.test(name)) return "apple";
  if (/(samsung|galaxy)/.test(name) || /\b(?:s|a|m)\d{2}\b/.test(name)) return "samsung";
  if (/(xiaomi|redmi|poco)/.test(name)) return "xiaomi";
  if (/google/.test(name)) return "google";
  if (/huawei/.test(name)) return "huawei";
  if (/realme/.test(name)) return "realme";
  if (/oneplus/.test(name)) return "oneplus";
  if (/oppo/.test(name)) return "oppo";
  if (/vivo/.test(name)) return "vivo";
  if (/motorola/.test(name)) return "motorola";
  if (/nokia/.test(name)) return "nokia";
  if (/(sony|playstation|ps5|ps4|xperia)/.test(name)) return "sony";
  if (/(nvidia|rtx|geforce)/.test(name)) return "nvidia";
  if (/\blg\b/.test(name)) return "lg";
  if (/lenovo/.test(name)) return "lenovo";
  if (/\bhp\b/.test(name)) return "hp";
  if (/dell/.test(name)) return "dell";
  if (/asus/.test(name)) return "asus";
  if (/razer/.test(name)) return "razer";
  if (/blackberry/.test(name)) return "blackberry";
  if (/htc/.test(name)) return "htc";
  if (/honor/.test(name)) return "honor";
  if (/(msi|msı)/.test(name)) return "msi";
  if (/nothing/.test(name)) return "nothing";
  if (/omix/.test(name)) return "omix";
  return null;
}

main().catch(console.error);
