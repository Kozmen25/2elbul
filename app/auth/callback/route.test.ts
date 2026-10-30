import { describe, expect, it, vi } from "vitest";

const exchange = vi.hoisted(() => ({ error: null as Error | null }));
vi.mock("@/lib/supabase-server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { exchangeCodeForSession: async () => ({ error: exchange.error }) },
  }),
}));

const { GET } = await import("./route");

// Behind nginx the handler sees its internal address, never the public domain.
const INTERNAL = "http://127.0.0.1:3217";

describe("GET /auth/callback", () => {
  it("sends a confirmed user on to `next` without leaking the internal host", async () => {
    exchange.error = null;
    const response = await GET(new Request(`${INTERNAL}/auth/callback?code=ok&next=%2Fyeni-sifre`));
    expect(response.headers.get("location")).toBe("/yeni-sifre");
  });

  it("sends a failed link to the error page on the same site", async () => {
    exchange.error = new Error("invalid");
    const response = await GET(new Request(`${INTERNAL}/auth/callback?code=bad`));
    expect(response.headers.get("location")).toBe("/giris?error=verification_failed");
  });
});
