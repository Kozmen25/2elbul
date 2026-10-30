import { describe, expect, it } from "vitest";
import { RECOVERY_WINDOW_MS, isRecentEmailLinkLogin, readAmrClaim } from "./recovery";

function tokenWith(claims: object) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256" })}.${encode(claims)}.signature`;
}

const NOW = Date.UTC(2026, 8, 30, 12, 0, 0);
const seconds = (ms: number) => Math.floor(ms / 1000);

describe("readAmrClaim", () => {
  it("reads the amr claim from a JWT", () => {
    const token = tokenWith({ amr: [{ method: "otp", timestamp: 1790779527 }] });
    expect(readAmrClaim(token)).toEqual([{ method: "otp", timestamp: 1790779527 }]);
  });

  it("returns an empty list for missing, malformed or non-array claims", () => {
    expect(readAmrClaim(null)).toEqual([]);
    expect(readAmrClaim("not-a-jwt")).toEqual([]);
    expect(readAmrClaim(tokenWith({ amr: "otp" }))).toEqual([]);
    expect(readAmrClaim(tokenWith({}))).toEqual([]);
    expect(readAmrClaim(tokenWith({ amr: [{ method: 1 }, { method: "otp", timestamp: 5 }] }))).toEqual([
      { method: "otp", timestamp: 5 },
    ]);
  });
});

describe("isRecentEmailLinkLogin", () => {
  it("accepts a fresh e-mail link login", () => {
    expect(isRecentEmailLinkLogin([{ method: "otp", timestamp: seconds(NOW - 60_000) }], NOW)).toBe(true);
    expect(isRecentEmailLinkLogin([{ method: "recovery", timestamp: seconds(NOW - 60_000) }], NOW)).toBe(true);
  });

  it("rejects an e-mail link login older than the window", () => {
    expect(
      isRecentEmailLinkLogin([{ method: "otp", timestamp: seconds(NOW - RECOVERY_WINDOW_MS - 5_000) }], NOW),
    ).toBe(false);
  });

  it("rejects a normal password login, even a fresh one", () => {
    expect(isRecentEmailLinkLogin([{ method: "password", timestamp: seconds(NOW - 1_000) }], NOW)).toBe(false);
  });

  it("uses the most recent method when several are present", () => {
    const amr = [
      { method: "otp", timestamp: seconds(NOW - 120_000) },
      { method: "password", timestamp: seconds(NOW - 10_000) },
    ];
    expect(isRecentEmailLinkLogin(amr, NOW)).toBe(false);
  });

  it("accepts every e-mail link method", () => {
    for (const method of ["otp", "recovery", "magiclink", "email/signup", "email_change", "invite"]) {
      expect(isRecentEmailLinkLogin([{ method, timestamp: seconds(NOW - 1_000) }], NOW)).toBe(true);
    }
  });

  it("rejects password, OAuth and TOTP sessions", () => {
    for (const method of ["password", "oauth", "totp", "anonymous"]) {
      expect(isRecentEmailLinkLogin([{ method, timestamp: seconds(NOW - 1_000) }], NOW)).toBe(false);
    }
  });

  it("ignores token refresh entries when finding how the session began", () => {
    const amr = [
      { method: "otp", timestamp: seconds(NOW - 300_000) },
      { method: "token_refresh", timestamp: seconds(NOW - 10_000) },
    ];
    expect(isRecentEmailLinkLogin(amr, NOW)).toBe(true);
  });

  it("rejects sessions without amr", () => {
    expect(isRecentEmailLinkLogin([], NOW)).toBe(false);
  });
});
