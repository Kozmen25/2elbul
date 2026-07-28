import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ozbzxhhorhrslpeccgsl.supabase.co";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96Ynp4aGhvcmhyc2xwZWNjZ3NsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTI4NTcwNSwiZXhwIjoyMDk2ODYxNzA1fQ.f7F1NyPgIPcabcyKEffZqoeZ3yhdzMQVVXBVw_oujXs";

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const SQL = `
alter table public.sources
  add column if not exists reliability_score int
  not null default 65
  check (reliability_score between 0 and 100);

update public.sources set reliability_score = 68 where slug = 'sahibinden';
update public.sources set reliability_score = 60 where slug = 'letgo';
update public.sources set reliability_score = 58 where slug = 'facebook-marketplace';
update public.sources set reliability_score = 92 where slug = 'easycep';
update public.sources set reliability_score = 90 where slug = 'getmobil';
update public.sources set reliability_score = 87 where slug = 'yenilenmis-market';
update public.sources set reliability_score = 86 where slug = 'teknosa-yenilenmis';
update public.sources set reliability_score = 85 where slug = 'hepsiburada-yenilenmis';
update public.sources set reliability_score = 84 where slug = 'mediamarkt-yenilenmis';
`;

async function tryPgMetaQuery(): Promise<boolean> {
  console.log("Trying pg-meta/query (direct SQL)...");
  const res = await fetch(`${SUPABASE_URL}/pg-meta/default/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: SQL }),
  });
  const text = await res.text();
  console.log(`  -> ${res.status}: ${text.slice(0, 300)}`);
  return res.ok;
}

async function tryManagementApi(): Promise<boolean> {
  console.log("Trying Management API /v1/projects/.../sql...");
  const res = await fetch(
    `https://api.supabase.com/v1/projects/ozbzxhhorhrslpeccgsl/sql`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: SQL }),
    },
  );
  const text = await res.text();
  console.log(`  -> ${res.status}: ${text.slice(0, 300)}`);
  return res.ok;
}

async function tryPostgrestRpcRawSql(): Promise<boolean> {
  console.log("Trying PostgREST rpc_raw_sql...");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/rpc_raw_sql`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query: SQL }),
  });
  if (res.ok) {
    console.log("  -> rpc_raw_sql SUCCESS");
    return true;
  }
  const text = await res.text();
  console.log(`  -> ${res.status}: ${text.slice(0, 300)}`);
  return false;
}

async function runScript(): Promise<void> {
  console.log("=== MIGRATION: add reliability_score to sources ===");
  console.log("SQL:", SQL.replace(/\n\s*/g, " ").slice(0, 120) + "...\n");

  const approaches = [
    { name: "pg-meta/query", fn: tryPgMetaQuery },
    { name: "Management API /sql", fn: tryManagementApi },
    { name: "PostgREST rpc_raw_sql", fn: tryPostgrestRpcRawSql },
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
  console.log("\nCopy-paste this SQL:");
  console.log(SQL);
}

runScript().catch((e) => console.error("FATAL:", e));
