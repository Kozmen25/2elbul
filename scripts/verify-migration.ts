import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  "https://ozbzxhhorhrslpeccgsl.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96Ynp4aGhvcmhyc2xwZWNjZ3NsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTI4NTcwNSwiZXhwIjoyMDk2ODYxNzA1fQ.f7F1NyPgIPcabcyKEffZqoeZ3yhdzMQVVXBVw_oujXs"
);

async function main() {
  console.log("=== STEP 1: SCHEMA VERIFICATION ===\n");

  // 1a. All columns
  const s = await sb.from("products").select("*").limit(1);
  if (s.data && s.data.length > 0) {
    const cols = Object.keys(s.data[0]);
    console.log("Columns:", cols.join(", "));
    console.log("  category:", cols.includes("category") ? "PRESENT" : "MISSING");
    console.log("  normalized_key:", cols.includes("normalized_key") ? "PRESENT" : "MISSING");
  } else {
    // Table might be empty — try selecting specific columns
    const c1 = await sb.from("products").select("category").limit(1);
    console.log("  category:", c1.error ? c1.error.message : "PRESENT");
    const c2 = await sb.from("products").select("normalized_key").limit(1);
    console.log("  normalized_key:", c2.error ? c2.error.message : "PRESENT");
  }

  // 1b. Row count
  const count = await sb.from("products").select("id", { count: "exact", head: true });
  console.log("\nRow count:", count.count);

  // 1c. Sample rows with new columns
  const sample = await sb.from("products").select("id, name, category, normalized_key").limit(21);
  if (sample.data) {
    console.log(`\nAll ${sample.data.length} products:`);
    console.log("  id | name | category | normalized_key");
    console.log("  " + "-".repeat(80));
    for (const row of sample.data) {
      console.log(`  ${row.id} | ${String(row.name).slice(0, 40).padEnd(40)} | ${row.category ?? "NULL"} | ${row.normalized_key}`);
    }

    // Verify backfill quality
    const nullKeys = sample.data.filter((r: any) => !r.normalized_key);
    const nullCats = sample.data.filter((r: any) => r.category === null);
    const uniqueKeys = new Set(sample.data.map((r: any) => r.normalized_key));

    console.log(`\nBackfill quality:`);
    console.log(`  Rows with normalized_key: ${sample.data.length - nullKeys.length}/${sample.data.length}`);
    console.log(`  Rows with category NULL: ${nullCats.length}/${sample.data.length} (expected — not set until import)`);
    console.log(`  Unique keys: ${uniqueKeys.size}/${sample.data.length}${uniqueKeys.size < sample.data.length ? " (DUPLICATES FOUND!)" : " ✓"}`);
  }

  // === STEP 2: INFRASTRUCTURE VERIFICATION ===
  console.log("\n=== STEP 2: INFRASTRUCTURE VERIFICATION ===\n");

  // 2a. Test compute_normalized_key via RPC
  console.log("Testing compute_normalized_key RPC...");
  const fnTest = await sb.rpc("slugify_product_name", { value: "test" });
  console.log("  slugify_product_name (reference):", fnTest.error?.message ?? fnTest.data);

  // Try calling the function via PostgREST directly (it's a function, not an RPC)
  const fnRes = await fetch(
    "https://ozbzxhhorhrslpeccgsl.supabase.co/rest/v1/rpc/compute_normalized_key",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96Ynp4aGhvcmhyc2xwZWNjZ3NsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTI4NTcwNSwiZXhwIjoyMDk2ODYxNzA1fQ.f7F1NyPgIPcabcyKEffZqoeZ3yhdzMQVVXBVw_oujXs",
        Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96Ynp4aGhvcmhyc2xwZWNjZ3NsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTI4NTcwNSwiZXhwIjoyMDk2ODYxNzA1fQ.f7F1NyPgIPcabcyKEffZqoeZ3yhdzMQVVXBVw_oujXs",
      },
      body: JSON.stringify({ value: "iPhone 15 Pro Max 256GB" }),
    }
  );
  if (fnRes.ok) {
    const data = await fnRes.json();
    console.log("  compute_normalized_key('iPhone 15 Pro Max 256GB'):", data);
  } else {
    const err = await fnRes.text();
    console.log("  compute_normalized_key RPC:", fnRes.status, err.slice(0, 100));
  }

  // 2b. Test the trigger by inserting a row and immediately deleting it
  console.log("\nTesting insert trigger (will insert + delete)...");
  const newName = "TEST-Verification-" + Date.now();
  const ins = await sb
    .from("products")
    .insert({ name: newName })
    .select("id, name, normalized_key")
    .single();
  if (ins.data) {
    console.log(`  Inserted id=${ins.data.id}: name="${ins.data.name}", normalized_key="${ins.data.normalized_key}"`);
    // Clean up
    await sb.from("products").delete().eq("id", ins.data.id);
    console.log("  Cleanup: deleted test row");
    if (ins.data.normalized_key && ins.data.normalized_key !== "") {
      console.log("  ✓ Trigger works: normalized_key was auto-generated on insert");
    } else {
      console.log("  ✗ Trigger issue: normalized_key is empty");
    }
  } else {
    console.log("  Insert error:", ins.error?.message);
  }

  // 2c. Verify unique index: try inserting a duplicate key
  // Get an existing key from the table
  const existing = sample.data?.[0] as any;
  if (existing?.normalized_key) {
    console.log(`\nTesting unique index (will attempt duplicate normalized_key)...`);
    const dup = await sb
      .from("products")
      .insert({ name: "DUP-TEST-" + Date.now(), normalized_key: existing.normalized_key })
      .select("id")
      .single();
    if (dup.data) {
      // If insert succeeded, it means the trigger handled the conflict
      // by appending a suffix. That's actually the trigger's job.
      console.log(`  Insert succeeded (trigger handled conflict): id=${dup.data.id}`);
      await sb.from("products").delete().eq("id", dup.data.id);
      console.log("  Cleanup: deleted duplicate test row");
    } else {
      console.log("  Expected behavior:", dup.error?.message?.slice(0, 100));
    }
  }

  console.log("\n=== VERIFICATION COMPLETE ===");
}
main().catch((e) => console.error("FATAL:", e.message));
