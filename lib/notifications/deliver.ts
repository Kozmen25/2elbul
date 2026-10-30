import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";
import type { NotificationEmailData, NotificationMailer, NotifyResult } from "@/lib/email/notify";
import {
  parseNotificationSettings,
  resolveChannels,
  type NotificationKind,
  type NotificationSettings,
} from "@/lib/notifications/preferences";

// The one place that turns "something happened for this user" into the
// in-app notification and the e-mail copy, according to the user's choices.
// The daily checks (price alerts, product follows, saved searches) all go
// through here, so a preference is honoured the same way everywhere.

type AdminClient = SupabaseClient<Database>;

export type NotificationContent = {
  title: string;
  body: string;
  metadata: Record<string, Json>;
};

export type DeliveryResult = {
  /** The in-app notification was stored. */
  inApp: boolean;
  /** "off" = the user switched e-mail off for this kind (or altogether). */
  email: NotifyResult | "off";
};

type UserPreferences = { emailMaster: boolean; settings: NotificationSettings };

/**
 * Returns `deliver(...)` for one run of a daily check. Preferences are read
 * once per user. The in-app notification is stored first and a failure there
 * throws, so the caller keeps its old state and the next run retries; the
 * e-mail is a best-effort copy and never throws.
 */
export function createNotificationDeliverer(admin: AdminClient, mailer: NotificationMailer) {
  const preferences = new Map<string, Promise<UserPreferences>>();

  async function loadPreferences(userId: string): Promise<UserPreferences> {
    const { data, error } = await admin
      .from("profiles")
      .select("email_notifications, notification_settings")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) console.error("Notification preferences lookup failed:", error);
    // No profile row (older accounts) or a failed read means the defaults: everything on.
    return {
      emailMaster: data?.email_notifications ?? true,
      settings: parseNotificationSettings(data?.notification_settings),
    };
  }

  return async function deliver<K extends NotificationKind>(input: {
    userId: string;
    /** Also the in-app notification type and the e-mail template. */
    kind: K;
    notification: NotificationContent;
    email: NotificationEmailData<K>;
  }): Promise<DeliveryResult> {
    const { userId, kind, notification, email } = input;
    if (!preferences.has(userId)) preferences.set(userId, loadPreferences(userId));
    const { emailMaster, settings } = await preferences.get(userId)!;
    const channels = resolveChannels(kind, settings, emailMaster);

    if (channels.inApp) {
      const { error } = await admin.from("user_notifications").insert({
        user_id: userId,
        type: kind,
        title: notification.title,
        body: notification.body,
        metadata: notification.metadata,
      });
      if (error) throw error;
    }

    const emailResult: DeliveryResult["email"] = channels.email ? await mailer(userId, kind, email) : "off";
    return { inApp: channels.inApp, email: emailResult };
  };
}
