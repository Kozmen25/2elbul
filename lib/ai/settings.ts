// Reads and writes the AI settings row (ai_settings, id = 1).
// Service-role only. The API key is stored encrypted (lib/email/crypto.ts);
// the panel only ever receives a masked hint, never the key itself.

import "server-only";

import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AI_LIMITS, DEFAULT_MODEL, GEMINI_KEY_ENV, type AiFeature } from "@/lib/ai/config";
import { validateAiSettingsInput, type AiSettingsErrors, type AiSettingsInput } from "@/lib/ai/settings-validation";
import { CACHE_SECONDS, CACHE_TAGS } from "@/lib/cache-policy";
import type { Database } from "@/lib/database.types";
import { decryptSecret, encryptSecret, getEncryptionKey } from "@/lib/email/crypto";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type AdminClient = SupabaseClient<Database>;
type SettingsRow = Database["public"]["Tables"]["ai_settings"]["Row"];

export type AiKeySource = "panel" | "env" | "none";

/** Non-secret runtime settings; safe to cache and to pass to client code. */
export type AiRuntimeSettings = {
  enabled: boolean;
  model: string;
  features: Record<AiFeature, boolean>;
  minConfidence: number;
  dailyRequestLimit: number;
  timeoutMs: number;
  hasKey: boolean;
};

/** What the admin page may see: everything except the key itself. */
export type AiSettingsView = AiRuntimeSettings & {
  keySource: AiKeySource;
  /** Last four characters of the active key, for recognition ("••••T6PA"). */
  keyHint: string | null;
  keyLabel: string;
  projectName: string;
  projectNumber: string;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  lastTestError: string | null;
  updatedAt: string | null;
  encryptionKeyConfigured: boolean;
};

export const KEY_MISSING_MESSAGE =
  "EMAIL_SETTINGS_ENCRYPTION_KEY ortam değişkeni tanımlı değil ya da geçersiz; API anahtarı güvenli saklanamaz.";

const KEY_DECRYPT_MESSAGE =
  "Kayıtlı API anahtarı çözülemedi. Şifreleme anahtarı değişmiş olabilir; anahtarı panelden yeniden kaydedin.";

const DEFAULT_RUNTIME: AiRuntimeSettings = {
  enabled: false,
  model: DEFAULT_MODEL,
  features: { search: true, classification: true, matching: true },
  minConfidence: AI_LIMITS.minConfidence.default,
  dailyRequestLimit: AI_LIMITS.dailyRequests.default,
  timeoutMs: AI_LIMITS.timeoutMs.default,
  hasKey: false,
};

function envApiKey(): string | null {
  return process.env[GEMINI_KEY_ENV]?.trim() || null;
}

async function loadRow(admin: AdminClient): Promise<SettingsRow | null> {
  const { data, error } = await admin.from("ai_settings").select("*").eq("id", 1).maybeSingle();
  if (error) {
    console.error("AI settings query failed:", error);
    return null;
  }
  return data;
}

function toRuntime(row: SettingsRow | null): AiRuntimeSettings {
  if (!row) return { ...DEFAULT_RUNTIME, hasKey: envApiKey() !== null };
  return {
    enabled: row.enabled,
    model: row.model || DEFAULT_MODEL,
    features: {
      search: row.feature_search,
      classification: row.feature_classification,
      matching: row.feature_matching,
    },
    minConfidence: Number(row.min_confidence),
    dailyRequestLimit: row.daily_request_limit,
    timeoutMs: row.timeout_ms,
    hasKey: Boolean(row.api_key_encrypted) || envApiKey() !== null,
  };
}

// Every search request asks "is AI on?", so the non-secret part is cached and
// refreshed by the admin save action (CACHE_TAGS.aiSettings).
export const getAiRuntimeSettings = unstable_cache(
  async (): Promise<AiRuntimeSettings> => {
    const admin = createSupabaseAdminClient();
    if (!admin) return DEFAULT_RUNTIME;
    return toRuntime(await loadRow(admin));
  },
  ["ai-settings:runtime"],
  { revalidate: CACHE_SECONDS.siteSettings, tags: [CACHE_TAGS.aiSettings] },
);

