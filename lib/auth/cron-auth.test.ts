import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { hasValidSecret, readBearerToken, secretsMatch } from "./cron-auth";

const SECRET = "s3cret-value";

function request(headers: Record<string, string>) {
  return new NextRequest("https://2elbul.com/api/cron/daily", { headers });
}

describe("secretsMatch", () => {
  it("matches only the exact secret", () => {
    expect(secretsMatch(SECRET, SECRET)).toBe(true);
    expect(secretsMatch("s3cret-valuE", SECRET)).toBe(false);
    expect(secretsMatch("s3cret", SECRET)).toBe(false);
  });

  it("never matches an empty value", () => {
    expect(secretsMatch("", SECRET)).toBe(false);
    expect(secretsMatch(null, SECRET)).toBe(false);
    expect(secretsMatch("", "")).toBe(false);
  });
});

describe("hasValidSecret", () => {
  it("accepts the secret as a bearer token or cron header", () => {
    expect(hasValidSecret(request({ authorization: `Bearer ${SECRET}` }), SECRET)).toBe(true);
    expect(hasValidSecret(request({ "x-cron-secret": SECRET }), SECRET)).toBe(true);
  });

  it("rejects wrong or missing credentials", () => {
    expect(hasValidSecret(request({ authorization: "Bearer nope" }), SECRET)).toBe(false);
    expect(hasValidSecret(request({ authorization: SECRET }), SECRET)).toBe(false);
    expect(hasValidSecret(request({}), SECRET)).toBe(false);
  });
});

describe("readBearerToken", () => {
  it("returns the token or null", () => {
    expect(readBearerToken(request({ authorization: "Bearer abc" }))).toBe("abc");
    expect(readBearerToken(request({ authorization: "Basic abc" }))).toBeNull();
  });
});
