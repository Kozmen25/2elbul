import { beforeEach, describe, expect, it, vi } from "vitest";
import { createNotificationMailer } from "./notify";

const { loadSmtpConfigMock, deliverEmailMock } = vi.hoisted(() => ({
  loadSmtpConfigMock: vi.fn(),
  deliverEmailMock: vi.fn(),
}));

vi.mock("@/lib/email/settings", () => ({ loadSmtpConfig: loadSmtpConfigMock }));
vi.mock("@/lib/email/service", () => ({ deliverEmail: deliverEmailMock }));

const READY = { status: "ready", settings: { host: "h", port: 587, secure: false, username: "", password: "", fromEmail: "a@b.co", fromName: "", replyTo: "" } };
const ALERT = { productName: "iPhone 13", targetPrice: 20000, currentPrice: 19000, productUrl: "https://www.2elbul.com/product/iphone-13" };

function fakeAdmin(users: Record<string, { email: string | null; optedIn?: boolean | null }>) {
  const getUserById = vi.fn(async (id: string) => ({ data: { user: users[id] ? { email: users[id].email } : null } }));
  const from = vi.fn(() => ({
    select: () => ({
      eq: (_column: string, id: string) => ({
        maybeSingle: async () => ({ data: users[id]?.optedIn === undefined ? null : { email_notifications: users[id].optedIn } }),
      }),
    }),
  }));
  return { admin: { auth: { admin: { getUserById } }, from } as never, getUserById };
}

describe("createNotificationMailer", () => {
  beforeEach(() => {
    loadSmtpConfigMock.mockReset();
    deliverEmailMock.mockReset();
  });

  it("sends to the user's address with a link to their settings", async () => {
    loadSmtpConfigMock.mockResolvedValue(READY);
    deliverEmailMock.mockResolvedValue({ ok: true, messageId: "x" });
    const { admin } = fakeAdmin({ "u-1": { email: "kullanici@example.com", optedIn: true } });

    const result = await createNotificationMailer(admin, "https://www.2elbul.com/")("u-1", "price_alert", ALERT);

    expect(result).toBe("sent");
    const [, config, input] = deliverEmailMock.mock.calls[0];
    expect(config).toBe(READY);
    expect(input).toMatchObject({ to: "kullanici@example.com", template: "price_alert", source: "app", userId: "u-1", unsubscribeUrl: "https://www.2elbul.com/hesabim" });
    expect(input.message.text).toContain("https://www.2elbul.com/hesabim");
  });

  it("does nothing, and logs nothing, while the e-mail service is off", async () => {
    loadSmtpConfigMock.mockResolvedValue({ status: "disabled" });
    const { admin, getUserById } = fakeAdmin({ "u-1": { email: "a@b.co" } });

    expect(await createNotificationMailer(admin, "https://x.test")("u-1", "price_alert", ALERT)).toBe("skipped");
    expect(getUserById).not.toHaveBeenCalled();
    expect(deliverEmailMock).not.toHaveBeenCalled();
  });

  it("respects the user's opt-out", async () => {
    loadSmtpConfigMock.mockResolvedValue(READY);
    deliverEmailMock.mockReset();
    const { admin } = fakeAdmin({ "u-1": { email: "a@b.co", optedIn: false } });
    expect(await createNotificationMailer(admin, "https://x.test")("u-1", "price_drop", { ...ALERT, previousPrice: 25000, dropPercent: 20 } as never)).toBe("skipped");
    expect(deliverEmailMock).not.toHaveBeenCalled();
  });

  it("treats a missing profile as opted in and a user without an address as skipped", async () => {
    loadSmtpConfigMock.mockResolvedValue(READY);
    deliverEmailMock.mockReset();
    deliverEmailMock.mockResolvedValue({ ok: true, messageId: null });
    const { admin } = fakeAdmin({ "u-1": { email: "a@b.co" }, "u-2": { email: null, optedIn: true } });
    const notify = createNotificationMailer(admin, "https://x.test");
    expect(await notify("u-1", "price_alert", ALERT)).toBe("sent");
    expect(await notify("u-2", "price_alert", ALERT)).toBe("skipped");
  });

  it("looks the settings and each user up only once per run", async () => {
    loadSmtpConfigMock.mockReset();
    loadSmtpConfigMock.mockResolvedValue(READY);
    deliverEmailMock.mockReset();
    deliverEmailMock.mockResolvedValue({ ok: true, messageId: null });
    const { admin, getUserById } = fakeAdmin({ "u-1": { email: "a@b.co", optedIn: true } });
    const notify = createNotificationMailer(admin, "https://x.test");
    await notify("u-1", "price_alert", ALERT);
    await notify("u-1", "price_alert", ALERT);
    await notify("u-1", "price_alert", ALERT);
    expect(loadSmtpConfigMock).toHaveBeenCalledTimes(1);
    expect(getUserById).toHaveBeenCalledTimes(1);
    expect(deliverEmailMock).toHaveBeenCalledTimes(3);
  });

  it("reports a failed send and never throws", async () => {
    loadSmtpConfigMock.mockResolvedValue(READY);
    deliverEmailMock.mockReset();
    deliverEmailMock.mockResolvedValue({ ok: false, status: "failed", reason: "x" });
    const { admin } = fakeAdmin({ "u-1": { email: "a@b.co", optedIn: true } });
    expect(await createNotificationMailer(admin, "https://x.test")("u-1", "price_alert", ALERT)).toBe("failed");

    deliverEmailMock.mockRejectedValue(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await createNotificationMailer(admin, "https://x.test")("u-1", "price_alert", ALERT)).toBe("failed");
  });
});
