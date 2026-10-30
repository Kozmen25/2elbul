import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { LOG_PREVIEW_CHARS, RATE_WINDOW_MS, type AiLogFeature } from "@/lib/ai/config";
import type { Database } from "@/lib/database.types";

type AdminClient = SupabaseClient<Database>;

export type AiLogEntry = {
  feature: AiLogFeature;
  model: string;
  ok: boolean;
  error: string | null;
  latencyMs: number | null;
  promptTokens: number | null;
  outputTokens: number | null;
  input: string;
};

export async function recordAiCall(admin: AdminClient, entry: AiLogEntry): Promise<void> {
  const { error } = await admin.from("ai_logs").insert({
    feature: entry.feature,
    model: entry.model,
    ok: entry.ok,
    error: entry.error,
    latency_ms: entry.latencyMs,
    prompt_tokens: entry.promptTokens,
    output_tokens: entry.outputTokens,
    input_preview: entry.input.slice(0, LOG_PREVIEW_CHARS),
  });
  if (error) console.error("AI log insert failed:", error);
}

/** Calls made in the rolling window; used against the daily request limit. */
export async function countRecentCalls(admin: AdminClient, now = Date.now()): Promise<number> {
  const since = new Date(now - RATE_WINDOW_MS).toISOString();
  const { count, error } = await admin
    .from("ai_logs")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);
  if (error) {
    console.error("AI usage count failed:", error);
    // Unknown usage must not become unlimited spend: treat it as "limit reached".
    return Number.POSITIVE_INFINITY;
  }
  return count ?? 0;
}
