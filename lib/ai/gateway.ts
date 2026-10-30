// The single entry point every AI feature goes through. It applies, in order:
// master switch, per-feature switch, daily request budget, API key, the call
// itself (with timeout) and the usage log. Features never talk to Gemini
// directly, so cost controls cannot be bypassed.
//
// The result type forces callers to handle "no AI answer": the deterministic
// pipeline always remains the fallback.

import "server-only";

import { MAX_INPUT_CHARS, MAX_OUTPUT_TOKENS, type AiFeature, type AiLogFeature } from "@/lib/ai/config";
import { callGemini, type GeminiSchema } from "@/lib/ai/gemini-client";
import { getAiRuntimeSettings, resolveApiKey } from "@/lib/ai/settings";
import { countRecentCalls, recordAiCall } from "@/lib/ai/usage";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type AiSkipReason = "disabled" | "feature_off" | "no_key" | "budget" | "unavailable" | "paused";

export type AiTaskResult =
  | { status: "ok"; json: unknown; model: string; latencyMs: number }
  | { status: "skipped"; reason: AiSkipReason }
  | { status: "error"; error: string };

export type AiTaskInput = {
  feature: AiFeature;
  systemInstruction: string;
  /** Untrusted text (a query or a title); it is clipped before being sent. */
  userText: string;
  responseSchema: GeminiSchema;
};

/**
 * Circuit breaker. A refusal that will not fix itself (bad key, no access,
 * unknown model) pauses AI calls briefly instead of retrying on every search.
 * Per server instance; the admin connection test clears it.
 */
const PAUSE_MS = 5 * 60 * 1000;
const PERMANENT_FAILURE_STATUSES = new Set([400, 401, 403, 404]);
let pausedUntil = 0;

/** Test hook: lets unit tests start from a clean breaker. */
export function resetAiCircuitBreaker() {
  pausedUntil = 0;
}

export function clipInput(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_INPUT_CHARS);
}

export async function runAiTask(task: AiTaskInput): Promise<AiTaskResult> {
  const settings = await getAiRuntimeSettings();
  if (!settings.enabled) return { status: "skipped", reason: "disabled" };
  if (Date.now() < pausedUntil) return { status: "skipped", reason: "paused" };
  if (!settings.features[task.feature]) return { status: "skipped", reason: "feature_off" };
  if (!settings.hasKey) return { status: "skipped", reason: "no_key" };

  const admin = createSupabaseAdminClient();
  if (!admin) return { status: "skipped", reason: "unavailable" };

  if ((await countRecentCalls(admin)) >= settings.dailyRequestLimit) {
    return { status: "skipped", reason: "budget" };
  }

  const key = await resolveApiKey(admin);
  if (!key.ok) {
    return key.reason === "none"
      ? { status: "skipped", reason: "no_key" }
      : { status: "error", error: key.message };
  }

  const userText = clipInput(task.userText);
  const result = await callGemini({
    apiKey: key.key,
    model: settings.model,
    systemInstruction: task.systemInstruction,
    userText,
    responseSchema: task.responseSchema,
    maxOutputTokens: MAX_OUTPUT_TOKENS[task.feature],
    timeoutMs: settings.timeoutMs,
  });

  await recordAiCall(admin, {
    feature: task.feature,
    model: settings.model,
    ok: result.ok,
    error: result.ok ? null : result.error,
    latencyMs: result.latencyMs,
    promptTokens: result.ok ? result.usage.promptTokens : null,
    outputTokens: result.ok ? result.usage.outputTokens : null,
    input: userText,
  });

  if (!result.ok) {
    if (result.status !== null && PERMANENT_FAILURE_STATUSES.has(result.status)) pausedUntil = Date.now() + PAUSE_MS;
    return { status: "error", error: result.error };
  }
  return { status: "ok", json: result.json, model: settings.model, latencyMs: result.latencyMs };
}

/** Connection check for the admin panel: ignores switches and budget, still logged. */
export async function pingGemini(): Promise<{ ok: true; model: string; latencyMs: number } | { ok: false; error: string }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "Supabase bağlantısı yapılandırılmamış." };

  const settings = await getAiRuntimeSettings();
  const key = await resolveApiKey(admin);
  if (!key.ok) return { ok: false, error: key.message };

  const feature: AiLogFeature = "test";
  const result = await callGemini({
    apiKey: key.key,
    model: settings.model,
    systemInstruction: "Kısa cevap ver.",
    userText: "Sadece 'tamam' yaz.",
    maxOutputTokens: MAX_OUTPUT_TOKENS.test,
    timeoutMs: settings.timeoutMs,
  });

  await recordAiCall(admin, {
    feature,
    model: settings.model,
    ok: result.ok,
    error: result.ok ? null : result.error,
    latencyMs: result.latencyMs,
    promptTokens: result.ok ? result.usage.promptTokens : null,
    outputTokens: result.ok ? result.usage.outputTokens : null,
    input: "bağlantı testi",
  });

  if (result.ok) pausedUntil = 0;
  return result.ok
    ? { ok: true, model: settings.model, latencyMs: result.latencyMs }
    : { ok: false, error: result.error };
}
