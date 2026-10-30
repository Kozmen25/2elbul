import { afterEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, getClientIp } from "./rate-limit";

function request(headers: Record<string, string>) {
  return { headers: { get: (name: string) => headers[name.toLowerCase()] ?? null } };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getClientIp", () => {
  it("uses the address our proxy appended, not the one the client sent", () => {
    // Client forged "9.9.9.9"; nginx appended the real peer address.
    expect(getClientIp(request({ "x-forwarded-for": "9.9.9.9, 203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("reads a single proxy-written value (Vercel overwrites the header)", () => {
    expect(getClientIp(request({ "x-forwarded-for": "203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("honours a longer trusted proxy chain", () => {
    vi.stubEnv("TRUSTED_PROXY_COUNT", "2");
    expect(getClientIp(request({ "x-forwarded-for": "9.9.9.9, 203.0.113.7, 10.0.0.2" }))).toBe(
      "203.0.113.7",
    );
  });

  it("ignores an invalid proxy count", () => {
    vi.stubEnv("TRUSTED_PROXY_COUNT", "abc");
    expect(getClientIp(request({ "x-forwarded-for": "9.9.9.9, 203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip and then a local address", () => {
    expect(getClientIp(request({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
    expect(getClientIp(request({}))).toBe("127.0.0.1");
  });
});

describe("checkRateLimit", () => {
  it("blocks after the limit and reports when to retry", () => {
    const key = `test:${Math.random()}`;
    expect(checkRateLimit(key, 2, 60_000).allowed).toBe(true);
    expect(checkRateLimit(key, 2, 60_000).allowed).toBe(true);
    const blocked = checkRateLimit(key, 2, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.resetMs).toBeGreaterThan(0);
  });
});
