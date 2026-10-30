import { describe, expect, it } from "vitest";
import { resolveRequestOrigin } from "./origin";

const FALLBACK = "https://2elbul.com";

describe("resolveRequestOrigin", () => {
  it("prefers the Origin header", () => {
    expect(resolveRequestOrigin("https://www.2elbul.com", "other.com", "https", FALLBACK)).toBe("https://www.2elbul.com");
  });

  it("falls back to the forwarded host and protocol", () => {
    expect(resolveRequestOrigin(null, "www.2elbul.com", "https", FALLBACK)).toBe("https://www.2elbul.com");
    expect(resolveRequestOrigin(null, "localhost:3000", "http", FALLBACK)).toBe("http://localhost:3000");
  });

  it("defaults the forwarded protocol to https", () => {
    expect(resolveRequestOrigin(null, "www.2elbul.com", null, FALLBACK)).toBe("https://www.2elbul.com");
  });

  it("uses the configured site url when nothing else is known or the value is unusable", () => {
    expect(resolveRequestOrigin(null, null, null, FALLBACK)).toBe(FALLBACK);
    expect(resolveRequestOrigin("null", null, null, FALLBACK)).toBe(FALLBACK);
    expect(resolveRequestOrigin("javascript:alert(1)", null, null, FALLBACK)).toBe(FALLBACK);
  });
});
