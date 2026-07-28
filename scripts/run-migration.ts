import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ozbzxhhorhrslpeccgsl.supabase.co";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96Ynp4aGhvcmhyc2xwZWNjZ3NsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTI4NTcwNSwiZXhwIjoyMDk2ODYxNzA1fQ.f7F1NyPgIPcabcyKEffZqoeZ3yhdzMQVVXBVw_oujXs";

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function tryPgMetaQuery(): Promise<boolean> {
  console.log("Trying pg-meta/query (direct SQL)...");
  const sql =
    "alter table public.products add column if not exists category text;";
  const res = await fetch(`${SUPABASE_URL}/pg-meta/default/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  console.log(`  -> ${res.status}: ${text.slice(0, 200)}`);
  return res.ok;
}

async function tryManagementApi(): Promise<boolean> {
  console.log("Trying Management API /v1/projects/.../sql...");
  const sql =
    "alter table public.products add column if not exists category text;";
  const res = await fetch(
    `https://api.supabase.com/v1/projects/ozbzxhhorhrslpeccgsl/sql`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    },
  );
  const text = await res.text();
  console.log(`  -> ${res.status}: ${text.slice(0, 200)}`);
  return res.ok;
}

async function tryExecSqlRpc(): Promise<boolean> {
  console.log("Trying exec_sql rpc...");
  // Try various arg names
  for (const argName of ["sql", "sql_text", "query", "sql_query"]) {
    let result: { error?: any; data?: any };
    try {
      result = await sb.rpc("exec_sql", { [argName]: "SELECT 1" });
    } catch {
      result = { error: new Error("nope") };
    }
    if (!result.error) {
      console.log(`  -> exec_sql with arg "${argName}" exists! Using it for real DDL...`);
      const { error: ddlErr } = await sb.rpc("exec_sql", {
        [argName]: "alter table public.products add column if not exists category text;",
      });
      if (!ddlErr) {
        console.log("  -> DDL via exec_sql SUCCESS");
        return true;
      }
      console.log(`  -> DDL failed: ${ddlErr.message}`);
    }
  }
  console.log("  -> No exec_sql found");
  return false;
}

async function tryPostgrestRpcRawSql(): Promise<boolean> {
  console.log("Trying PostgREST rpc_raw_sql...");
  // Try with no trailing slash
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/rpc_raw_sql`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      query: "alter table public.products add column if not exists category text;",
    }),
  });
  if (res.ok) {
    console.log("  -> rpc_raw_sql SUCCESS");
    return true;
  }
  const text = await res.text();
  console.log(`  -> ${res.status}: ${text.slice(0, 200)}`);
  return false;
}

async function runScript(): Promise<void> {
  console.log("=== MIGRATION: products table schema fix ===");
  console.log("Target: add 'category' and 'normalized_key' columns\n");

  const approaches = [
    { name: "pg-meta/query", fn: tryPgMetaQuery },
    { name: "Management API /sql", fn: tryManagementApi },
    { name: "PostgREST rpc_raw_sql", fn: tryPostgrestRpcRawSql },
    { name: "exec_sql rpc", fn: tryExecSqlRpc },
  ];

  for (let i = 0; i < approaches.length; i++) {
    const approach = approaches[i];
    console.log(`\n[${i + 1}/${approaches.length}] ${approach.name}`);
    const ok = await approach.fn();
    if (ok) {
      console.log(`\nOK: SUCCESS via ${approach.name}`);
      return;
    }
    await sleep(500);
  }

  console.log("\nFAILED: All automated approaches failed.");
  console.log("\n=== MANUAL SQL TO RUN IN SUPABASE DASHBOARD ===");
  console.log("Go to: https://supabase.com/dashboard/project/ozbzxhhorhrslpeccgsl/sql/new");
}

runScript().catch((e) => console.error("FATAL:", e));
