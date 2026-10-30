import { requireScriptAdminClient } from "./script-client";

const sb = requireScriptAdminClient();

async function main() {
  console.log("=== PRE-IMPORT STATE ===\n");

  const s1 = await sb.from("sources").select("id, name, slug, is_active").eq("is_active", true);
  console.log("Active sources (" + (s1.data?.length ?? 0) + "):");
  if (s1.data) for (const s of s1.data) console.log("  " + s.id + " " + s.name + " (" + s.slug + ")");

  const s2 = await sb.from("search_demands").select("id, query, source_id, status").eq("status", "active").limit(20);
  console.log("\nActive demands (" + (s2.data?.length ?? 0) + "):");
  if (s2.data) for (const d of s2.data) console.log("  demand#" + d.id + " query=" + d.query + " source_id=" + d.source_id + " status=" + d.status);

  const s3 = await sb.from("bot_queue").select("id, demand_id, query, status").limit(20);
  console.log("\nQueue (" + (s3.data?.length ?? 0) + "):");
  const pending = (s3.data ?? []).filter((q: any) => q.status === "pending");
  console.log("  Pending: " + pending.length + "/" + (s3.data?.length ?? 0));
  if (s3.data) for (const q of s3.data) console.log("  queue#" + q.id + " demand#" + q.demand_id + " q=" + q.query + " status=" + q.status);

  const s4 = await sb.from("listings").select("id", { count: "exact", head: true });
  console.log("\nListings count: " + (s4.count ?? "error"));

  const s5 = await sb.from("products").select("id", { count: "exact", head: true });
  console.log("Products count: " + (s5.count ?? "error"));

  console.log("\n=== DONE ===");
}
main().catch((e) => console.error("FATAL:", e));
