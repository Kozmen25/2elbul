// Sends one e-mail through the SMTP settings saved in the admin panel and
// records the outcome in email_logs. Never throws: callers (auth hook, cron,
// admin test) decide what a failed send means for them.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Transporter } from "nodemailer";
import type { Database } from "@/lib/database.types";
import { loadSmtpConfig, type SmtpConfigResult } from "@/lib/email/settings";
import type { RenderedEmail } from "@/lib/email/templates";
import { createSmtpTransport, explainSmtpError } from "@/lib/email/transport";

type AdminClient = SupabaseClient<Database>;

export type EmailSource = "auth_hook" | "app" | "admin_test";

export type SendEmailInput = {
  to: string;
  /** Template name for the log, e.g. "recovery". */
  template: string;
  message: RenderedEmail;
  source: EmailSource;
  userId?: string | null;
  /** Adds a List-Unsubscribe header (notification e-mails). */
  unsubscribeUrl?: string;
};

export type SendEmailResult =
  | { ok: true; messageId: string | null }
  | { ok: false; status: "skipped" | "failed"; reason: string; detail?: string };

const MAX_LOG_ERROR_LENGTH = 300;

const SKIP_REASONS: Record<Exclude<SmtpConfigResult["status"], "ready">, string> = {
  disabled: "E-posta servisi kapalı (admin panelinde SMTP ayarları etkinleştirilmemiş).",
  incomplete: "SMTP ayarları eksik.",
  key_error: "SMTP şifresi okunamadı.",
};

export async function sendEmail(admin: AdminClient, input: SendEmailInput): Promise<SendEmailResult> {
  const config = await loadSmtpConfig(admin, { ignoreEnabled: input.source === "admin_test" });
  return deliverEmail(admin, config, input, createSmtpTransport);
}

/** Split from sendEmail so tests can inject a config and a fake transport. */
export async function deliverEmail(
  admin: AdminClient,
  config: SmtpConfigResult,
  input: SendEmailInput,
  makeTransport: typeof createSmtpTransport,
): Promise<SendEmailResult> {
  if (config.status !== "ready") {
    const reason = config.status === "key_error" ? config.message : SKIP_REASONS[config.status];
    await writeLog(admin, input, "skipped", reason, null);
    return { ok: false, status: "skipped", reason };
  }

  const { settings } = config;
  let transport: Transporter | null = null;
  try {
    transport = makeTransport(settings);
    const info = await transport.sendMail({
      from: settings.fromName ? { name: settings.fromName, address: settings.fromEmail } : settings.fromEmail,
      to: input.to,
      ...(settings.replyTo ? { replyTo: settings.replyTo } : {}),
      subject: input.message.subject,
      html: input.message.html,
      text: input.message.text,
      ...(input.unsubscribeUrl ? { headers: { "List-Unsubscribe": `<${input.unsubscribeUrl}>` } } : {}),
    });

    const rejected = Array.isArray(info.rejected) ? info.rejected : [];
    if (rejected.length > 0) {
      const reason = "Alıcı adresi sunucu tarafından reddedildi.";
      await writeLog(admin, input, "failed", reason, null);
      return { ok: false, status: "failed", reason };
    }

    const messageId = typeof info.messageId === "string" ? info.messageId : null;
    await writeLog(admin, input, "sent", null, messageId);
    return { ok: true, messageId };
  } catch (error) {
    const explanation = explainSmtpError(error);
    await writeLog(admin, input, "failed", `${explanation.message} [${explanation.detail}]`, null);
    return { ok: false, status: "failed", reason: explanation.message, detail: explanation.detail };
  } finally {
    transport?.close();
  }
}

async function writeLog(
  admin: AdminClient,
  input: SendEmailInput,
  status: "sent" | "failed" | "skipped",
  error: string | null,
  messageId: string | null,
): Promise<void> {
  const { error: logError } = await admin.from("email_logs").insert({
    to_email: input.to,
    template: input.template,
    subject: input.message.subject,
    status,
    error: error ? error.slice(0, MAX_LOG_ERROR_LENGTH) : null,
    message_id: messageId,
    user_id: input.userId ?? null,
    source: input.source,
  });
  if (logError) console.error("Email log insert failed:", logError);
}
