// Shared Supabase admin client for one-off CLI scripts.
// Credentials come from .env.local — never hardcode keys in scripts.
//
// Usage: npx tsx --env-file=.env.local scripts/<name>.ts

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "../lib/supabase-admin";

export function requireScriptAdminClient(): SupabaseClient {
  const client = createSupabaseAdminClient();
  if (!client) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. " +
        "Run with: npx tsx --env-file=.env.local scripts/<name>.ts",
    );
  }
  return client;
}
