// E-mail copies of in-app notifications (price alerts, price drops, saved
// searches). Used by the daily crons. Best effort by design: the in-app
// notification is the source of truth, so a failed e-mail never fails the run.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { deliverEmail } from "@/lib/email/service";
import { loadSmtpConfig, type SmtpConfigResult } from "@/lib/email/settings";
import { renderEmail, type EmailTemplateData } from "@/lib/email/templates";
import { createSmtpTransport } from "@/lib/email/transport";

type AdminClient = SupabaseClient<Database>;

export type NotificationEmailKind = "price_alert" | "price_drop" | "new_listing" | "saved_search";

/** The template data minus the settings link, which the mailer adds itself. */
export type NotificationEmailData<K extends NotificationEmailKind> = Omit<EmailTemplateData[K], "settingsUrl">;

export type NotifyResult = "sent" | "skipped" | "failed";

type Recipient = { email: string | null; optedIn: boolean };

/**
 * Returns a `notify(userId, kind, data)` function for one cron run. The SMTP
 * settings and each user's address/preference are looked up once and cached,
 * and nothing is logged or attempted while the e-mail service is off.
 */
export function createNotificationMailer(admin: AdminClient, origin: string) {
  let configPromise: Promise<SmtpConfigResult> | null = null;
  const recipients = new Map<string, Promise<Recipient>>();
  const settingsUrl = `${origin.replace(/\/$/, "")}/hesabim`;

  const getConfig = () => (configPromise ??= loadSmtpConfig(admin));

  async function lookupRecipient(userId: string): Promise<Recipient> {
    const [userResult, profileResult] = await Promise.all([
      admin.auth.admin.getUserById(userId),
      admin.from("profiles").select("email_notifications").eq("user_id", userId).maybeSingle(),
    ]);
    return {
      email: userResult.data?.user?.email ?? null,
      // No profile row yet means the default (opted in).
      optedIn: profileResult.data?.email_notifications ?? true,
    };
  }

  return async function notify<K extends NotificationEmailKind>(
    userId: string,
    kind: K,
    data: NotificationEmailData<K>,
  ): Promise<NotifyResult> {
    try {
      const config = await getConfig();
      if (config.status !== "ready") return "skipped";

      if (!recipients.has(userId)) recipients.set(userId, lookupRecipient(userId));
      const recipient = await recipients.get(userId)!;
      if (!recipient.email || !recipient.optedIn) return "skipped";

      const message = renderEmail(kind, { ...data, settingsUrl } as EmailTemplateData[K]);
      const result = await deliverEmail(
        admin,
        config,
        { to: recipient.email, template: kind, message, source: "app", userId, unsubscribeUrl: settingsUrl },
        createSmtpTransport,
      );
      return result.ok ? "sent" : "failed";
    } catch (error) {
      console.error("Notification e-mail failed:", error instanceof Error ? error.message : error);
      return "failed";
    }
  };
}

export type NotificationMailer = ReturnType<typeof createNotificationMailer>;
