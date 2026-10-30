import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export function createSupabaseClient(): SupabaseClient<Database> | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (
    !supabaseUrl ||
    !supabaseAnonKey ||
    !supabaseUrl.startsWith("https://") ||
    !supabaseUrl.includes(".supabase.co") ||
    isPlaceholder(supabaseUrl) ||
    isPlaceholder(supabaseAnonKey)
  ) {
    return null;
  }

  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function isPlaceholder(value: string) {
  const normalizedValue = value.toLocaleLowerCase("tr-TR");

  return [
    "your-project",
    "your-anon-key",
    "buraya_",
    "publishable_key",
    "supabase_url",
  ].some((placeholder) => normalizedValue.includes(placeholder));
}
