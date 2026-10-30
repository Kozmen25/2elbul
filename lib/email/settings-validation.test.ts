import { describe, expect, it } from "vitest";
import {
  SMTP_PRESETS,
  isValidEmailAddress,
  validateEmailSettingsInput,
  type EmailSettingsInput,
} from "./settings-validation";

const valid: EmailSettingsInput = {
  enabled: true,
  host: "smtp.resend.com",
  port: "465",
  secure: true,
  username: "resend",
  password: "re_secret",
  fromEmail: "bildirim@2elbul.com",
  fromName: "2ElBul",
  replyTo: "",
};

const check = (patch: Partial<EmailSettingsInput>, hasStoredPassword = false) =>
  validateEmailSettingsInput({ ...valid, ...patch }, { hasStoredPassword });

describe("validateEmailSettingsInput", () => {
  it("accepts a complete configuration and normalises the port", () => {
    const result = check({});
    expect(result).toEqual({
      ok: true,
      value: {
        enabled: true,
        host: "smtp.resend.com",
        port: 465,
        secure: true,
        username: "resend",
        password: "re_secret",
        fromEmail: "bildirim@2elbul.com",
        fromName: "2ElBul",
        replyTo: "",
      },
    });
  });

  it("trims whitespace", () => {
    const result = check({ host: "  smtp.resend.com ", fromEmail: " a@b.co " });
    expect(result.ok && result.value.host).toBe("smtp.resend.com");
    expect(result.ok && result.value.fromEmail).toBe("a@b.co");
  });

  it("treats a blank password as 'keep the stored one'", () => {
    const result = check({ password: "" }, true);
    expect(result.ok && result.value.password).toBeNull();
  });

  it("requires a password when a username is set and none is stored", () => {
    const result = check({ password: "" }, false);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors.password).toBeTruthy();
  });

  it("allows an authless relay (no username, no password)", () => {
    expect(check({ username: "", password: "" }).ok).toBe(true);
  });

  it("requires a username together with a new password", () => {
    const result = check({ username: "", password: "x" });
    expect(!result.ok && result.errors.username).toBeTruthy();
  });

  it("rejects hosts written as URLs or with a port", () => {
    for (const host of ["https://smtp.resend.com", "smtp.resend.com:465", "smtp.resend.com/x", "bad host", "-bad.com"]) {
      const result = check({ host });
      expect(!result.ok && result.errors.host, host).toBeTruthy();
    }
  });

  it("rejects ports outside 1-65535 and non-numbers", () => {
    for (const port of ["0", "65536", "-1", "abc", "", "1.5"]) {
      const result = check({ port });
      expect(!result.ok && result.errors.port, port).toBeTruthy();
    }
  });

  it("rejects malformed addresses", () => {
    for (const fromEmail of ["", "no-at-sign", "a@b", "a b@c.com", "a@b.com, c@d.com", "<a@b.com>"]) {
      const result = check({ fromEmail });
      expect(!result.ok && result.errors.fromEmail, fromEmail).toBeTruthy();
    }
    expect(!check({ replyTo: "nope" }).ok).toBe(true);
  });

  it("blocks header injection through line breaks in any field", () => {
    for (const patch of [
      { fromName: "2ElBul\r\nBcc: x@y.com" },
      { fromEmail: "a@b.com\nBcc: x@y.com" },
      { host: "smtp.x.com\r\nRCPT TO:x" },
      { username: "u\nx" },
      { replyTo: "a@b.com\r\nX: y" },
    ]) {
      expect(check(patch).ok).toBe(false);
    }
  });

  it("rejects angle brackets and quotes in the sender name", () => {
    expect(check({ fromName: "2ElBul <evil@x.com>" }).ok).toBe(false);
    expect(check({ fromName: 'Say "hi"' }).ok).toBe(false);
  });

  it("lets an incomplete configuration be saved while disabled", () => {
    const result = check({ enabled: false, host: "", port: "", fromEmail: "", username: "", password: "" });
    expect(result.ok).toBe(true);
  });

  it("still rejects a half-filled disabled configuration that is invalid", () => {
    expect(check({ enabled: false, host: "https://x.com" }).ok).toBe(false);
  });
});

describe("isValidEmailAddress", () => {
  it("accepts ordinary addresses including plus-tags and subdomains", () => {
    for (const value of ["a@b.co", "first.last+tag@mail.example.com", "ü@b.com"]) {
      expect(isValidEmailAddress(value), value).toBe(true);
    }
  });
});

describe("SMTP_PRESETS", () => {
  it("only offers usable hosts and ports", () => {
    expect(SMTP_PRESETS.length).toBeGreaterThan(3);
    for (const preset of SMTP_PRESETS) {
      expect(validateEmailSettingsInput(
        { enabled: false, host: preset.host, port: preset.port, secure: preset.secure, username: preset.username, password: "", fromEmail: "", fromName: "", replyTo: "" },
        { hasStoredPassword: false },
      ).ok, preset.id).toBe(true);
      // 465 is implicit TLS, everything else upgrades with STARTTLS.
      expect(preset.secure).toBe(preset.port === 465);
    }
  });
});
