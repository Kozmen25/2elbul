import { describe, expect, it } from "vitest";
import { redirectToPath } from "./relative-redirect";

describe("redirectToPath", () => {
  it("answers with a relative Location so the public domain is kept", () => {
    const response = redirectToPath("/giris?error=verification_failed");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("/giris?error=verification_failed");
  });

  it("refuses anything that is not a same-site path", () => {
    expect(() => redirectToPath("https://evil.com")).toThrow();
    expect(() => redirectToPath("//evil.com")).toThrow();
  });
});
