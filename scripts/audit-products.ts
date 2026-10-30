import { requireScriptAdminClient } from "./script-client";

const sb = requireScriptAdminClient();

async function main() {
  console.log("=== AUDIT START ===");

  const r1 = await sb.from("products").select("id,slug").limit(1);
  console.log("id:", r1.error ? "ERR " + r1.error.message?.slice(0, 60) : "OK");

  const r2 = await sb.from("products").select("category").limit(1);
  console.log("category:", r2.error ? r2.error.message?.slice(0, 60) || "ERR" : "OK");

  const r3 = await sb.from("products").select("normalized_key").limit(1);
  console.log("normalized_key:", r3.error ? r3.error.message?.slice(0, 60) || "ERR" : "OK");

  const c = await sb.from("products").select("id", { count: "exact", head: true });
  console.log("row_count:", c.count ?? "error");

  const s = await sb.from("products").select("*").limit(3);
  if (s.data && s.data.length > 0) {
    console.log("columns:", Object.keys(s.data[0]).join(", "));
    for (const row of s.data) {
      console.log("  id=" + row.id + " name=" + JSON.stringify(row.name) + " slug=" + JSON.stringify(row.slug));
    }
  }

  console.log("=== AUDIT END ===");
}

main().catch((e) => console.error("FATAL:", e.message));
