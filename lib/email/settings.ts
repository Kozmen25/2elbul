// Reads and writes the SMTP settings row (email_settings, id = 1).
// Service-role only: the table has RLS on with no policies, and the password
// is stored encrypted (lib/email/crypto.ts).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { decryptSecret, encryptSecret, getEncryptionKey } from "@/lib/email/crypto";
import {
  validateEmailSettingsInput,
  type EmailSettingsErrors,
  type EmailSettingsInput,
} from "@/lib/email/settings-validation";

type AdminClient = SupabaseClient<Database>;
type SettingsRow = Database["public"]["Tables"]["email_settings"]["Row"];

export type SmtpSettings = {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
  replyTo: string;
};

export type SmtpConfigResult =
  | { status: "ready"; settings: SmtpSettings }
  | { status: "disabled" }
  | { status: "incomplete" }
  | { status: "key_error"; message: string };

/** What the admin page may see: everything except the password itself. */
export type EmailSettingsView = {
  enabled: boolean;
  host: string;
  port: number | null;
  secure: boolean;
  username: string;
  passwordSet: boolean;
  fromEmail: string;
  fromName: string;
  replyTo: string;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  lastTestError: string | null;
  updatedAt: string | null;
  encryptionKeyConfigured: boolean;
};

export const KEY_MISSING_MESSAGE =
  "EMAIL_SETTINGS_ENCRYPTION_KEY ortam değişkeni tanımlı değil ya da geçersiz; SMTP şifresi güvenli saklanamaz.";

async function loadRow(admin: AdminClient): Promise<SettingsRow | null> {
  const { data, error } = await admin.from("email_settings").select("*").eq("id", 1).maybeSingle();
  if (error) {
    console.error("Email settings query failed:", error);
    return null;
  }
  return data;
}

export function toSettingsView(row: SettingsRow | null, encryptionKeyConfigured: boolean): EmailSettingsView {
  return {
    enabled: row?.enabled ?? false,
    host: row?.host ?? "",
    port: row?.port ?? null,
    secure: row?.secure ?? false,
    username: row?.username ?? "",
    passwordSet: Boolean(row?.password_encrypted),
    fromEmail: row?.from_email ?? "",
    fromName: row?.from_name ?? "",
    replyTo: row?.reply_to ?? "",
    lastTestAt: row?.last_test_at ?? null,
    lastTestOk: row?.last_test_ok ?? null,
    lastTestError: row?.last_test_error ?? null,
    updatedAt: row?.updated_at ?? null,
    encryptionKeyConfigured,
  };
}

export async function loadEmailSettingsView(admin: AdminClient): Promise<EmailSettingsView> {
  return toSettingsView(await loadRow(admin), getEncryptionKey() !== null);
}

/**
 * Decrypted settings for actually sending mail. `ignoreEnabled` lets the admin
 * test button try a configuration that has not been switched on yet.
 */
export async function loadSmtpConfig(
  admin: AdminClient,
  options: { ignoreEnabled?: boolean } = {},
): Promise<SmtpConfigResult> {
  const row = await loadRow(admin);
  if (!row || (!row.enabled && !options.ignoreEnabled)) return { status: "disabled" };
  if (!row.host || !row.port || !row.from_email) return { status: "incomplete" };

  let password = "";
  if (row.username) {
    if (!row.password_encrypted) return { status: "incomplete" };
    const key = getEncryptionKey();
    if (!key) return { status: "key_error", message: KEY_MISSING_MESSAGE };
    try {
      password = decryptSecret(row.password_encrypted, key);
    } catch {
      return {
        status: "key_error",
        message: "SMTP şifresi çözülemedi. Şifreleme anahtarı değişmiş olabilir; şifreyi panelden yeniden kaydedin.",
      };
    }
  }

  return {
    status: "ready",
    settings: {
      host: row.host,
      port: row.port,
      secure: row.secure,
      username: row.username ?? "",
      password,
      fromEmail: row.from_email,
      fromName: row.from_name ?? "",
      replyTo: row.reply_to ?? "",
    },
  };
}

export type SaveEmailSettingsResult =
  | { ok: true }
  | { ok: false; message: string; errors?: EmailSettingsErrors };

export async function saveEmailSettings(
  admin: AdminClient,
  input: EmailSettingsInput,
  adminUserId: string,
): Promise<SaveEmailSettingsResult> {
  const current = await loadRow(admin);
  const validation = validateEmailSettingsInput(input, { hasStoredPassword: Boolean(current?.password_encrypted) });
  if (!validation.ok) {
    return { ok: false, message: "Formdaki hataları düzeltin.", errors: validation.errors };
  }
  const value = validation.value;

  let passwordEncrypted = current?.password_encrypted ?? null;
  if (value.password !== null) {
    const key = getEncryptionKey();
    if (!key) return { ok: false, message: KEY_MISSING_MESSAGE };
    passwordEncrypted = encryptSecret(value.password, key);
  }
  // Authless relay: nothing to keep.
  if (!value.username) passwordEncrypted = null;

  // Changed connection details invalidate the previous test result.
  const connectionChanged =
    !current ||
    current.host !== (value.host || null) ||
    current.port !== (value.port || null) ||
    current.secure !== value.secure ||
    (current.username ?? "") !== value.username ||
    value.password !== null;

  const { error } = await admin
    .from("email_settings")
    .update({
      enabled: value.enabled,
      host: value.host || null,
      port: value.port || null,
      secure: value.secure,
      username: value.username || null,
      password_encrypted: passwordEncrypted,
      from_email: value.fromEmail || null,
      from_name: value.fromName || null,
      reply_to: value.replyTo || null,
      updated_by: adminUserId,
      ...(connectionChanged ? { last_test_at: null, last_test_ok: null, last_test_error: null } : {}),
    })
    .eq("id", 1);

  if (error) {
    console.error("Email settings save failed:", error);
    return { ok: false, message: "Ayarlar kaydedilemedi." };
  }
  return { ok: true };
}

export async function recordTestResult(admin: AdminClient, ok: boolean, error: string | null): Promise<void> {
  const { error: updateError } = await admin
    .from("email_settings")
    .update({ last_test_at: new Date().toISOString(), last_test_ok: ok, last_test_error: ok ? null : error })
    .eq("id", 1);
  if (updateError) console.error("Email test result save failed:", updateError);
}
