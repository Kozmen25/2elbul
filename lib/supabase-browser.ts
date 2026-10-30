"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { getSupabaseConfig } from "@/lib/supabase-config";

export function createSupabaseBrowserClient() {
  const config = getSupabaseConfig();
  if (!config) return null;

  return createBrowserClient<Database>(config.url, config.anonKey);
}
