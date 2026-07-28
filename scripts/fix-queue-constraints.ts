import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ozbzxhhorhrslpeccgsl.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96Ynp4aGhvcmhyc2xwZWNjZ3NsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTI4NTcwNSwiZXhwIjoyMDk2ODYxNzA1fQ.f7F1NyPgIPcabcyKEffZqoeZ3yhdzMQVVXBVw_oujXs";

async function query(sql: string, label: string) {
  console.log(`\n--- ${label} ---`);
  const res = await fetch(`${SUPABASE_URL}/pg-meta/default/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  console.log(`  ${res.status}: ${text.slice(0, 500)}`);
  if (!res.ok) throw new Error(`${label} failed: ${text.slice(0, 200)}`);
  try { return JSON.parse(text); } catch { return text; }
}

async function main() {
  // Step 1: Read current constraints
  const bq = await query(
    "SELECT conname, pg_get_constraintdef(con.oid) as def FROM pg_constraint con WHERE con.conrelid = 'bot_queue'::regclass AND con.contype = 'c'",
    "bot_queue current constraint"
  );
  const sd = await query(
    "SELECT conname, pg_get_constraintdef(con.oid) as def FROM pg_constraint con WHERE con.conrelid = 'search_demands'::regclass AND con.contype = 'c'",
    "search_demands current constraint"
  );

  // Step 2: Drop old constraints, add new ones
  await query(
    "ALTER TABLE bot_queue DROP CONSTRAINT IF EXISTS bot_queue_status_check",
    "Drop bot_queue constraint"
  );
  await query(
    "ALTER TABLE bot_queue ADD CONSTRAINT bot_queue_status_check CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'no_results'::text]))",
    "Add bot_queue constraint"
  );

  await query(
    "ALTER TABLE search_demands DROP CONSTRAINT IF EXISTS search_demands_status_check",
    "Drop search_demands constraint"
  );
  await query(
    "ALTER TABLE search_demands ADD CONSTRAINT search_demands_status_check CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'no_results'::text, 'queued'::text, 'active'::text]))",
    "Add search_demands constraint"
  );

  // Step 3: Verify constraints
  await query(
    "SELECT conname, pg_get_constraintdef(con.oid) as def FROM pg_constraint con WHERE con.conrelid = 'bot_queue'::regclass AND con.contype = 'c'",
    "Verify bot_queue constraint"
  );
  await query(
    "SELECT conname, pg_get_constraintdef(con.oid) as def FROM pg_constraint con WHERE con.conrelid = 'search_demands'::regclass AND con.contype = 'c'",
    "Verify search_demands constraint"
  );

  console.log("\n=== DONE ===");
}
main().catch((e) => console.error("FATAL:", e));
