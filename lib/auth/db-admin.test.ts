import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { isDbAdmin } from "./db-admin";

describe("isDbAdmin — DB-role half of the dual admin gate", () => {
  it("returns false when the admin client is missing", async () => {
    await expect(isDbAdmin(null, "user-1")).resolves.toBe(false);
  });

  it("returns true when an admin_roles grant row exists", async () => {
    const client = mkClient({ data: { user_id: "user-1" }, error: null });
    await expect(isDbAdmin(client, "user-1")).resolves.toBe(true);
  });

  it("queries admin_roles by the exact user id", async () => {
    const client = mkClient({ data: { user_id: "user-1" }, error: null });
    await isDbAdmin(client, "user-1");

    const from = client.from as ReturnType<typeof vi.fn>;
    const select = (from.mock.results[0].value as { select: ReturnType<typeof vi.fn> }).select;
    const eq = (select.mock.results[0].value as { eq: ReturnType<typeof vi.fn> }).eq;
    expect(from).toHaveBeenCalledWith("admin_roles");
    expect(select).toHaveBeenCalledWith("user_id");
    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("returns false when no grant row exists", async () => {
    const client = mkClient({ data: null, error: null });
    await expect(isDbAdmin(client, "user-1")).resolves.toBe(false);
  });

  it("returns false on a query error — never open, never throw", async () => {
    const client = mkClient({ data: null, error: new Error("db down") });
    await expect(isDbAdmin(client, "user-1")).resolves.toBe(false);
  });

  it("is fail-safe: a throwing from() call returns false", async () => {
    const client = {
      from: vi.fn(() => {
        throw new Error("boom");
      }),
    } as unknown as SupabaseClient;
    await expect(isDbAdmin(client, "user-1")).resolves.toBe(false);
  });
});

function mkClient(result: { data: unknown; error: unknown }) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => result),
        })),
      })),
    })),
  } as unknown as SupabaseClient;
}
