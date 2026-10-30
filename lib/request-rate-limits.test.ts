import { describe, expect, it } from "vitest";
import { classifyRateLimitedRoute } from "./request-rate-limits";

describe("classifyRateLimitedRoute", () => {
  it("limits server action posts on any page (login form posts to /giris)", () => {
    expect(classifyRateLimitedRoute("/giris", "POST", true)).toEqual({ type: "action", key: "action:/giris" });
  });

  it("does not limit plain page views", () => {
    expect(classifyRateLimitedRoute("/giris", "GET", false)).toBeNull();
    expect(classifyRateLimitedRoute("/giris", "POST", false)).toBeNull();
  });

  it("limits search and API routes", () => {
    expect(classifyRateLimitedRoute("/api/search/ai", "GET", false)?.type).toBe("search");
    expect(classifyRateLimitedRoute("/api/notifications", "GET", false)?.type).toBe("api");
  });

  it("exempts the signed auth hook and the header state endpoint", () => {
    expect(classifyRateLimitedRoute("/api/auth/email-hook", "POST", false)).toBeNull();
    expect(classifyRateLimitedRoute("/api/header-state", "GET", false)).toBeNull();
  });
});
