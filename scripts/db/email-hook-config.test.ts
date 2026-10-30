import { describe, expect, it } from "vitest";
import { parseHookSecret } from "../../lib/email/auth-hook";
import { DISABLE_PATCH, HOOK_PATH, buildEnablePatch, generateHookSecret, validateHookUrl } from "./email-hook-config";

describe("generateHookSecret", () => {
  it("produces a secret the hook endpoint accepts, different every time", () => {
    const a = generateHookSecret();
    expect(a.startsWith("v1,whsec_")).toBe(true);
    expect(parseHookSecret(a)?.length).toBe(32);
    expect(generateHookSecret()).not.toBe(a);
  });
});

describe("validateHookUrl", () => {
  it("accepts the https hook address", () => {
    expect(validateHookUrl(`https://www.2elbul.com${HOOK_PATH}`)).toEqual({ ok: true, url: `https://www.2elbul.com${HOOK_PATH}` });
  });

  it("rejects missing, malformed, http, localhost and wrong-path addresses", () => {
    for (const value of [undefined, "", "not a url", `http://www.2elbul.com${HOOK_PATH}`, `https://localhost${HOOK_PATH}`, `https://127.0.0.1${HOOK_PATH}`, "https://www.2elbul.com/api/other"]) {
      expect(validateHookUrl(value as string | undefined).ok, String(value)).toBe(false);
    }
  });
});

describe("buildEnablePatch", () => {
  it("enables the hook with the address and secret", () => {
    const secret = generateHookSecret();
    expect(buildEnablePatch("https://x.com/api/auth/email-hook", secret)).toEqual({
      hook_send_email_enabled: true,
      hook_send_email_uri: "https://x.com/api/auth/email-hook",
      hook_send_email_secrets: secret,
    });
  });

  it("refuses to enable without a valid secret, so sign-ups cannot break", () => {
    expect(() => buildEnablePatch("https://x.com/api/auth/email-hook", undefined)).toThrow(/SEND_EMAIL_HOOK_SECRET/);
    expect(() => buildEnablePatch("https://x.com/api/auth/email-hook", "short")).toThrow();
  });

  it("disable only flips the switch", () => {
    expect(DISABLE_PATCH).toEqual({ hook_send_email_enabled: false });
  });
});
