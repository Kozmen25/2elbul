import { describe, expect, it } from "vitest";
import {
  SIGNATURE_TOLERANCE_SECONDS,
  buildAuthEmail,
  parseHookSecret,
  signHookBody,
  verifyHookSignature,
} from "./auth-hook";

const secret = parseHookSecret(`v1,whsec_${Buffer.from("0123456789abcdef0123456789abcdef").toString("base64")}`)!;
const NOW = 1_790_000_000;
const BODY = JSON.stringify({ user: { email: "a@b.co" } });

const signed = (overrides: Partial<{ id: string; timestamp: string; body: string }> = {}) => {
  const id = overrides.id ?? "msg_1";
  const timestamp = overrides.timestamp ?? String(NOW);
  const body = overrides.body ?? BODY;
  return { id, timestamp, body, signature: signHookBody(secret, id, timestamp, body) };
};

describe("parseHookSecret", () => {
  it("accepts the v1,whsec_ format Supabase generates, and a bare base64 value", () => {
    expect(parseHookSecret("v1,whsec_MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")?.length).toBe(32);
    expect(parseHookSecret("MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")?.length).toBe(32);
  });

  it("rejects missing or implausibly short secrets", () => {
    expect(parseHookSecret(undefined)).toBeNull();
    expect(parseHookSecret("")).toBeNull();
    expect(parseHookSecret("v1,whsec_YWJj")).toBeNull();
  });
});

describe("verifyHookSignature", () => {
  it("accepts a correctly signed, fresh request", () => {
    expect(verifyHookSignature(secret, signed(), NOW)).toBe(true);
  });

  it("accepts when one of several signatures matches", () => {
    const request = signed();
    expect(verifyHookSignature(secret, { ...request, signature: `v1,AAAA ${request.signature}` }, NOW)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const request = signed();
    expect(verifyHookSignature(secret, { ...request, body: BODY.replace("a@b.co", "x@y.co") }, NOW)).toBe(false);
  });

  it("rejects a signature made with another secret", () => {
    const other = Buffer.from("ffffffffffffffffffffffffffffffff");
    const request = signed();
    expect(verifyHookSignature(secret, { ...request, signature: signHookBody(other, request.id, request.timestamp, request.body) }, NOW)).toBe(false);
  });

  it("rejects old and future timestamps (replay protection)", () => {
    const old = signed({ timestamp: String(NOW - SIGNATURE_TOLERANCE_SECONDS - 1) });
    const future = signed({ timestamp: String(NOW + SIGNATURE_TOLERANCE_SECONDS + 1) });
    expect(verifyHookSignature(secret, old, NOW)).toBe(false);
    expect(verifyHookSignature(secret, future, NOW)).toBe(false);
    expect(verifyHookSignature(secret, signed({ timestamp: String(NOW - SIGNATURE_TOLERANCE_SECONDS) }), NOW)).toBe(true);
  });

  it("rejects missing headers and unknown signature versions", () => {
    const request = signed();
    expect(verifyHookSignature(secret, { ...request, id: null }, NOW)).toBe(false);
    expect(verifyHookSignature(secret, { ...request, timestamp: null }, NOW)).toBe(false);
    expect(verifyHookSignature(secret, { ...request, signature: null }, NOW)).toBe(false);
    expect(verifyHookSignature(secret, { ...request, signature: request.signature.replace("v1,", "v2,") }, NOW)).toBe(false);
    expect(verifyHookSignature(secret, { ...request, timestamp: "abc" }, NOW)).toBe(false);
  });
});

const payload = (action: string, extra: Record<string, unknown> = {}) => ({
  user: { id: "u-1", email: "kullanici@example.com" },
  email_data: {
    token: "123456",
    token_hash: "hash-abc",
    redirect_to: "https://www.2elbul.com/auth/callback",
    email_action_type: action,
    site_url: "https://site.example.com",
    ...extra,
  },
});

describe("buildAuthEmail", () => {
  it("builds a password-reset e-mail whose link goes to /auth/confirm with the token hash", () => {
    const email = buildAuthEmail(payload("recovery"), "https://fallback.test");
    expect(email).toMatchObject({ ok: true, to: "kullanici@example.com", userId: "u-1", kind: "recovery" });
    const link = new URL((email as { data: { link: string } }).data.link);
    expect(link.origin).toBe("https://www.2elbul.com");
    expect(link.pathname).toBe("/auth/confirm");
    expect(link.searchParams.get("token_hash")).toBe("hash-abc");
    expect(link.searchParams.get("type")).toBe("recovery");
  });

  it("maps every link type to its template and verifyOtp type", () => {
    const expectations: Array<[string, string, string]> = [
      ["signup", "signup", "signup"],
      ["magiclink", "magiclink", "magiclink"],
      ["invite", "invite", "invite"],
      ["email", "magiclink", "email"],
    ];
    for (const [action, kind, type] of expectations) {
      const email = buildAuthEmail(payload(action), "https://fallback.test");
      expect(email.ok && email.kind, action).toBe(kind);
      expect(new URL((email as { data: { link: string } }).data.link).searchParams.get("type"), action).toBe(type);
    }
  });

  it("keeps a safe `next` for sign-up links but never for reset links", () => {
    const withNext = { redirect_to: "https://www.2elbul.com/auth/callback?next=/favoriler" };
    const signup = buildAuthEmail(payload("signup", withNext), "https://fallback.test");
    expect(new URL((signup as { data: { link: string } }).data.link).searchParams.get("next")).toBe("/favoriler");
    const recovery = buildAuthEmail(payload("recovery", withNext), "https://fallback.test");
    expect(new URL((recovery as { data: { link: string } }).data.link).searchParams.has("next")).toBe(false);
  });

  it("neutralises an open-redirect `next`", () => {
    const evil = buildAuthEmail(payload("signup", { redirect_to: "https://www.2elbul.com/x?next=//evil.com" }), "https://fallback.test");
    expect(new URL((evil as { data: { link: string } }).data.link).searchParams.get("next")).toBe("/");
  });

  it("falls back to site_url, then the configured origin", () => {
    const bySite = buildAuthEmail(payload("recovery", { redirect_to: "" }), "https://fallback.test");
    expect(new URL((bySite as { data: { link: string } }).data.link).origin).toBe("https://site.example.com");
    const byFallback = buildAuthEmail(payload("recovery", { redirect_to: "", site_url: "" }), "https://fallback.test");
    expect(new URL((byFallback as { data: { link: string } }).data.link).origin).toBe("https://fallback.test");
  });

  it("ignores non-http redirect_to values", () => {
    const email = buildAuthEmail(payload("recovery", { redirect_to: "javascript:alert(1)" }), "https://fallback.test");
    expect(new URL((email as { data: { link: string } }).data.link).origin).toBe("https://site.example.com");
  });

  it("sends the one-time code for re-authentication", () => {
    expect(buildAuthEmail(payload("reauthentication"), "https://fallback.test")).toMatchObject({
      ok: true,
      kind: "reauthentication",
      data: { code: "123456" },
    });
  });

  it("rejects unsupported types and incomplete payloads", () => {
    expect(buildAuthEmail(payload("email_change"), "https://f.test")).toMatchObject({ ok: false });
    expect(buildAuthEmail(payload("recovery", { token_hash: "" }), "https://f.test")).toMatchObject({ ok: false });
    expect(buildAuthEmail({ email_data: payload("recovery").email_data }, "https://f.test")).toMatchObject({ ok: false });
    expect(buildAuthEmail({}, "https://f.test")).toMatchObject({ ok: false });
  });
});
