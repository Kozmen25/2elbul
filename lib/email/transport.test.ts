import { describe, expect, it } from "vitest";
import { createSmtpTransport, explainSmtpError, isLocalHost } from "./transport";

const base = { host: "smtp.resend.com", port: 465, secure: true, username: "resend", password: "x", fromEmail: "a@b.co", fromName: "", replyTo: "" };

describe("explainSmtpError", () => {
  it("explains rejected credentials", () => {
    expect(explainSmtpError({ code: "EAUTH", message: "Invalid login: 535" }).message).toContain("kullanıcı adı veya şifreyi reddetti");
    expect(explainSmtpError({ responseCode: 535, message: "x" }).message).toContain("kullanıcı adı");
  });

  it("explains unknown hosts, refused connections and timeouts", () => {
    expect(explainSmtpError({ code: "ENOTFOUND" }).message).toContain("Sunucu adı bulunamadı");
    expect(explainSmtpError({ code: "ECONNREFUSED" }).message).toContain("bağlantı reddedildi");
    expect(explainSmtpError({ code: "ETIMEDOUT" }).message).toContain("zamanında yanıt vermedi");
    expect(explainSmtpError({ message: "Greeting never received" }).message).toContain("zamanında yanıt vermedi");
  });

  it("explains the TLS / port mismatch", () => {
    const explanation = explainSmtpError({ code: "ESOCKET", message: "error:0A00010B:SSL routines:ssl3_get_record:wrong version number" });
    expect(explanation.message).toContain("465");
    expect(explanation.message).toContain("TLS");
  });

  it("explains a rejected sender address", () => {
    expect(explainSmtpError({ code: "EENVELOPE", message: "Mail command failed: 550 domain not verified" }).message).toContain("Gönderen adresi");
  });

  it("explains rate limiting", () => {
    expect(explainSmtpError({ responseCode: 421, message: "try later" }).message).toContain("bekleyip");
  });

  it("falls back to a generic message and keeps a trimmed technical detail", () => {
    const result = explainSmtpError(new Error("something\nodd ".repeat(100)));
    expect(result.message).toContain("gönderilemedi");
    expect(result.detail.length).toBeLessThanOrEqual(300);
    expect(result.detail).not.toContain("\n");
  });

  it("never throws on odd input", () => {
    expect(() => explainSmtpError(null)).not.toThrow();
    expect(() => explainSmtpError("plain string")).not.toThrow();
    expect(() => explainSmtpError(undefined)).not.toThrow();
  });
});

describe("createSmtpTransport", () => {
  it("requires STARTTLS on non-TLS ports for remote hosts", () => {
    const options = createSmtpTransport({ ...base, port: 587, secure: false }).options as { requireTLS?: boolean; secure?: boolean };
    expect(options.secure).toBe(false);
    expect(options.requireTLS).toBe(true);
  });

  it("does not demand TLS for implicit-TLS connections", () => {
    const options = createSmtpTransport(base).options as { requireTLS?: boolean; secure?: boolean };
    expect(options.secure).toBe(true);
    expect(options.requireTLS).toBe(false);
  });

  it("allows plain SMTP to a local dev mail catcher", () => {
    const options = createSmtpTransport({ ...base, host: "localhost", port: 1025, secure: false, username: "", password: "" }).options as {
      requireTLS?: boolean;
      auth?: unknown;
    };
    expect(options.requireTLS).toBe(false);
    expect(options.auth).toBeUndefined();
  });

  it("sends credentials only when a username is set", () => {
    const options = createSmtpTransport(base).options as { auth?: { user: string; pass: string } };
    expect(options.auth).toEqual({ user: "resend", pass: "x" });
  });
});

describe("isLocalHost", () => {
  it("recognises loopback names only", () => {
    expect(isLocalHost("localhost")).toBe(true);
    expect(isLocalHost("LOCALHOST")).toBe(true);
    expect(isLocalHost("127.0.0.1")).toBe(true);
    expect(isLocalHost("smtp.localhost.evil.com")).toBe(false);
  });
});
