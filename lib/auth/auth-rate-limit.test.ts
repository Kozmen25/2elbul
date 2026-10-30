import { describe, expect, it } from "vitest";
import { AUTH_RATE_LIMITS, authRateLimitMessage, checkAuthRateLimit } from "./auth-rate-limit";

function uniqueIp() {
  return `198.51.100.${Math.floor(Math.random() * 250)}-${Math.random()}`;
}

describe("checkAuthRateLimit", () => {
  it("blocks one account after its limit, even from different IPs", () => {
    const account = `victim-${Math.random()}@example.com`;
    const { limit } = AUTH_RATE_LIMITS.login.perAccount;
    for (let attempt = 0; attempt < limit; attempt += 1) {
      expect(checkAuthRateLimit("login", { ip: uniqueIp(), account }).allowed).toBe(true);
    }
    const blocked = checkAuthRateLimit("login", { ip: uniqueIp(), account });
    expect(blocked).toEqual({ allowed: false, retryAfterMinutes: 15 });
  });

  it("treats e-mail case as the same account", () => {
    const account = `Case-${Math.random()}@Example.com`;
    const { limit } = AUTH_RATE_LIMITS["password-reset"].perAccount;
    for (let attempt = 0; attempt < limit; attempt += 1) {
      checkAuthRateLimit("password-reset", { ip: uniqueIp(), account });
    }
    expect(
      checkAuthRateLimit("password-reset", { ip: uniqueIp(), account: account.toLowerCase() }).allowed,
    ).toBe(false);
  });

  it("blocks one IP that tries many accounts", () => {
    const ip = uniqueIp();
    const { limit } = AUTH_RATE_LIMITS.login.perIp;
    for (let attempt = 0; attempt < limit; attempt += 1) {
      checkAuthRateLimit("login", { ip, account: `user-${attempt}-${Math.random()}@example.com` });
    }
    expect(checkAuthRateLimit("login", { ip, account: "another@example.com" }).allowed).toBe(false);
  });

  it("keeps actions separate", () => {
    const ip = uniqueIp();
    const account = `sep-${Math.random()}@example.com`;
    for (let attempt = 0; attempt < AUTH_RATE_LIMITS.signup.perAccount.limit; attempt += 1) {
      checkAuthRateLimit("signup", { ip, account });
    }
    expect(checkAuthRateLimit("signup", { ip, account }).allowed).toBe(false);
    expect(checkAuthRateLimit("login", { ip, account }).allowed).toBe(true);
  });
});

describe("authRateLimitMessage", () => {
  it("tells the user when to retry", () => {
    expect(authRateLimitMessage(15)).toBe("Çok fazla deneme yapıldı. Lütfen 15 dakika sonra tekrar deneyin.");
  });
});
