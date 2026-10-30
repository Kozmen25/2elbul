import { describe, expect, it } from "vitest";
import { MIN_PASSWORD_LENGTH, validateNewPassword } from "./password-policy";

describe("validateNewPassword", () => {
  it("accepts a long enough matching password", () => {
    expect(validateNewPassword("a".repeat(MIN_PASSWORD_LENGTH), "a".repeat(MIN_PASSWORD_LENGTH))).toBeNull();
  });

  it("rejects short passwords before comparing", () => {
    expect(validateNewPassword("short", "different")).toContain(String(MIN_PASSWORD_LENGTH));
  });

  it("rejects mismatched confirmation", () => {
    expect(validateNewPassword("long-enough-1", "long-enough-2")).toBe("Şifreler birbiriyle eşleşmiyor.");
  });
});
