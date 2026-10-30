import { describe, expect, it, vi } from "vitest";
import { deliverEmail } from "./service";
import type { SmtpConfigResult } from "./settings";

const settings = { host: "smtp.example.com", port: 587, secure: false, username: "u", password: "p", fromEmail: "bildirim@2elbul.com", fromName: "2ElBul", replyTo: "" };
const ready: SmtpConfigResult = { status: "ready", settings };
const message = { subject: "2ElBul - Test", html: "<p>merhaba</p>", text: "merhaba" };

function fakeAdmin() {
  const insert = vi.fn(async (_row: Record<string, unknown>) => ({ error: null }));
  return { admin: { from: vi.fn(() => ({ insert })) } as never, insert };
}

function fakeTransport(result: Partial<{ messageId: string; rejected: string[] }> | Error) {
  const sendMail = vi.fn(async (_options: Record<string, unknown>) => {
    if (result instanceof Error) throw result;
    return { messageId: "<id-1@mail>", rejected: [], ...result };
  });
  const close = vi.fn();
  return { make: (() => ({ sendMail, close })) as never, sendMail, close };
}

describe("deliverEmail", () => {
  it("sends with the configured sender and logs a success", async () => {
    const { admin, insert } = fakeAdmin();
    const { make, sendMail, close } = fakeTransport({});

    const result = await deliverEmail(admin, ready, { to: "a@b.co", template: "recovery", message, source: "auth_hook", userId: "u-1" }, make);

    expect(result).toEqual({ ok: true, messageId: "<id-1@mail>" });
    const options = sendMail.mock.calls[0][0];
    expect(options).toMatchObject({ to: "a@b.co", subject: message.subject, html: message.html, text: message.text, from: { name: "2ElBul", address: "bildirim@2elbul.com" } });
    expect(options).not.toHaveProperty("headers");
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ to_email: "a@b.co", template: "recovery", status: "sent", error: null, message_id: "<id-1@mail>", user_id: "u-1", source: "auth_hook" }));
    expect(close).toHaveBeenCalled();
  });

  it("never stores the message body in the log", async () => {
    const { admin, insert } = fakeAdmin();
    await deliverEmail(admin, ready, { to: "a@b.co", template: "recovery", message, source: "app" }, fakeTransport({}).make);
    expect(JSON.stringify(insert.mock.calls[0][0])).not.toContain("merhaba");
  });

  it("adds List-Unsubscribe and Reply-To when configured", async () => {
    const { admin } = fakeAdmin();
    const { make, sendMail } = fakeTransport({});
    const withReply: SmtpConfigResult = { status: "ready", settings: { ...settings, replyTo: "destek@2elbul.com" } };
    await deliverEmail(admin, withReply, { to: "a@b.co", template: "price_alert", message, source: "app", unsubscribeUrl: "https://www.2elbul.com/hesabim" }, make);
    expect(sendMail.mock.calls[0][0]).toMatchObject({ replyTo: "destek@2elbul.com", headers: { "List-Unsubscribe": "<https://www.2elbul.com/hesabim>" } });
  });

  it("skips and logs when the service is not configured", async () => {
    for (const config of [{ status: "disabled" }, { status: "incomplete" }, { status: "key_error", message: "anahtar yok" }] as SmtpConfigResult[]) {
      const { admin, insert } = fakeAdmin();
      const { make, sendMail } = fakeTransport({});
      const result = await deliverEmail(admin, config, { to: "a@b.co", template: "recovery", message, source: "app" }, make);
      expect(result).toMatchObject({ ok: false, status: "skipped" });
      expect(sendMail).not.toHaveBeenCalled();
      expect(insert).toHaveBeenCalledWith(expect.objectContaining({ status: "skipped" }));
    }
  });

  it("returns a plain-language failure and logs it when the SMTP server errors", async () => {
    const { admin, insert } = fakeAdmin();
    const { make, close } = fakeTransport(Object.assign(new Error("Invalid login: 535 bad credentials"), { code: "EAUTH", responseCode: 535 }));

    const result = await deliverEmail(admin, ready, { to: "a@b.co", template: "recovery", message, source: "app" }, make);

    expect(result).toMatchObject({ ok: false, status: "failed" });
    expect(!result.ok && result.reason).toContain("kullanıcı adı veya şifreyi reddetti");
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
    expect(close).toHaveBeenCalled();
  });

  it("treats rejected recipients as a failure", async () => {
    const { admin } = fakeAdmin();
    const result = await deliverEmail(admin, ready, { to: "a@b.co", template: "recovery", message, source: "app" }, fakeTransport({ rejected: ["a@b.co"] }).make);
    expect(result).toMatchObject({ ok: false, status: "failed" });
  });

  it("does not fail the send when writing the log fails", async () => {
    const insert = vi.fn(async () => ({ error: { message: "db down" } }));
    const admin = { from: vi.fn(() => ({ insert })) } as never;
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await deliverEmail(admin, ready, { to: "a@b.co", template: "recovery", message, source: "app" }, fakeTransport({}).make);
    expect(result.ok).toBe(true);
  });

  it("truncates long errors in the log", async () => {
    const { admin, insert } = fakeAdmin();
    const { make } = fakeTransport(new Error("x".repeat(2000)));
    await deliverEmail(admin, ready, { to: "a@b.co", template: "recovery", message, source: "app" }, make);
    expect((insert.mock.calls[0][0].error as string).length).toBeLessThanOrEqual(300);
  });
});
