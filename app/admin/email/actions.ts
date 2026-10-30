"use server";

import { requireAdminUser } from "@/lib/admin";
import { logAdminAction } from "@/lib/auth/audit";
import { sendEmail } from "@/lib/email/service";
import { loadSmtpConfig, recordTestResult, saveEmailSettings } from "@/lib/email/settings";
import { isValidEmailAddress, type EmailSettingsErrors, type EmailSettingsInput } from "@/lib/email/settings-validation";
import { renderEmail } from "@/lib/email/templates";
import { verifySmtpConnection } from "@/lib/email/transport";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const EMAIL_ADMIN_PATH = "/admin/email";
const TEST_COOLDOWN_SECONDS = 10;

// These actions deliberately do not call revalidatePath: in the admin shell it
// invalidates the router cache and re-prefetches every sidebar page, and the
// form's "pending" state then waits for all of that. The form refreshes the
// page itself once the action has finished (email-settings-form.tsx).

export type EmailActionResult = {
  ok: boolean;
  message: string;
  /** Technical detail from the SMTP server, shown below the message. */
  detail?: string;
  errors?: EmailSettingsErrors;
};

export async function saveEmailSettingsAction(input: EmailSettingsInput): Promise<EmailActionResult> {
  const admin = await requireAdminUser(EMAIL_ADMIN_PATH);
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { ok: false, message: "Supabase bağlantısı yapılandırılmamış." };

  const result = await saveEmailSettings(supabase, input, admin.id);
  if (!result.ok) return { ok: false, message: result.message, errors: result.errors };

  // Only non-secret facts are recorded; the password never reaches the audit log.
  await logAdminAction(supabase, admin.id, {
    action: "EMAIL_SETTINGS_UPDATED",
    metadata: {
      enabled: input.enabled,
      host: input.host.trim(),
      port: Number(input.port),
      secure: input.secure,
      passwordChanged: input.password !== "",
    },
  });
  return {
    ok: true,
    message: input.enabled
      ? "Ayarlar kaydedildi ve e-posta servisi açık."
      : "Ayarlar kaydedildi. E-posta servisi kapalı; açmak için \"E-posta servisini etkinleştir\" seçeneğini işaretleyin.",
  };
}

/** Checks host, port, TLS and credentials with the saved settings, without sending mail. */
export async function verifySmtpAction(): Promise<EmailActionResult> {
  await requireAdminUser(EMAIL_ADMIN_PATH);
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { ok: false, message: "Supabase bağlantısı yapılandırılmamış." };

  const config = await loadSmtpConfig(supabase, { ignoreEnabled: true });
  if (config.status === "incomplete") return { ok: false, message: "Önce sunucu, port ve gönderen adresini girip kaydedin." };
  if (config.status === "key_error") return { ok: false, message: config.message };
  if (config.status !== "ready") return { ok: false, message: "Önce ayarları kaydedin." };

  const result = await verifySmtpConnection(config.settings);
  await recordTestResult(supabase, result.ok, result.ok ? null : result.message);
  return result.ok
    ? { ok: true, message: "Sunucuya bağlanıldı ve kimlik doğrulama başarılı." }
    : { ok: false, message: result.message, detail: result.detail };
}

export async function sendTestEmailAction(to: string): Promise<EmailActionResult> {
  const admin = await requireAdminUser(EMAIL_ADMIN_PATH);
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { ok: false, message: "Supabase bağlantısı yapılandırılmamış." };

  const address = to.trim();
  if (!isValidEmailAddress(address)) return { ok: false, message: "Geçerli bir alıcı e-posta adresi girin." };

  // A short cooldown keeps a double click (or a script) from mailing the same
  // address repeatedly through the company's SMTP account.
  const since = new Date(Date.now() - TEST_COOLDOWN_SECONDS * 1000).toISOString();
  const { count } = await supabase
    .from("email_logs")
    .select("id", { count: "exact", head: true })
    .eq("source", "admin_test")
    .gte("created_at", since);
  if ((count ?? 0) > 0) {
    return { ok: false, message: `Lütfen ${TEST_COOLDOWN_SECONDS} saniye bekleyip tekrar deneyin.` };
  }

  const result = await sendEmail(supabase, {
    to: address,
    template: "test",
    message: renderEmail("test", { to: address }),
    source: "admin_test",
    userId: admin.id,
  });

  await recordTestResult(supabase, result.ok, result.ok ? null : result.reason);
  await logAdminAction(supabase, admin.id, { action: "EMAIL_TEST_SENT", metadata: { ok: result.ok } });

  if (result.ok) {
    return { ok: true, message: `Test e-postası ${address} adresine gönderildi. Gelen kutunu (ve spam klasörünü) kontrol et.` };
  }
  return { ok: false, message: result.reason, detail: "detail" in result ? result.detail : undefined };
}
