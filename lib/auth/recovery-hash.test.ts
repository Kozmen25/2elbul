import { describe, expect, it } from "vitest";
import { parseRecoveryHash } from "./recovery-hash";

describe("parseRecoveryHash", () => {
  it("reads the tokens of a recovery link fragment", () => {
    expect(parseRecoveryHash("#access_token=aaa&refresh_token=bbb&expires_in=3600&type=recovery")).toEqual({
      ok: true,
      accessToken: "aaa",
      refreshToken: "bbb",
    });
  });

  it("works without the leading #", () => {
    expect(parseRecoveryHash("access_token=a&refresh_token=b&type=recovery").ok).toBe(true);
  });

  it("rejects other link types, missing tokens and error fragments", () => {
    expect(parseRecoveryHash("#access_token=a&refresh_token=b&type=signup").ok).toBe(false);
    expect(parseRecoveryHash("#access_token=a&type=recovery").ok).toBe(false);
    expect(parseRecoveryHash("#error=access_denied&error_code=otp_expired&error_description=expired").ok).toBe(false);
    expect(parseRecoveryHash("").ok).toBe(false);
  });
});