export type ApiKeyResult =
  | { ok: true; key: string; source: Exclude<AiKeySource, "none"> }
  | { ok: false; reason: "none" | "decrypt_failed"; message: string };

/** Panel-saved key first, then the GEMINI_API_KEY environment variable. */
export async function resolveApiKey(admin: AdminClient): Promise<ApiKeyResult> {
  const row = await loadRow(admin);
  if (row?.api_key_encrypted) {
    const encryptionKey = getEncryptionKey();
    if (!encryptionKey) return { ok: false, reason: "decrypt_failed", message: KEY_MISSING_MESSAGE };
    try {
      return { ok: true, key: decryptSecret(row.api_key_encrypted, encryptionKey), source: "panel" };
    } catch {
      return { ok: false, reason: "decrypt_failed", message: KEY_DECRYPT_MESSAGE };
    }
  }
  const fromEnv = envApiKey();
  if (fromEnv) return { ok: true, key: fromEnv, source: "env" };
  return { ok: false, reason: "none", message: "API anahtarı tanımlı değil." };
}

export async function loadAiSettingsView(admin: AdminClient): Promise<AiSettingsView> {
  const row = await loadRow(admin);
  const runtime = toRuntime(row);
  const key = await resolveApiKey(admin);

  return {
    ...runtime,
    keySource: key.ok ? key.source : "none",
    keyHint: key.ok ? `••••${key.key.slice(-4)}` : null,
    keyLabel: row?.key_label ?? "",
    projectName: row?.project_name ?? "",
    projectNumber: row?.project_number ?? "",
    lastTestAt: row?.last_test_at ?? null,
    lastTestOk: row?.last_test_ok ?? null,
    lastTestError: row?.last_test_error ?? null,
    updatedAt: row?.updated_at ?? null,
    encryptionKeyConfigured: getEncryptionKey() !== null,
  };
}

export type SaveAiSettingsResult =
  | { ok: true }
  | { ok: false; message: string; errors?: AiSettingsErrors };

export async function saveAiSettings(
  admin: AdminClient,
  input: AiSettingsInput,
  adminUserId: string,
): Promise<SaveAiSettingsResult> {
  const current = await loadRow(admin);
  const validation = validateAiSettingsInput(input, {
    hasStoredKey: Boolean(current?.api_key_encrypted) || envApiKey() !== null,
  });
  if (!validation.ok) return { ok: false, message: "Formdaki hataları düzeltin.", errors: validation.errors };
  const value = validation.value;

  let apiKeyEncrypted = current?.api_key_encrypted ?? null;
  if (value.apiKey !== null) {
    const encryptionKey = getEncryptionKey();
    if (!encryptionKey) return { ok: false, message: KEY_MISSING_MESSAGE };
    apiKeyEncrypted = encryptSecret(value.apiKey, encryptionKey);
  }

  // A new key or model invalidates the previous connection test.
  const connectionChanged = value.apiKey !== null || (current?.model ?? DEFAULT_MODEL) !== value.model;

  const { error } = await admin
    .from("ai_settings")
    .update({
      enabled: value.enabled,
      api_key_encrypted: apiKeyEncrypted,
      key_label: value.keyLabel || null,
      project_name: value.projectName || null,
      project_number: value.projectNumber || null,
      model: value.model,
      feature_search: value.featureSearch,
      feature_classification: value.featureClassification,
      feature_matching: value.featureMatching,
      min_confidence: value.minConfidence,
      daily_request_limit: value.dailyRequestLimit,
      timeout_ms: value.timeoutMs,
      updated_by: adminUserId,
      ...(connectionChanged ? { last_test_at: null, last_test_ok: null, last_test_error: null } : {}),
    })
    .eq("id", 1);

  if (error) {
    console.error("AI settings save failed:", error);
    return { ok: false, message: "Ayarlar kaydedilemedi." };
  }
  return { ok: true };
}

export async function recordAiTestResult(admin: AdminClient, ok: boolean, error: string | null): Promise<void> {
  const { error: updateError } = await admin
    .from("ai_settings")
    .update({ last_test_at: new Date().toISOString(), last_test_ok: ok, last_test_error: ok ? null : error })
    .eq("id", 1);
  if (updateError) console.error("AI test result save failed:", updateError);
}
