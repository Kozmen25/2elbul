import { describe, expect, it } from "vitest";
import { confirmFailurePath, confirmSuccessPath, parseEmailOtpType, safeNextPath } from "./confirm";

describe("parseEmailOtpType", () => {
  it("accepts the Supabase e-mail link types", () => {
    for (const type of ["signup", "recovery", "magiclink", "email_change", "invite", "email"]) {
      expect(parseEmailOtpType(type)).toBe(type);
    }
  });

  it("rejects anything else", () => {
    expect(parseEmailOtpType("sms")).toBeNull();
    expect(parseEmailOtpType("")).toBeNull();
    expect(parseEmailOtpType(null)).toBeNull();
  });
});

describe("safeNextPath", () => {
  it("keeps same-site paths", () => {
    expect(safeNextPath("/hesabim")).toBe("/hesabim");
    expect(safeNextPath("/search?q=iphone")).toBe("/search?q=iphone");
  });

  it("blocks external and protocol-relative targets", () => {
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath("/\\evil.com")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
  });

  it("blocks paths that browsers turn into another host after stripping whitespace", () => {
    expect(new URL("/\t/evil.com", "https://2elbul.com").host).toBe("evil.com");
    expect(safeNextPath("/\t/evil.com")).toBe("/");
    expect(safeNextPath("/\n/evil.com")).toBe("/");
    expect(safeNextPath("/\r\n/evil.com")).toBe("/");
    // A plain space is kept (encoded as %20), so normal paths still work.
    expect(new URL("/ /evil.com", "https://2elbul.com").host).toBe("2elbul.com");
    expect(safeNextPath("/search?q=iphone 15")).toBe("/search?q=iphone 15");
  });
});

describe("confirm routing", () => {
  it("sends recovery links to the new-password page regardless of next", () => {
    expect(confirmSuccessPath("recovery", "/hesabim")).toBe("/yeni-sifre");
  });

  it("sends other links to next (or home)", () => {
    expect(confirmSuccessPath("signup", "/favoriler")).toBe("/favoriler");
    expect(confirmSuccessPath("signup", null)).toBe("/");
  });

  it("sends failed recovery links back to the reset request page", () => {
    expect(confirmFailurePath("recovery")).toBe("/sifre-sifirla?error=link_expired");
    expect(confirmFailurePath("signup")).toBe("/giris?error=verification_failed");
    expect(confirmFailurePath(null)).toBe("/giris?error=verification_failed");
  });
});
