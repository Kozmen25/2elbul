import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { logAdminAction, sanitizeAuditMetadata } from "./audit";

describe("sanitizeAuditMetadata — single choke point for never-persist-secrets", () => {
  it("strips top-level sensitive keys", () => {
    expect(
      sanitizeAuditMetadata({ resetKey: "x", password: "y", token: "z", seen: 1 }),
    ).toEqual({ seen: 1 });
  });

  it("recursively scrubs nested objects", () => {
    expect(
      sanitizeAuditMetadata({
        outer: { password: "p", keep: 2, inner: { token: "t", fine: true } },
      }),
    ).toEqual({ outer: { keep: 2, inner: { fine: true } } });
  });

  it("scrubs deep secret-like keys (api key, refresh, authorization, secret)", () => {
    expect(
      sanitizeAuditMetadata({
        apiKey: "k",
        authorization: "Bearer x",
        refreshToken: "r",
        serviceRole: "s",
        cookie: "c",
        session: { refresh: "r2" },
      }),
    ).toEqual({});
  });

  it("scrubs inside arrays", () => {
    expect(
      sanitizeAuditMetadata({ items: [{ token: "x", v: 1 }] }),
    ).toEqual({ items: { values: [{ v: 1 }] } });
  });

  it("returns {} for primitives and null", () => {
    expect(sanitizeAuditMetadata(null)).toEqual({});
    expect(sanitizeAuditMetadata("text")).toEqual({});
    expect(sanitizeAuditMetadata(42)).toEqual({});
  });
});

describe("logAdminAction — writes only sanitized metadata", () => {
  it("is a no-op when the admin client is missing", async () => {
    await expect(
      logAdminAction(null, "admin-1", { action: "USER_BANNED", targetUserId: "t" }),
    ).resolves.toBeUndefined();
  });

  it("inserts sanitized metadata, never the raw input", async () => {
    let inserted: unknown;
    const client = {
      from: vi.fn(() => ({
        insert: vi.fn(async (rows: unknown) => {
          inserted = rows;
          return { error: null };
        }),
      })),
    } as unknown as SupabaseClient;

    await logAdminAction(client, "admin-1", {
      action: "RESET_EMAIL_SENT",
      targetUserId: "t-1",
      metadata: { resetKey: "link-secret", via: "admin" },
      ipAddress: "127.0.0.1",
    });

    expect(inserted).toEqual({
      admin_user_id: "admin-1",
      action: "RESET_EMAIL_SENT",
      target_user_id: "t-1",
      metadata: { via: "admin" },
      ip_address: "127.0.0.1",
    });
  });

  it("never throws a DB error to the caller", async () => {
    const client = {
      from: vi.fn(() => ({
        insert: vi.fn(async () => {
          throw new Error("write failed");
        }),
      })),
    } as unknown as SupabaseClient;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      logAdminAction(client, "admin-1", { action: "USER_VERIFIED", targetUserId: "t" }),
    ).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });
});
