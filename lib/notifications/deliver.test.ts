import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { NotificationMailer } from "@/lib/email/notify";
import { createNotificationDeliverer } from "./deliver";

type Profile = { email_notifications?: boolean; notification_settings?: unknown } | null;

function fakeAdmin(profiles: Record<string, Profile>, insertError: { message: string } | null = null) {
  const inserted: Record<string, unknown>[] = [];
  const profileReads: string[] = [];
  const admin = {
    from(table: string) {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: (_column: string, userId: string) => ({
              maybeSingle: async () => {
                profileReads.push(userId);
                return { data: profiles[userId] ?? null, error: null };
              },
            }),
          }),
        };
      }
      return {
        insert: async (row: Record<string, unknown>) => {
          if (insertError) return { error: insertError };
          inserted.push(row);
          return { error: null };
        },
      };
    },
  };
  return { admin: admin as unknown as SupabaseClient<Database>, inserted, profileReads };
}

const CONTENT = { title: "Fiyat Düştü", body: "iPhone 13 ucuzladı", metadata: { product_id: 1 } };
const DROP = { productName: "iPhone 13", previousPrice: 25000, currentPrice: 22000, dropPercent: 12, productUrl: "https://x.test/p" };

function mailerMock(result: "sent" | "skipped" | "failed" = "sent") {
  return vi.fn(async () => result) as unknown as NotificationMailer & ReturnType<typeof vi.fn>;
}

describe("createNotificationDeliverer", () => {
  it("stores the in-app notification and e-mails by default", async () => {
    const { admin, inserted } = fakeAdmin({});
    const mailer = mailerMock();

    const result = await createNotificationDeliverer(admin, mailer)({ userId: "u1", kind: "price_drop", notification: CONTENT, email: DROP });

    expect(result).toEqual({ inApp: true, email: "sent" });
    expect(inserted).toEqual([{ user_id: "u1", type: "price_drop", title: "Fiyat Düştü", body: "iPhone 13 ucuzladı", metadata: { product_id: 1 } }]);
    expect(mailer).toHaveBeenCalledWith("u1", "price_drop", DROP);
  });

  it("skips the in-app notification when the user switched it off for that kind", async () => {
    const { admin, inserted } = fakeAdmin({ u1: { notification_settings: { price_drop: { in_app: false } } } });
    const mailer = mailerMock();

    const result = await createNotificationDeliverer(admin, mailer)({ userId: "u1", kind: "price_drop", notification: CONTENT, email: DROP });

    expect(result).toEqual({ inApp: false, email: "sent" });
    expect(inserted).toEqual([]);
  });

  it("does not e-mail when the kind or the whole account has e-mail switched off", async () => {
    const perKind = fakeAdmin({ u1: { notification_settings: { price_drop: { email: false } } } });
    const mailer1 = mailerMock();
    expect(await createNotificationDeliverer(perKind.admin, mailer1)({ userId: "u1", kind: "price_drop", notification: CONTENT, email: DROP })).toEqual({ inApp: true, email: "off" });
    expect(mailer1).not.toHaveBeenCalled();

    const master = fakeAdmin({ u2: { email_notifications: false, notification_settings: { price_drop: { email: true } } } });
    const mailer2 = mailerMock();
    expect(await createNotificationDeliverer(master.admin, mailer2)({ userId: "u2", kind: "price_drop", notification: CONTENT, email: DROP })).toEqual({ inApp: true, email: "off" });
    expect(mailer2).not.toHaveBeenCalled();
  });

  it("applies each kind's own choice", async () => {
    const { admin, inserted } = fakeAdmin({ u1: { notification_settings: { saved_search: { in_app: false } } } });
    const deliver = createNotificationDeliverer(admin, mailerMock());

    await deliver({ userId: "u1", kind: "saved_search", notification: CONTENT, email: { query: "iphone", matchCount: 2, searchUrl: "https://x.test/s" } });
    await deliver({ userId: "u1", kind: "price_drop", notification: CONTENT, email: DROP });

    expect(inserted.map((row) => row.type)).toEqual(["price_drop"]);
  });

  it("reads each user's preferences once per run", async () => {
    const { admin, profileReads } = fakeAdmin({});
    const deliver = createNotificationDeliverer(admin, mailerMock());
    for (let i = 0; i < 3; i += 1) await deliver({ userId: "u1", kind: "price_drop", notification: CONTENT, email: DROP });
    expect(profileReads).toEqual(["u1"]);
  });

  it("reports a skipped e-mail (service off) without failing", async () => {
    const { admin } = fakeAdmin({});
    const result = await createNotificationDeliverer(admin, mailerMock("skipped"))({ userId: "u1", kind: "price_drop", notification: CONTENT, email: DROP });
    expect(result).toEqual({ inApp: true, email: "skipped" });
  });

  it("throws when the in-app notification cannot be stored, so the caller retries next run", async () => {
    const { admin } = fakeAdmin({}, { message: "db down" });
    const mailer = mailerMock();
    await expect(
      createNotificationDeliverer(admin, mailer)({ userId: "u1", kind: "price_drop", notification: CONTENT, email: DROP }),
    ).rejects.toEqual({ message: "db down" });
    expect(mailer).not.toHaveBeenCalled();
  });
});
